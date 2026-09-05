import { useEffect, useMemo, useState } from "react";
import Header from "../components/Header";
import Courbe, { COURBE_OR, COURBE_BLEU } from "../components/Courbe";
import { fmt, dLabel, today } from "../components/format";
import { supabase } from "../lib/supabaseClient";
import { lectureCachee } from "../lib/cacheLecture";

const zeroJour = {
  oeufs: 0, valeur_collecte: 0, mortalite: 0, provende_kg: 0,
  encaisse: 0, livre_credit: 0, charges: 0, poules_en_ponte: 0,
};

export default function Direction() {
  const [jour, setJour] = useState(zeroJour);
  const [cheptel, setCheptel] = useState(0);
  const [creanceTotale, setCreanceTotale] = useState(0);
  const [saisies, setSaisies] = useState([]);
  const [lots, setLots] = useState([]);
  const [ponteParLot, setPonteParLot] = useState({});
  const [serie, setSerie] = useState([]);        // v_journalier sur la période
  const [periode, setPeriode] = useState(30);
  const [params, setParams] = useState({ cout_poulette: 0, duree_ponte_sem: 52 });

  useEffect(() => {
    (async () => {
      const [{ data: jrs }, { data: eff }, { data: creances }] = await Promise.all([
        supabase.from("v_journalier").select("*").eq("date", today()).maybeSingle(),
        supabase.from("v_effectif").select("lot_id, nom, en_ponte, vivant"),
        supabase.from("v_creances").select("montant"),
      ]);
      if (jrs) setJour(jrs);
      setCheptel((eff ?? []).reduce((s, l) => s + l.vivant, 0));
      setLots([...(eff ?? [])].sort((a, b) => a.lot_id.localeCompare(b.lot_id)));
      setCreanceTotale((creances ?? []).reduce((s, c) => s + c.montant, 0));

      const [{ data: ferme }, { data: pontes }, { data: ventes }, { data: charges }] = await Promise.all([
        supabase.from("saisies_ferme").select("lot_id, provende_kg, mortalite").eq("date", today()),
        supabase.from("pontes").select("id, lot_id, ponte_lignes(oeufs)").eq("date", today()),
        supabase.from("ventes").select("canal, montant, credit, clients(nom)").eq("date", today()),
        supabase.from("charges").select("categorie, montant").eq("date", today()),
      ]);

      // Œufs du jour par bâtiment, pour le taux de ponte de chaque vague : le
      // taux global masque un bâtiment qui décroche.
      setPonteParLot(
        Object.fromEntries(
          (pontes ?? []).map((p) => [
            p.lot_id,
            (p.ponte_lignes ?? []).reduce((s, l) => s + l.oeufs, 0),
          ])
        )
      );

      const [{ data: jours }, { data: parametres }] = await Promise.all([
        lectureCachee("v_journalier:graphiques", () =>
          supabase
            .from("v_journalier")
            .select("date, oeufs, provende_kg, cout_provende, encaisse, livre_credit, charges, poules_en_ponte")
            .order("date", { ascending: false })
            .limit(90)
        ),
        lectureCachee("parametres", () => supabase.from("parametres").select("cle, valeur")),
      ]);
      if (jours) setSerie([...jours].sort((a, b) => a.date.localeCompare(b.date)));
      if (parametres) {
        setParams(Object.fromEntries(parametres.map((p) => [p.cle, Number(p.valeur)])));
      }

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

  // Les trois graphiques partagent la même fenêtre et les mêmes journées.
  const fenetre = useMemo(() => serie.slice(-periode), [serie, periode]);
  const etiquettes = fenetre.map((j) => dLabel(j.date));

  const graphiques = useMemo(() => {
    // Amortissement quotidien d'une poulette, comme au Bilan : l'achat et
    // l'élevage étalés sur la durée de ponte prévue.
    const parPouleParJour = params.duree_ponte_sem
      ? params.cout_poulette / (params.duree_ponte_sem * 7)
      : 0;
    const ca = fenetre.map((j) => Number(j.encaisse ?? 0) + Number(j.livre_credit ?? 0));
    const benefice = fenetre.map((j, i) => {
      const amortissement = parPouleParJour * Number(j.poules_en_ponte ?? 0);
      return ca[i] - Number(j.charges ?? 0) - Number(j.cout_provende ?? 0) - amortissement;
    });
    return {
      ca,
      benefice,
      // Une journée sans collecte n'est pas une ponte nulle : elle n'est pas
      // encore saisie. On coupe la courbe plutôt que de la faire plonger.
      taux: fenetre.map((j) =>
        j.oeufs && j.poules_en_ponte ? (j.oeufs / j.poules_en_ponte) * 100 : null
      ),
      provende: fenetre.map((j) => (j.provende_kg ? Number(j.provende_kg) : null)),
    };
  }, [fenetre, params]);

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
            <span className="tf-cardtitle">Taux de ponte par bâtiment</span>
            <span className="tf-tag">AUJOURD'HUI</span>
          </div>
          <div className="tf-releve-cadre">
            <table className="tf-releve">
              <thead>
                <tr>
                  <th>Bâtiment</th>
                  <th>Œufs</th>
                  <th>Poules</th>
                  <th>Taux</th>
                </tr>
              </thead>
              <tbody>
                {lots.map((l) => {
                  const oeufs = ponteParLot[l.lot_id];
                  const saisi = oeufs !== undefined;
                  // Deux raisons de ne pas afficher de taux, et aucune n'est
                  // une mauvaise ponte : un bâtiment en poulettes ne pond pas
                  // encore, et une fiche pas encore saisie n'est pas une
                  // collecte nulle. Dans les deux cas « 0,0 % » ferait
                  // chercher un problème qui n'existe pas.
                  const affichable = l.en_ponte && saisi && l.vivant;
                  return (
                    <tr key={l.lot_id}>
                      <th>
                        {l.lot_id}
                        <span className="tf-sous">
                          {l.en_ponte ? (saisi ? "en ponte" : "pas encore saisi") : "poulettes"}
                        </span>
                      </th>
                      <td>{saisi ? fmt(oeufs) : "—"}</td>
                      <td>{fmt(l.vivant)}</td>
                      <td>{affichable ? `${((oeufs / l.vivant) * 100).toFixed(1)} %` : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="tf-note">
            Le taux global masque un bâtiment qui décroche : c'est ici qu'un écart entre deux vagues
            se voit. Les cassés y comptent, la poule les a pondus.
          </p>
        </div>

        <div className="tf-chips">
          {[7, 30, 90].map((p) => (
            <button key={p} className="tf-chip" data-on={periode === p ? 1 : 0}
              onClick={() => setPeriode(p)}>{p} jours</button>
          ))}
        </div>

        {/* Deux par deux sur ordinateur, empilées sur téléphone. */}
        <div className="tf-courbes">
          <div className="tf-card">
            <div className="tf-cardhead">
              <span className="tf-cardtitle">Chiffre d'affaires et bénéfice</span>
              <span className="tf-tag">EN ARIARY</span>
            </div>
            <Courbe
              labels={etiquettes}
              series={[
                { nom: "Chiffre d'affaires", couleur: COURBE_OR, valeurs: graphiques.ca },
                { nom: "Bénéfice", couleur: COURBE_BLEU, valeurs: graphiques.benefice },
              ]}
              format={(n) => `${fmt(n)} Ar`}
            />
            <p className="tf-note">
              Le chiffre d'affaires compte les ventes du jour, encaissées ou à crédit. Le bénéfice en
              retire les charges saisies, la provende au prix de chaque bâtiment et l'amortissement
              des poulettes — l'écart entre les deux courbes, c'est le coût de la journée.
              {!params.cout_poulette && " Renseigne le coût d'une poulette au Bilan, sans lui l'amortissement est nul et le bénéfice trop beau."}
            </p>
          </div>
  
          <div className="tf-card">
            <div className="tf-cardhead">
              <span className="tf-cardtitle">Taux de ponte</span>
              <span className="tf-tag">TOUS BÂTIMENTS</span>
            </div>
            <Courbe
              labels={etiquettes}
              unite=" %"
              format={(n) => n.toFixed(1)}
              zeroDansLeCadre={false}
              repere={{ valeur: 90, nom: "objectif 90 %" }}
              series={[{ nom: "Taux de ponte", couleur: COURBE_OR, valeurs: graphiques.taux }]}
            />
            <p className="tf-note">
              La courbe s'interrompt les jours sans fiche de ponte : une collecte non saisie n'est pas
              une ponte nulle. Le taux rapporte les œufs au cheptel d'aujourd'hui, donc les valeurs
              anciennes paraissent un peu hautes après une forte mortalité.
            </p>
          </div>
  
          <div className="tf-card">
            <div className="tf-cardhead">
              <span className="tf-cardtitle">Provende distribuée</span>
              <span className="tf-tag">EN KILOS</span>
            </div>
            <Courbe
              labels={etiquettes}
              unite=" kg"
              format={(n) => fmt(n)}
              zeroDansLeCadre={false}
              series={[{ nom: "Provende", couleur: COURBE_BLEU, valeurs: graphiques.provende }]}
            />
            <p className="tf-note">
              Tous bâtiments confondus. Une ration qui décroche d'un jour à l'autre signale plus
              souvent une saisie oubliée qu'un vrai changement — l'écran Ferme donne le détail par
              bâtiment, en grammes par poule.
            </p>
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

