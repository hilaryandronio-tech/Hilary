import { useEffect, useMemo, useRef, useState } from "react";
import Header from "../components/Header";
import NumField from "../components/NumField";
import Keypad from "../components/Keypad";
import DateSelector from "../components/DateSelector";
import ChoixClient from "../components/ChoixClient";
import AlerteEchecs from "../components/AlerteEchecs";
import { fmt, dLabel, today } from "../components/format";
import { CALIBRES, POIDS, PRIX_BASE, PRIX_CASSE } from "../data/constants";
import { supabase } from "../lib/supabaseClient";
import { enqueue, onQueueChange, operationsEnAttente, uuid } from "../lib/offlineQueue";
import { lectureCachee } from "../lib/cacheLecture";
import { useClients } from "../lib/useClients";
import { useAuth } from "../context/AuthContext";

// Les commandes arrivent par Facebook et WhatsApp, pour une livraison à venir.
// Une commande n'est pas une vente : elle ne compte ni au chiffre d'affaires ni
// au stock tant qu'elle n'est pas partie. Le jour de la livraison, « Livrer »
// crée la vente correspondante — une seule saisie, et le CA garde une seule
// source de vérité.

const TABLES = ["commandes", "commande_lignes", "ventes", "vente_lignes"];
const CANAUX = [
  { code: "facebook", nom: "Facebook" },
  { code: "whatsapp", nom: "WhatsApp" },
  { code: "telephone", nom: "Téléphone" },
  { code: "sur_place", nom: "Sur place" },
];
const libelle = (c) => (c === "CASSE" ? "Cassés" : c);
const CALIBRES_COMMANDE = [...CALIBRES, "CASSE"];

// Une livraison en retard n'est pas une livraison à venir : elle se voit en
// premier, et en brique.
const rang = (c, jour) =>
  c.date_livraison < jour ? "retard" : c.date_livraison === jour ? "aujourdhui" : "avenir";

