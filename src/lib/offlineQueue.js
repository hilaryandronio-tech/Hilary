import { supabase } from "./supabaseClient";
import { sha256 } from "./sha256";
import { dbPromise, FILE as STORE, ECHECS } from "./baseLocale";

// Every write in the app goes through here instead of calling supabase
// directly — see docs/03-brief-technique.md section 2, "le point de
// vigilance" : writes must be queued operations from the start, not direct
// network calls, or the offline layer means rewriting the data layer later.
//
// Three rules keep the queue from losing a day of work in silence:
//
//  1. A write is idempotent. Every row carries a primary key generated on the
//     phone, and the write is an upsert on that key, so replaying an operation
//     whose response was lost (very common on a farm connection) lands the same
//     row instead of a duplicate or a constraint violation.
//  2. A permanently broken operation never blocks the ones behind it. It goes
//     to the `echecs` store and the flush carries on — before, a single bad row
//     froze every later write in IndexedDB, forever, with nothing on screen.
//  3. Whatever ends up in `echecs` is shown to the user (see EtatSync).
//     A failure nobody can see is a failure nobody will fix.

let flushing = false;
let reprise = null;
let delaiReprise = 15_000;
const listeners = new Set();

function notify() {
  listeners.forEach((fn) => fn());
}

/** Subscribe to queue changes (pending count, failures). Returns an unsubscribe fn. */
export function onQueueChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export async function pendingCount() {
  const db = await dbPromise;
  return db.count(STORE);
}

/** { attente, echecs } — what EtatSync renders in the header. */
export async function etatFile() {
  const db = await dbPromise;
  const [attente, echecs] = await Promise.all([db.count(STORE), db.count(ECHECS)]);
  return { attente, echecs };
}

export async function listerEchecs() {
  const db = await dbPromise;
  return db.getAll(ECHECS);
}

/**
 * Les écritures d'une table encore en file, dans l'ordre de saisie. Un écran
 * qui affiche un cumul doit les compter : hors ligne — l'état normal à la
 * ferme — elles ne sont pas encore dans Supabase, et un total qui les ignore
 * ne bouge pas quand on vient de saisir.
 */
export async function operationsEnAttente(table) {
  const db = await dbPromise;
  const tout = await db.getAll(STORE);
  return tout.filter((op) => op.table === table);
}

/**
 * Combien d'écritures refusées concernent ces tables. Un écran qui affiche un
 * cumul doit le dire : ces lignes ne sont ni dans Supabase ni dans la file, un
 * total qui les passe sous silence retombe à zéro comme si rien n'avait été
 * saisi.
 */
export async function nombreEchecs(tables) {
  const db = await dbPromise;
  const tout = await db.getAll(ECHECS);
  return tout.filter((op) => tables.includes(op.table)).length;
}

/** Put every failed operation back in the queue, oldest first, and retry. */
export async function rejouerEchecs() {
  const db = await dbPromise;
  const echecs = await db.getAll(ECHECS);
  for (const echec of echecs) {
    const { id, erreur, echoueA, ...operation } = echec;
    await db.add(STORE, operation);
    await db.delete(ECHECS, id);
  }
  notify();
  delaiReprise = 15_000;
  flush();
}

/** Give up on one failed operation — the row is gone for good, hence the confirm in the UI. */
export async function oublierEchec(id) {
  const db = await dbPromise;
  await db.delete(ECHECS, id);
  notify();
}

/**
 * Queue a write.
 *  - kind "upsert" (with `conflict`, e.g. "id" or "vente_id,calibre") — the
 *    default shape for anything the app inserts, so a replay is harmless.
 *  - kind "update" — targets existing rows via `match`.
 *  - kind "delete" — supprime les lignes désignées par `match`. Rejouable
 *    aussi : supprimer une ligne déjà partie ne lève pas d'erreur.
 *  - `groupe` ties related operations together (a ponte header and its lines):
 *    if one fails for good, the whole group is set aside rather than leaving
 *    orphan lines pointing at a header that never landed.
 */
export async function enqueue({ table, kind = "upsert", conflict = "id", payload, match, groupe }) {
  const db = await dbPromise;
  await db.add(STORE, { table, kind, conflict, payload, match, groupe, createdAt: Date.now() });
  notify();
  flush();
}

