import { openDB } from "idb";
import { supabase } from "./supabaseClient";

// Every write in the app goes through here instead of calling supabase
// directly — see docs/03-brief-technique.md section 2, "le point de
// vigilance" : writes must be queued operations from the start, not direct
// network calls, or the offline layer means rewriting the data layer later.

const DB_NAME = "tama-ferme";
const STORE = "queue";

const dbPromise = openDB(DB_NAME, 1, {
  upgrade(db) {
    db.createObjectStore(STORE, { keyPath: "id", autoIncrement: true });
  },
});

let flushing = false;
const listeners = new Set();

function notify() {
  listeners.forEach((fn) => fn());
}

/** Subscribe to queue changes (e.g. to show a "N en attente" badge). Returns an unsubscribe fn. */
export function onQueueChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export async function pendingCount() {
  const db = await dbPromise;
  return db.count(STORE);
}

/**
 * Queue a write. `kind` is "insert" or "update".
 * For "update", `match` identifies the row(s) (e.g. { id: venteId }).
 */
export async function enqueue({ table, kind = "insert", payload, match }) {
  const db = await dbPromise;
  await db.add(STORE, { table, kind, payload, match, createdAt: Date.now() });
  notify();
  flush();
}

/**
 * Send queued writes to Supabase in order, oldest first. Stops at the first
 * failure — dernier écrivain gagne is only meaningful if writes land in order,
 * and a stalled network should not drop rows further back in the queue.
 */
export async function flush() {
  if (flushing || !navigator.onLine) return;
  flushing = true;
  try {
    const db = await dbPromise;
    while (true) {
      const [item] = await db.getAll(STORE, undefined, 1);
      if (!item) break;

      const query = supabase.from(item.table);
      const { error } =
        item.kind === "update"
          ? await query.update(item.payload).match(item.match)
          : await query.insert(item.payload);

      if (error) {
        console.error(`Sync échouée pour ${item.table}`, error);
        break;
      }
      await db.delete(STORE, item.id);
      notify();
    }
  } finally {
    flushing = false;
  }
}

window.addEventListener("online", flush);
window.addEventListener("focus", flush);
