import { useEffect, useState } from "react";
import Header from "../components/Header";
import NumField from "../components/NumField";
import Keypad from "../components/Keypad";
import Cheptel from "../components/Cheptel";
import { fmt, today } from "../components/format";
import { supabase } from "../lib/supabaseClient";
import { enqueue } from "../lib/offlineQueue";

// CA = Σ ventes.montant à la date de vente, qu'elles soient encaissées ou à
// crédit (docs/03-brief-technique.md section 3) — pas la date d'encaissement,
// donc on somme directement `ventes`, pas les colonnes trésorerie de
// v_journalier. Le reste (œufs, provende, charges, cheptel) vient des vues.
export default function Bilan() {
  const [periode, setPeriode] = useState("mois");
  const [params, setParams] = useState({ prix_provende_kg: 0, cout_poulette: 0, duree_ponte_sem: 52 });
  const [agg, setAgg] = useState({ ca: 0, oeufs: 0, provendeKg: 0, coutProvende: 0, chargesSaisies: 0, enPonte: 0 });
  const [pad, setPad] = useState(null);

  const from = () => {
    if (periode === "mois") return today().slice(0, 7) + "-01";
    const dt = new Date();
    dt.setDate(dt.getDate() - (Number(periode) - 1));
    return dt.toISOString().slice(0, 10);
  };
  const jours = Math.round((new Date(today()) - new Date(from())) / 86400000) + 1;

  const charger = async () => {
    const debut = from();

    const { data: paramRows } = await supabase.from("parametres").select("cle, valeur");
    if (paramRows) {
      setParams(Object.fromEntries(paramRows.map((p) => [p.cle, Number(p.valeur)])));
    }

    const { data: ventes } = await supabase.from("ventes").select("montant").gte("date", debut);
    const ca = (ventes ?? []).reduce((s, v) => s + v.montant, 0);

    const { data: jrs } = await supabase
      .from("v_journalier")
      .select("oeufs, provende_kg, cout_provende, charges, poules_en_ponte")
      .gte("date", debut);
    const oeufs = (jrs ?? []).reduce((s, j) => s + j.oeufs, 0);
    const provendeKg = (jrs ?? []).reduce((s, j) => s + j.provende_kg, 0);
    // Le coût vient de la vue, pas d'une multiplication ici : chaque saisie
    // porte le prix de son bâtiment, et les vagues n'ont pas le même tarif.
    const coutProvende = (jrs ?? []).reduce((s, j) => s + Number(j.cout_provende ?? 0), 0);
    const chargesSaisies = (jrs ?? []).reduce((s, j) => s + j.charges, 0);
    const enPonte = jrs?.[0]?.poules_en_ponte ?? 0;

    setAgg({ ca, oeufs, provendeKg, coutProvende, chargesSaisies, enPonte });
  };

  useEffect(() => {
    charger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periode]);

  const setParam = async (cle, valeur) => {
    setParams((p) => ({ ...p, [cle]: valeur }));
    await enqueue({ table: "parametres", kind: "update", payload: { valeur, maj: new Date().toISOString() }, match: { cle } });
  };

  const coutProvende = agg.coutProvende;
  const amortissement = (params.cout_poulette / (params.duree_ponte_sem * 7)) * agg.enPonte * jours;
  const total = agg.chargesSaisies + coutProvende + amortissement;
  const benefice = agg.ca - total;
  const revient = agg.oeufs ? total / agg.oeufs : 0;
  const prixMoyen = agg.oeufs ? agg.ca / agg.oeufs : 0;
  // Le prix de la provende est désormais porté par chaque bâtiment (carte
  // Cheptel) : il ne peut plus manquer globalement. Reste le coût d'une
  // poulette, sans lequel l'amortissement — donc le bénéfice — est faux.
  const manquant = !params.cout_poulette;

  const lignes = [
    ["Provende", coutProvende],
    ["Amortissement poulettes", amortissement],
    ["Charges saisies", agg.chargesSaisies],
  ];

  return (
    <div className="tf">
      <Header />
      <main className="tf-body">
        <p className="tf-eyebrow">Compte de résultat</p>
        <h1 className="tf-h1">Chiffre d'affaires et bénéfice</h1>
        <p className="tf-sub">Production valorisée, charges complètes, résultat sur la période.</p>

        <div className="tf-chips">
          {[["7", "7 jours"], ["30", "30 jours"], ["mois", "Mois en cours"]].map(([k, l]) => (
            <button key={k} className="tf-chip" data-on={periode === k ? 1 : 0} onClick={() => setPeriode(k)}>{l}</button>
          ))}
        </div>

        {manquant && (
          <div className="tf-card" style={{ borderLeft: "4px solid var(--brick)" }}>
            <p className="tf-empty">
              Renseigne le coût d'une poulette plus bas — sans ce chiffre, l'amortissement est nul
              et le bénéfice affiché est faux.
            </p>
          </div>
        )}

        <div className="tf-kpis">
          <div className="tf-kpi" data-hero="1">
            <div className="tf-kpi-n">{fmt(agg.ca)}</div>
            <div className="tf-kpi-l">Chiffre d'affaires (Ar) · {jours} jours · {fmt(agg.oeufs)} œufs</div>
          </div>
          <div className="tf-kpi" data-hero="1" data-alert={benefice < 0 ? 1 : 0}>
            <div className="tf-kpi-n">{fmt(benefice)}</div>
            <div className="tf-kpi-l">Bénéfice (Ar) — CA moins toutes les charges</div>
          </div>
          <div className="tf-kpi">
            <div className="tf-kpi-n">{revient.toFixed(0)}</div>
            <div className="tf-kpi-l">Prix de revient par œuf (Ar)</div>
          </div>
          <div className="tf-kpi" data-alert={prixMoyen && prixMoyen < revient ? 1 : 0}>
            <div className="tf-kpi-n">{(prixMoyen - revient).toFixed(0)}</div>
            <div className="tf-kpi-l">Marge par œuf (Ar)</div>
          </div>
        </div>

        <div className="tf-card">
          <div className="tf-cardhead">
            <span className="tf-cardtitle">Détail des charges</span>
            <span className="tf-tag">{fmt(total)} AR</span>
          </div>
          <div className="tf-ticket">
            {lignes.map(([l, n]) => (
              <div className="tf-ticket-row" key={l}>
                <span>{l}</span>
                <span>{fmt(n)} Ar · {total ? Math.round((n / total) * 100) : 0} %</span>
              </div>
            ))}
          </div>
          <p className="tf-note">
            La provende et l'amortissement des poulettes pèsent normalement 75 à 85 % du coût d'un œuf.
            Si tes charges saisies dépassent 25 %, il y a une fuite à chercher.
          </p>
        </div>

        <Cheptel />

        <div className="tf-card">
          <div className="tf-cardhead"><span className="tf-cardtitle">Paramètres de coût</span></div>
          <div className="tf-fields">
            <NumField label="Coût d'une poulette à l'entrée en ponte" unit="Ar" value={params.cout_poulette}
              onOpen={() => setPad({ key: "cout_poulette", label: "Coût d'une poulette", unit: "Ar", value: params.cout_poulette })} />
            <NumField label="Durée de ponte prévue" unit="semaines" value={params.duree_ponte_sem}
              onOpen={() => setPad({ key: "duree_ponte_sem", label: "Durée de ponte", unit: "sem", value: params.duree_ponte_sem })} />
          </div>
          <p className="tf-note">
            Achat de la poulette + élevage jusqu'à la ponte, étalé sur la durée de ponte.
            Le prix de la provende, lui, se règle bâtiment par bâtiment dans la carte Cheptel :
            les vagues n'ont pas le même aliment ni le même tarif.
          </p>
        </div>
      </main>

      <Keypad
        field={pad}
        onChange={(v) => { setParam(pad.key, v); setPad({ ...pad, value: v }); }}
        onClose={() => setPad(null)}
      />
    </div>
  );
}
