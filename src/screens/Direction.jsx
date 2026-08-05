import { useEffect, useState } from "react";
import Header from "../components/Header";
import { fmt, today } from "../components/format";
import { supabase } from "../lib/supabaseClient";

const zeroJour = {
  oeufs: 0, valeur_collecte: 0, mortalite: 0, provende_kg: 0,
  encaisse: 0, livre_credit: 0, charges: 0, poules_en_ponte: 0,
};

export default function Direction() {
  const [jour, setJour] = useState(zeroJour);
  const [cheptel, setCheptel] = useState(0);
  const [creanceTotale, setCreanceTotale] = useState(0);
  const [days, setDays] = useState([]);
  const [saisies, setSaisies] = useState([]);

  useEffect(() => {
    (async () => {
      const [{ data: jrs }, { data: eff }, { data: creances }, { data: taux }] = await Promise.all([
        supabase.from("v_journalier").select("*").eq("date", today()).maybeSingle(),
        supabase.from("v_effectif").select("vivant"),
        supabase.from("v_creances").select("montant"),
        supabase.from("v_taux_ponte").select("date, taux_ponte").gte("date", ilYA(6)),
      ]);
      if (jrs) setJour(jrs);
      setCheptel((eff ?? []).reduce((s, l) => s + l.vivant, 0));
      setCreanceTotale((creances ?? []).reduce((s, c) => s + c.montant, 0));
      setDays(
        [...Array(7)].map((_, i) => {
          const d = ilYA(6 - i);
          return { d, taux: taux?.find((t) => t.date === d)?.taux_ponte ?? 0 };
        })
      );

      const [{ data: ferme }, { data: pontes }, { data: ventes }, { data: charges }] = await Promise.all([
        supabase.from("saisies_ferme").select("lot_id, provende_kg, mortalite").eq("date", today()),
        supabase.from("pontes").select("id, lot_id, ponte_lignes(oeufs)").eq("date", today()),
        supabase.from("ventes").select("canal, montant, credit, clients(nom)").eq("date", today()),
        supabase.from("charges").select("categorie, montant").eq("date", today()),
      ]);

      const lignes = [];
      (ferme ?? []).forEach((f) => {
        if (f.provende_kg) lignes.push({ label: `${f.lot_id} · Provende`, value: `${fmt(f.provende_kg)} kg` });
        if (f.mortalite) lignes.push({ label: `${f.lot_id} · Mortalité`, value: `${fmt(f.mortalite)} têtes` });
      });
      (pontes ?? []).forEach((p) => {
        const oeufs = (p.ponte_lignes ?? []).reduce((s, l) => s + l.oeufs, 0);
        if (oeufs) lignes.push({ label: p.lot_id ? `${p.lot_id} · Ponte` : "Ponte", value: `${fmt(oeufs)} œufs` });
      });
      (ventes ?? []).forEach((v) => {
        lignes.push({
          label: v.canal === "client" ? (v.clients?.nom ?? "Client") : "Point de vente",
          value: `${fmt(v.montant)} Ar${v.credit ? " · CRÉDIT" : ""}`,
        });
      });
      (charges ?? []).forEach((c) => lignes.push({ label: c.categorie, value: `${fmt(c.montant)} Ar` }));
      setSaisies(lignes);
    })();
  }, []);

  const tauxJour = jour.poules_en_ponte ? (jour.oeufs / jour.poules_en_ponte) * 100 : 0;

  return (
    <div className="tf">
      <Header />
      <main className="tf-body">
        <p className="tf-eyebrow">Tableau de bord</p>
        <h1 className="tf-h1">{today()}</h1>
        <p className="tf-sub">Tout est calculé à partir des saisies de l'équipe.</p>

        <div className="tf-kpis">
          <div className="tf-kpi" data-hero="1">
            <div className="tf-kpi-n">{tauxJour.toFixed(1)} %</div>
            <div className="tf-kpi-l">
              Taux de ponte — {fmt(jour.oeufs)} œufs sur {fmt(jour.poules_en_ponte)} poules en ponte
            </div>
          </div>
          <div className="tf-kpi">
            <div className="tf-kpi-n">{fmt(cheptel)}</div>
            <div className="tf-kpi-l">Cheptel vivant</div>
          </div>
          <div className="tf-kpi">
            <div className="tf-kpi-n">{jour.mortalite}</div>
            <div className="tf-kpi-l">Mortalité du jour</div>
          </div>
          <div className="tf-kpi">
            <div className="tf-kpi-n">
              {cheptel ? fmt((jour.provende_kg * 1000) / cheptel) : 0}<span className="tf-unit">g</span>
            </div>
            <div className="tf-kpi-l">Provende par poule</div>
          </div>
          <div className="tf-kpi">
            <div className="tf-kpi-n">{fmt(jour.valeur_collecte)}</div>
            <div className="tf-kpi-l">Valeur de la collecte (Ar)</div>
          </div>
          <div className="tf-kpi">
            <div className="tf-kpi-n">{fmt(jour.valeur_collecte - jour.charges)}</div>
            <div className="tf-kpi-l">Production nette des charges (Ar)</div>
          </div>
          <div className="tf-kpi">
            <div className="tf-kpi-n">{fmt(jour.encaisse - jour.charges)}</div>
            <div className="tf-kpi-l">Marge brute encaissée (Ar)</div>
          </div>
          <div className="tf-kpi">
            <div className="tf-kpi-n">{fmt(jour.livre_credit)}</div>
            <div className="tf-kpi-l">Livré à crédit aujourd'hui (Ar)</div>
          </div>
          <div className="tf-kpi" data-alert={creanceTotale ? 1 : 0}>
            <div className="tf-kpi-n">{fmt(creanceTotale)}</div>
            <div className="tf-kpi-l">Créances totales à recouvrer (Ar)</div>
          </div>
        </div>

        <div className="tf-card">
          <div className="tf-cardhead">
            <span className="tf-cardtitle">Taux de ponte — 7 jours</span>
            <span className="tf-tag">OBJECTIF 90 %</span>
          </div>
          <div className="tf-bars">
            {days.map((d, i) => (
              <div key={d.d} className="tf-bar" data-last={i === 6 ? 1 : 0}
                style={{ height: `${Math.max(3, Math.min(100, d.taux))}%` }} />
            ))}
          </div>
          <div className="tf-barlabels">
            {days.map((d) => <div key={d.d} className="tf-barlabel">{d.taux ? Math.round(d.taux) : "·"}</div>)}
          </div>
        </div>

        <div className="tf-card">
          <div className="tf-cardhead"><span className="tf-cardtitle">Saisies du jour</span></div>
          <div className="tf-ticket">
            {saisies.length === 0 && (
              <p className="tf-empty">Aucune saisie aujourd'hui. Les données apparaissent ici dès que l'équipe enregistre.</p>
            )}
            {saisies.map((s, i) => (
              <div key={i} className="tf-ticket-row">
                <span>{s.label}</span>
                <span>{s.value}</span>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

function ilYA(joursAvant) {
  const dt = new Date();
  dt.setDate(dt.getDate() - joursAvant);
  return dt.toISOString().slice(0, 10);
}