async function envoyer(item) {
  const query = supabase.from(item.table);
  if (item.kind === "update") return (await query.update(item.payload).match(item.match)).error;
  if (item.kind === "insert") return (await query.insert(item.payload)).error;
  if (item.kind === "delete") return (await query.delete().match(item.match)).error;
  return (await query.upsert(item.payload, { onConflict: item.conflict })).error;
}

/**
 * A permanent failure will fail again identically in an hour: retrying it just
 * blocks the queue. A transient one (no network, 5xx, timeout) must keep its
 * place in line, because dernier écrivain gagne only holds if writes land in
 * order.
 */
function estPermanente(erreur) {
  const code = erreur?.code ?? "";
  // PostgREST passes Postgres' SQLSTATE straight through: 22xxx invalid data,
  // 23xxx constraint violation, 42xxx missing column or RLS refusal.
  if (/^(22|23|42)/.test(code)) return true;
  // PostgREST's own codes: malformed request, schema cache out of date…
  if (code.startsWith("PGRST")) return true;
  // No code at all means the request never reached Postgres.
  return false;
}

function messageErreur(erreur) {
  if (erreur?.code === "23505") return "Cette saisie existe déjà pour cette date.";
  if (erreur?.code === "23503") return "Dépend d'une saisie qui n'a pas pu être enregistrée.";
  if (erreur?.code === "42501") return "Droits insuffisants pour cette écriture.";
  return erreur?.message || "Erreur inconnue.";
}

async function mettreEnEchec(item, erreur) {
  const db = await dbPromise;
  const tous = item.groupe
    ? (await db.getAll(STORE)).filter((i) => i.groupe === item.groupe)
    : [item];
  for (const op of tous) {
    const { id, ...reste } = op;
    await db.add(ECHECS, { ...reste, erreur: messageErreur(erreur), echoueA: Date.now() });
    await db.delete(STORE, id);
  }
  console.error(`Sync abandonnée pour ${item.table}`, erreur);
  notify();
}

function programmerReprise() {
  if (reprise) return;
  reprise = setTimeout(() => {
    reprise = null;
    delaiReprise = Math.min(delaiReprise * 2, 5 * 60_000);
    flush();
  }, delaiReprise);
}

function annulerReprise() {
  if (reprise) clearTimeout(reprise);
  reprise = null;
  delaiReprise = 15_000;
}

/** Send queued writes to Supabase in order, oldest first. */
export async function flush() {
  if (flushing || !navigator.onLine) return;
  flushing = true;
  let bloquee = false;
  try {
    const db = await dbPromise;
    while (true) {
      const [item] = await db.getAll(STORE, undefined, 1);
      if (!item) break;

      const erreur = await envoyer(item);
      if (!erreur) {
        await db.delete(STORE, item.id);
        notify();
        continue;
      }
      if (!estPermanente(erreur)) {
        console.warn(`Sync reportée pour ${item.table}`, erreur);
        bloquee = true;
        break;
      }
      await mettreEnEchec(item, erreur);
    }
  } finally {
    flushing = false;
  }
  if (bloquee) programmerReprise();
  else annulerReprise();
}

/**
 * A UUID derived from its inputs, so the same fiche always claims the same row.
 * Used where the schema already forbids duplicates — unique (date, lot_id) on
 * `pontes` and `saisies_ferme` — to turn a re-entry into a correction of that
 * day's fiche instead of a constraint violation nobody ever sees.
 */
export function idStable(...parties) {
  const octets = sha256(new TextEncoder().encode(parties.join("|")));
  octets[6] = (octets[6] & 0x0f) | 0x50; // version 5, comme un UUID de nom
  octets[8] = (octets[8] & 0x3f) | 0x80; // variant RFC 4122
  return formaterUuid(octets);
}

function formaterUuid(octets) {
  const hex = [...octets.slice(0, 16)].map((o) => o.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

/**
 * A random UUID. `crypto.randomUUID` only exists in a secure context (https or
 * localhost): open the dev server from a phone by its IP address and it is
 * simply missing, which threw and aborted the save before anything ever
 * reached the queue. `crypto.getRandomValues` carries no such restriction.
 */
export function uuid() {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const octets = crypto.getRandomValues(new Uint8Array(16));
  octets[6] = (octets[6] & 0x0f) | 0x40; // version 4
  octets[8] = (octets[8] & 0x3f) | 0x80; // variant RFC 4122
  return formaterUuid(octets);
}

window.addEventListener("online", () => {
  delaiReprise = 15_000;
  flush();
});
window.addEventListener("focus", flush);
