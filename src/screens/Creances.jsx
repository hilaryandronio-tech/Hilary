import { useEffect, useState } from "react";
import Header from "../components/Header";
import { fmt, dLabel, today } from "../components/format";
import { supabase } from "../lib/supabaseClient";
import { enqueue, onQueueChange } from "../lib/offlineQueue";

const BUCKETS = [
  { statut: "normal", l: "0 – 30 jours" },
  { statut: "a_relancer", l: "31 – 60 jours" },
  { statut: "critique", l: "Plus de 60 jours" },
];

export default function Creances() {
  const [impayes, setImpayes] = useState([]);
  const [mois, setMois] = useState({ livre: 0, encaisse: 0 });
  const [enCours, setEnCours] = useState(new Set());

  const charger = () => {
    supabase
      .from("v_creances")
      .select("id, date, client, montant, anciennete_jours, statut")
      .then(({ data }) => setImpayes(data ?? []));

    const debutMois = today().slice(0, 7) + "-01";
    supabase
      .from("ventes")
      .select("montant")
      .eq("credit", true)
      .gte("date", debutMois)
      .then(({ data }) => setMois((m) => ({ ...m, livre: (data ?? []).reduce((s, v) => s + v.montant, 0) })));
    supabase
      .from("ventes")
      .select("montant")
      .eq("solde", true)
      .gte("date_solde", debutMois)
      .then(({ data }) => setMois((m) => ({ ...m, encaisse: (data ?? []).reduce((s, v) => s + v.montant, 0) })));
  };

  useEffect(() => {
    charger();
    // recharge quand la file d'attente se vide (une créance vient d'être soldée ailleurs, ou la sync a rattrapé)
    return onQueueChange(charger);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const creanceTotale = impayes.reduce((s, e) => s + e.montant, 0);

  const encaisser = async (venteId) => {
    setEnCours((s) => new Set(s).add(venteId));
    await enqueue({ table: "ventes", kind: "update", payload: { solde: true, date_solde: today() }, match: { id: venteId } });
    setImpayes((list) => list.filter((e) => e.id !== venteId));
  };

  const parClient = [...new Set(impayes.map((e) => e.client))].map((nom) => ({
    nom,
    lignes: impayes.filter((e) => e.client === nom),
  }));

  return (
    <div className="tf">
      <Header />
      <main className="tf-body">
        <p className="tf-eyebrow">Recouvrement</p>
        <h1 className="tf-h1">Livraisons impayées</h1>
        <p className="tf-sub">Appuie sur Encaissé quand le client règle. La ligne bascule en recette du jour.</p>

        <div className="tf-kpis">
          <div className="tf-kpi" data-hero="1" data-alert={creanceTotale ? 1 : 0}>
            <div className="tf-kpi-n">{fmt(creanceTotale)}</div>
            <div className="tf-kpi-l">Ar à recouvrer · {impayes.length} livraison(s)</div>
          </div>
        </div>

        {impayes.length === 0 && (
          <div className="tf-card"><p className="tf-empty">Aucune créance en cours. Tout est encaissé.</p></div>
        )}

        <div className="tf-card">
          <div className="tf-cardhead">
            <span className="tf-cardtitle">Ancienneté</span>
            <span className="tf-tag">RELANCE À 30 J</span>
          </div>
          <div className="tf-ticket">
            {BUCKETS.map((b) => {
              const n = impayes.filter((e) => e.statut === b.statut).reduce((s, e) => s + e.montant, 0);
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
            <div className="tf-ticket-row"><span>Encaissé sur créances</span><span>{fmt(mois.encaisse)} Ar</span></div>
            <div className="tf-ticket-row">
              <span style={{ fontWeight: 600 }}>Reste dû sur le mois</span>
              <span style={{ fontWeight: 600 }}>{fmt(mois.livre - mois.encaisse)} Ar</span>
            </div>
          </div>
        </div>

        {parClient.map(({ nom, lignes }) => {
          const total = lignes.reduce((s, e) => s + e.montant, 0);
          return (
            <div className="tf-card" key={nom}>
              <div className="tf-cardhead">
                <span className="tf-cardtitle">{nom}</span>
                <span className="tf-tag">{fmt(total)} AR</span>
              </div>
              {lignes.map((e) => (
                <div className="tf-due" key={e.id}>
                  <div>
                    <div className="tf-due-l">Livraison</div>
                    <div className="tf-due-d" data-late={e.anciennete_jours > 30 ? 1 : 0}>
                      {dLabel(e.date)} · {e.anciennete_jours} jour{e.anciennete_jours > 1 ? "s" : ""}
                    </div>
                  </div>
                  <div className="tf-due-r">
                    <span className="tf-due-n">{fmt(e.montant)}</span>
                    <button className="tf-due-btn" disabled={enCours.has(e.id)} onClick={() => encaisser(e.id)}>
                      {enCours.has(e.id) ? "…" : "Encaissé"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </main>
    </div>
  );
}
