import { useEffect, useMemo, useState } from "react";
import Header from "../components/Header";
import Keypad from "../components/Keypad";
import AlerteEchecs from "../components/AlerteEchecs";
import { fmt, dLabel, today } from "../components/format";
import { supabase } from "../lib/supabaseClient";
import { enqueue, onQueueChange, operationsEnAttente, uuid } from "../lib/offlineQueue";
import { useAuth } from "../context/AuthContext";

// Un règlement est un fait daté, pas un interrupteur sur la vente : il entre en
// recette le jour où l'argent arrive. D'où la table `reglements`, et un reste
// dû calculé plutôt que stocké — voir docs/05-migration-encaissement-partiel.sql.

const BUCKETS = [
  { statut: "normal", l: "0 – 30 jours" },
  { statut: "a_relancer", l: "31 – 60 jours" },
  { statut: "critique", l: "Plus de 60 jours" },
];

const TABLES = ["reglements", "ventes"];

export default function Creances() {
  const { profil } = useAuth();
  const [impayes, setImpayes] = useState([]);
  const [enFile, setEnFile] = useState({}); // { [vente_id]: montant déjà saisi, pas encore synchronisé }
  const [mois, setMois] = useState({ livre: 0, encaisse: 0 });
  const [pad, setPad] = useState(null);
  const [flash, setFlash] = useState("");

  const charger = async () => {
    const { data } = await supabase
      .from("v_creances")
      .select("id, date, client, montant, regle, reste, anciennete_jours, statut");
    setImpayes(data ?? []);

    const debutMois = today().slice(0, 7) + "-01";
    const [{ data: livrees }, { data: regles }] = await Promise.all([
      supabase.from("ventes").select("montant").eq("credit", true).gte("date", debutMois),
      supabase.from("reglements").select("montant").gte("date", debutMois),
    ]);
    setMois({
      livre: (livrees ?? []).reduce((s, v) => s + v.montant, 0),
      encaisse: (regles ?? []).reduce((s, r) => s + r.montant, 0),
    });
  };

  const chargerFile = async () => {
    const ops = await operationsEnAttente("reglements");
    const parVente = {};
    ops.forEach((op) => {
      [].concat(op.payload).forEach((r) => {
        parVente[r.vente_id] = (parVente[r.vente_id] ?? 0) + r.montant;
      });
    });
    setEnFile(parVente);
  };

  useEffect(() => {
    const relire = () => { charger(); chargerFile(); };
    relire();
    return onQueueChange(relire);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Ce qui attend dans la file compte comme réglé : la vendeuse a l'argent en
  // main, la ligne ne doit pas continuer à réclamer la somme.
  const lignes = useMemo(
    () =>
      impayes
        .map((e) => ({ ...e, resteReel: e.reste - (enFile[e.id] ?? 0) }))
        .filter((e) => e.resteReel > 0),
    [impayes, enFile]
  );

  const creanceTotale = lignes.reduce((s, e) => s + e.resteReel, 0);
  const encaisseAvecFile =
    mois.encaisse + Object.values(enFile).reduce((s, n) => s + n, 0);

  const regler = async (creance, montant) => {
    if (montant <= 0) return;
    if (montant > creance.resteReel) {
      setFlash(`Le règlement dépasse le reste dû (${fmt(creance.resteReel)} Ar).`);
      setTimeout(() => setFlash(""), 3400);
      return;
    }
    await enqueue({
      table: "reglements",
      conflict: "id",
      payload: {
        id: uuid(),
        vente_id: creance.id,
        date: today(),
        montant,
        auteur: profil?.id,
      },
    });
    const restant = creance.resteReel - montant;
    setFlash(
      restant > 0
        ? `${fmt(montant)} Ar encaissés — reste ${fmt(restant)} Ar.`
        : `${creance.client} : créance soldée.`
    );
    setTimeout(() => setFlash(""), 3400);
  };

  const ouvrirPartiel = (creance) =>
    setPad({
      creance,
      label: `${creance.client} — reste ${fmt(creance.resteReel)} Ar`,
      unit: "Ar",
      value: creance.resteReel,
    });

  const parClient = [...new Set(lignes.map((e) => e.client))].map((nom) => ({
    nom,
    lignes: lignes.filter((e) => e.client === nom),
  }));

  return (
    <div className="tf">
      <Header />
      <main className="tf-body">
        <p className="tf-eyebrow">Recouvrement</p>
        <h1 className="tf-h1">Livraisons impayées</h1>
        <p className="tf-sub">
          « Tout » solde la livraison. « Partiel » sert quand le client ne règle qu'une part —
          le reste continue de courir.
        </p>

        <div className="tf-kpis">
          <div className="tf-kpi" data-hero="1" data-alert={creanceTotale ? 1 : 0}>
            <div className="tf-kpi-n">{fmt(creanceTotale)}</div>
            <div className="tf-kpi-l">Ar à recouvrer · {lignes.length} livraison(s)</div>
          </div>
        </div>

        <AlerteEchecs tables={TABLES} />

        {lignes.length === 0 && (
          <div className="tf-card"><p className="tf-empty">Aucune créance en cours. Tout est encaissé.</p></div>
        )}

        <div className="tf-card">
          <div className="tf-cardhead">
            <span className="tf-cardtitle">Ancienneté</span>
            <span className="tf-tag">RELANCE À 30 J</span>
          </div>
          <div className="tf-ticket">
            {BUCKETS.map((b) => {
              const n = lignes.filter((e) => e.statut === b.statut).reduce((s, e) => s + e.resteReel, 0);
              const critique = b.statut === "critique" && n > 0;
              return (
                <div className="tf-ticket-row" key={b.statut}>
                  <span style={critique ? { color: "var(--brick)", fontWeight: 600 } : undefined}>{b.l}</span>
                  <span style={critique ? { color: "var(--brick)", fontWeight: 600 } : undefined}>{fmt(n)} Ar</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="tf-card">
          <div className="tf-cardhead">
            <span className="tf-cardtitle">Mois en cours</span>
            <span className="tf-tag">{new Date().toLocaleDateString("fr-FR", { month: "long", year: "numeric" }).toUpperCase()}</span>
          </div>
          <div className="tf-ticket">
            <div className="tf-ticket-row"><span>Livré à crédit</span><span>{fmt(mois.livre)} Ar</span></div>
            <div className="tf-ticket-row"><span>Encaissé sur créances</span><span>{fmt(encaisseAvecFile)} Ar</span></div>
            <div className="tf-ticket-row">
              <span style={{ fontWeight: 600 }}>Reste dû sur le mois</span>
              <span style={{ fontWeight: 600 }}>{fmt(mois.livre - encaisseAvecFile)} Ar</span>
            </div>
          </div>
        </div>

        {parClient.map(({ nom, lignes: dues }) => {
          const total = dues.reduce((s, e) => s + e.resteReel, 0);
          return (
            <div className="tf-card" key={nom}>
              <div className="tf-cardhead">
                <span className="tf-cardtitle">{nom}</span>
                <span className="tf-tag">{fmt(total)} AR</span>
              </div>
              {dues.map((e) => {
                const dejaRegle = e.montant - e.resteReel;
                return (
                  <div className="tf-due" key={e.id}>
                    <div>
                      <div className="tf-due-l">Livraison du {dLabel(e.date)}</div>
                      <div className="tf-due-d" data-late={e.anciennete_jours > 30 ? 1 : 0}>
                        {e.anciennete_jours} jour{e.anciennete_jours > 1 ? "s" : ""}
                        {dejaRegle > 0 && ` · ${fmt(dejaRegle)} sur ${fmt(e.montant)} déjà réglés`}
                      </div>
                    </div>
                    <div className="tf-due-r">
                      <span className="tf-due-n">{fmt(e.resteReel)}</span>
                      <div className="tf-due-actions">
                        <button className="tf-due-btn" onClick={() => regler(e, e.resteReel)}>Tout</button>
                        <button className="tf-due-btn" onClick={() => ouvrirPartiel(e)}>Partiel</button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </main>

      {flash && <div className="tf-flash">{flash}</div>}
      <Keypad
        field={pad}
        onChange={(v) => setPad({ ...pad, value: v })}
        onClose={() => {
          if (pad) regler(pad.creance, pad.value);
          setPad(null);
        }}
      />
    </div>
  );
}