export default function Commandes() {
  const { profil } = useAuth();
  const clients = useClients();
  const [prixBase, setPrixBase] = useState({ ...PRIX_BASE, CASSE: PRIX_CASSE });
  const [commandes, setCommandes] = useState([]);
  const [enFile, setEnFile] = useState([]);
  const [statutsEnFile, setStatutsEnFile] = useState({});
  const requete = useRef(0);
  const jour = today();

  // Le brouillon de la commande en cours de saisie
  const [ouvert, setOuvert] = useState(false);
  const [clientNom, setClientNom] = useState(null);
  const [canal, setCanal] = useState("facebook");
  const [livraison, setLivraison] = useState(jour);
  const [numero, setNumero] = useState("");
  const [draft, setDraft] = useState({});
  const [pad, setPad] = useState(null);
  const [flash, setFlash] = useState("");

  const client = clients.find((c) => c.nom === clientNom) ?? clients[0];
  const prixClient = (cl, cal) => cl?.tarifs?.[cal] ?? prixBase[cal];
  const val = (k) => draft[k] || 0;

  useEffect(() => {
    lectureCachee("calibres", () => supabase.from("calibres").select("code, prix_base"))
      .then(({ data }) => {
        if (!data?.length) return;
        setPrixBase((p) => ({ ...p, ...Object.fromEntries(data.map((c) => [c.code, c.prix_base])) }));
      });
  }, []);

  const charger = async (jeton) => {
    const { data } = await lectureCachee("commandes:en_attente", () =>
      supabase
        .from("commandes")
        .select("id, numero, canal_prise, date_prise, date_livraison, statut, note, clients(nom), commande_lignes(calibre, oeufs)")
        .eq("statut", "en_attente")
        .order("date_livraison")
    );
    if (jeton !== requete.current) return;
    if (!data) return;
    setCommandes(data);
  };

  // Une commande saisie hors ligne doit apparaître tout de suite : elle est
  // prise devant le client, l'agenda ne peut pas l'ignorer jusqu'à la synchro.
  // Et une commande livrée hors ligne doit en disparaître aussitôt — sinon on
  // la relivre.
  const chargerFile = async () => {
    const [entetes, lignes] = await Promise.all([
      operationsEnAttente("commandes"),
      operationsEnAttente("commande_lignes"),
    ]);
    const parCommande = {};
    lignes.forEach((op) => {
      [].concat(op.payload).forEach((l) => {
        (parCommande[l.commande_id] ??= []).push(l);
      });
    });
    // Les changements de statut voyagent en `update`, séparés de la commande
    // elle-même : sans les relire, une livraison faite hors ligne resterait à
    // l'agenda jusqu'au retour du réseau.
    const statuts = {};
    entetes.forEach((op) => {
      if (op.kind === "update" && op.match?.id && op.payload?.statut) {
        statuts[op.match.id] = op.payload.statut;
      }
    });
    setStatutsEnFile(statuts);
    setEnFile(
      entetes
        .filter((op) => op.kind !== "update" && op.payload?.statut === "en_attente")
        .map((op) => ({
          ...op.payload,
          clients: { nom: clients.find((c) => c.id === op.payload.client_id)?.nom ?? "Client" },
          commande_lignes: parCommande[op.payload.id] ?? [],
          enAttente: true,
        }))
    );
  };

  useEffect(() => {
    const jeton = ++requete.current;
    const relire = () => { charger(jeton); chargerFile(); };
    relire();
    return onQueueChange(relire);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clients]);

  const toutes = useMemo(() => {
    // Une commande déjà revenue du serveur ne doit pas s'afficher deux fois,
    // et une livrée ou annulée hors ligne quitte l'agenda tout de suite.
    const idsServeur = new Set(commandes.map((c) => c.id));
    return [...enFile.filter((c) => !idsServeur.has(c.id)), ...commandes]
      .filter((c) => (statutsEnFile[c.id] ?? "en_attente") === "en_attente")
      .sort((a, b) => a.date_livraison.localeCompare(b.date_livraison));
  }, [commandes, enFile, statutsEnFile]);

  const par = (r) => toutes.filter((c) => rang(c, jour) === r);
  const montant = (c) =>
    (c.commande_lignes ?? []).reduce((s, l) => {
      const cl = clients.find((x) => x.nom === c.clients?.nom);
      return s + l.oeufs * (cl?.tarifs?.[l.calibre] ?? prixBase[l.calibre] ?? 0);
    }, 0);

  const lignesDraft = CALIBRES_COMMANDE.filter((c) => val(c) > 0);
  const totalDraft = lignesDraft.reduce((s, c) => s + val(c) * prixClient(client, c), 0);
  const peutEnregistrer = lignesDraft.length > 0 && client?.id;

  const enregistrer = async () => {
    try {
      const commandeId = uuid();
      await enqueue({
        table: "commandes",
        conflict: "id",
        groupe: commandeId,
        payload: {
          id: commandeId, numero: numero || null, client_id: client.id,
          canal_prise: canal, date_prise: jour, date_livraison: livraison,
          statut: "en_attente", auteur: profil?.id,
        },
      });
      await enqueue({
        table: "commande_lignes",
        conflict: "commande_id,calibre",
        groupe: commandeId,
        payload: lignesDraft.map((c) => ({ commande_id: commandeId, calibre: c, oeufs: val(c) })),
      });
      setDraft({}); setNumero(""); setOuvert(false);
      setFlash(`Commande notée pour ${client.nom}, à livrer le ${dLabel(livraison)}.`);
      setTimeout(() => setFlash(""), 3400);
    } catch (e) {
      console.error("Commande non enregistrée", e);
      setFlash(`Enregistrement impossible : ${e.message}.`);
      setTimeout(() => setFlash(""), 10000);
    }
  };

  // Livrer : la commande devient une vente, au prix du client du jour.
  const livrer = async (c) => {
    const cl = clients.find((x) => x.nom === c.clients?.nom);
    if (!cl?.id) {
      setFlash(`${c.clients?.nom} n'est pas synchronisé — livraison non enregistrée.`);
      setTimeout(() => setFlash(""), 4000);
      return;
    }
    const lignes = (c.commande_lignes ?? []).filter((l) => l.oeufs > 0);
    if (!lignes.length) return;
    const venteId = uuid();
    const total = lignes.reduce((s, l) => s + l.oeufs * (cl.tarifs?.[l.calibre] ?? prixBase[l.calibre]), 0);
    await enqueue({
      table: "ventes", conflict: "id", groupe: venteId,
      payload: { id: venteId, date: jour, canal: "client", client_id: cl.id, montant: total, credit: false, auteur: profil?.id },
    });
    await enqueue({
      table: "vente_lignes", conflict: "vente_id,calibre", groupe: venteId,
      payload: lignes.map((l) => ({
        vente_id: venteId, calibre: l.calibre, oeufs: l.oeufs,
        prix_unit: cl.tarifs?.[l.calibre] ?? prixBase[l.calibre],
      })),
    });
    await enqueue({
      table: "commandes", kind: "update",
      payload: { statut: "livree", vente_id: venteId }, match: { id: c.id },
    });
    setFlash(`${cl.nom} livré — vente de ${fmt(total)} Ar enregistrée.`);
    setTimeout(() => setFlash(""), 4000);
  };

  const annuler = async (c) => {
    if (!window.confirm(`Annuler la commande de ${c.clients?.nom} du ${dLabel(c.date_livraison)} ?`)) return;
    await enqueue({ table: "commandes", kind: "update", payload: { statut: "annulee" }, match: { id: c.id } });
  };

  const Bloc = ({ titre, tag, items, alerte }) =>
    items.length === 0 ? null : (
      <div className="tf-card">
        <div className="tf-cardhead">
          <span className="tf-cardtitle">{titre}</span>
          <span className="tf-tag">{tag}</span>
        </div>
        {items.map((c) => (
          <div className="tf-due" key={c.id}>
            <div>
              <div className="tf-due-l">
                {c.clients?.nom}
                {c.numero && <span className="tf-tag"> · {c.numero}</span>}
              </div>
              <div className="tf-due-d" data-late={alerte ? 1 : 0}>
                {dLabel(c.date_livraison)} · {CANAUX.find((x) => x.code === c.canal_prise)?.nom ?? "Autre"}
                {c.enAttente && " · en attente de synchro"}
              </div>
              <div className="tf-ticket">
                {(c.commande_lignes ?? []).map((l) => (
                  <div className="tf-ticket-row" key={l.calibre}>
                    <span>{libelle(l.calibre)}</span>
                    <span>{fmt(l.oeufs)} œufs</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="tf-due-r">
              <span className="tf-due-n">{fmt(montant(c))}</span>
              <div className="tf-due-actions">
                <button className="tf-due-btn" onClick={() => livrer(c)}>Livrer</button>
                <button className="tf-due-btn" onClick={() => annuler(c)}>Annuler</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    );

  return (
    <div className="tf">
      <Header />
      <main className="tf-body">
        <p className="tf-eyebrow">Agenda des commandes</p>
        <h1 className="tf-h1">À livrer</h1>
        <p className="tf-sub">
          Ce qui a été promis par Facebook, WhatsApp ou téléphone. « Livrer » enregistre la vente,
          il n'y a rien à ressaisir en caisse.
        </p>

        <AlerteEchecs tables={TABLES} />

        <div className="tf-kpis">
          <div className="tf-kpi" data-hero="1" data-alert={par("retard").length ? 1 : 0}>
            <div className="tf-kpi-n">{par("retard").length + par("aujourdhui").length}</div>
            <div className="tf-kpi-l">
              à livrer aujourd'hui ou en retard · {toutes.length} commande(s) en attente
            </div>
          </div>
        </div>

        {!ouvert && (
          <div className="tf-cta-in" style={{ marginBottom: 14 }}>
            <button className="tf-btn" onClick={() => setOuvert(true)}>Noter une commande</button>
          </div>
        )}

        {ouvert && (
          <div className="tf-card">
            <div className="tf-cardhead">
              <span className="tf-cardtitle">Nouvelle commande</span>
              <button className="tf-role" data-on="1" onClick={() => setOuvert(false)}>Fermer</button>
            </div>

            <ChoixClient clients={clients} selection={client?.nom} onSelect={setClientNom} />

            {client && !client.id && (
              <p className="tf-note" data-alerte="1">
                {client.nom} n'est pas synchronisé depuis Supabase : impossible de noter une
                commande à son nom tant que l'application n'a pas chargé la liste en ligne.
              </p>
            )}

            <div className="tf-destinataire">
              Commande de <strong>{client?.nom}</strong>
            </div>

            <p className="tf-label" style={{ marginTop: 10 }}>Reçue par</p>
            <div className="tf-chips">
              {CANAUX.map((c) => (
                <button key={c.code} className="tf-chip" data-on={canal === c.code ? 1 : 0}
                  onClick={() => setCanal(c.code)}>{c.nom}</button>
              ))}
            </div>

            <p className="tf-label">À livrer le</p>
            <DateSelector value={livraison} onChange={setLivraison} avenir />

            <div className="tf-grid4">
              {CALIBRES_COMMANDE.map((c) => (
                <NumField key={c} label={libelle(c)} sous={POIDS[c]} unit="œufs" value={val(c)}
                  detail={val(c)
                    ? `${fmt(val(c) * prixClient(client, c))} Ar`
                    : `${prixClient(client, c)} Ar/œuf`}
                  onOpen={client?.id
                    ? () => setPad({ key: c, label: `${client.nom} — ${libelle(c)}`, unit: "œufs", value: val(c) })
                    : undefined} />
              ))}
            </div>

            <div className="tf-live">
              <span className="tf-live-n">{fmt(totalDraft)}</span>
              <span className="tf-live-l">Ar — commande {client?.nom}</span>
            </div>

            <p className="tf-note">
              La commande n'entre ni au chiffre d'affaires ni au stock tant qu'elle n'est pas
              livrée. C'est « Livrer » qui crée la vente.
            </p>

            <div className="tf-cta-in">
              <button className="tf-btn" disabled={!peutEnregistrer} onClick={enregistrer}>
                Noter la commande
              </button>
              <button className="tf-btn tf-btn-ghost" onClick={() => setDraft({})}>Effacer</button>
            </div>
          </div>
        )}

        {toutes.length === 0 && (
          <div className="tf-card">
            <p className="tf-empty">Aucune commande en attente.</p>
          </div>
        )}

        <Bloc titre="En retard" tag="À LIVRER D'URGENCE" items={par("retard")} alerte />
        <Bloc titre="Aujourd'hui" tag={dLabel(jour).toUpperCase()} items={par("aujourdhui")} />
        <Bloc titre="À venir" tag="PLANIFIÉ" items={par("avenir")} />
      </main>

      {flash && <div className="tf-flash">{flash}</div>}
      <Keypad
        field={pad}
        onChange={(v) => { setDraft({ ...draft, [pad.key]: v }); setPad({ ...pad, value: v }); }}
        onClose={() => setPad(null)}
      />
    </div>
  );
}
