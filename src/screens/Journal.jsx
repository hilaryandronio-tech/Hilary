import { useEffect, useState } from "react";
import Header from "../components/Header";
import { fmt, dLabel, today } from "../components/format";
import MoisSelector, { moisCourant, bornesMois, labelMois } from "../components/MoisSelector";
import { supabase } from "../lib/supabaseClient";
import { lectureCachee } from "../lib/cacheLecture";

// Le tableau de bord ne montre que le jour même : impossible d'y voir qu'une
// journée manque, ni qu'une recette a décroché avant-hier. Ce journal reprend
// v_journalier, la vue qui agrège déjà tout par date.

export default function Journal() {
  const [lignes, setLignes] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [mois, setMois] = useState(moisCourant());

  useEffect(() => {
    // Vider avant de recharger : sans ça le mois quitté reste affiché le temps
    // de la requête, et sur une connexion de ferme cela dure.
    setLignes([]);
    setChargement(true);
    const [debut, fin] = bornesMois(mois);
    // La clé porte le mois : deux mois partageraient sinon le même cache, et
    // hors ligne on resservirait le mauvais.
    lectureCachee(`v_journalier:journal:${mois}`, () =>
      supabase
        .from("v_journalier")
        .select("date, oeufs, mortalite, encaisse, livre_credit, charges, poules_en_ponte")
        .gte("date", debut)
        .lte("date", fin)
        .order("date", { ascending: false })
    ).then(({ data }) => {
      setChargement(false);
      if (data) setLignes(data);
    });
  }, [mois]);

  const somme = (champ) => lignes.reduce((s, l) => s + Number(l[champ] ?? 0), 0);
  const jour = today();

  return (
    <div className="tf">
      <Header />
      <main className="tf-body">
        <p className="tf-eyebrow">Journal</p>
        <h1 className="tf-h1">Mois par mois</h1>
        <p className="tf-sub">
          Une ligne par journée, la plus récente en haut. Un jour absent de cette liste n'a reçu
          aucune saisie. Rien n'est archivé : les mois passés sont à une flèche de là.
        </p>

        <MoisSelector mois={mois} onChange={setMois} />

        {chargement && (
          <div className="tf-card"><p className="tf-empty">Chargement…</p></div>
        )}

        {!chargement && lignes.length === 0 && (
          <div className="tf-card">
            <p className="tf-empty">Aucune saisie en {labelMois(mois)}.</p>
          </div>
        )}

        {lignes.length > 0 && (
          <div className="tf-card">
            <div className="tf-cardhead">
              <span className="tf-cardtitle">Journée par journée</span>
              <span className="tf-tag">{labelMois(mois).toUpperCase()}</span>
            </div>
            <div className="tf-releve-cadre" data-long="1">
              <table className="tf-releve">
                <thead>
                  <tr>
                    <th>Jour</th>
                    <th>Œufs</th>
                    <th>Taux</th>
                    <th>Encaissé</th>
                    <th>Charges</th>
                    <th>Morts</th>
                  </tr>
                </thead>
                <tbody>
                  {lignes.map((l) => {
                    const taux = l.poules_en_ponte ? (l.oeufs / l.poules_en_ponte) * 100 : 0;
                    return (
                      <tr key={l.date}>
                        <th>
                          {dLabel(l.date)}
                          {l.date === jour && <span className="tf-sous">aujourd'hui</span>}
                        </th>
                        <td>{fmt(l.oeufs)}</td>
                        <td>{l.oeufs && l.poules_en_ponte ? `${taux.toFixed(0)} %` : "—"}</td>
                        <td>{fmt(l.encaisse)}</td>
                        <td data-alerte={l.charges > l.encaisse && l.encaisse ? 1 : 0}>{fmt(l.charges)}</td>
                        <td data-alerte={l.mortalite > 0 ? 1 : 0}>{fmt(l.mortalite)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <th>Total</th>
                    <td>{fmt(somme("oeufs"))}</td>
                    <td>—</td>
                    <td>{fmt(somme("encaisse"))}</td>
                    <td>{fmt(somme("charges"))}</td>
                    <td>{fmt(somme("mortalite"))}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <p className="tf-note">
              Fais défiler la liste. Les charges ressortent en brique le jour où elles dépassent
              l'encaissé, et toute mortalité non nulle est signalée.
              Le <strong>taux de ponte</strong> des jours passés est rapporté au cheptel
              d'aujourd'hui : après une forte mortalité, les taux anciens paraissent plus élevés
              qu'ils ne l'étaient.
            </p>
          </div>
        )}

        <div className="tf-card">
          <div className="tf-cardhead">
            <span className="tf-cardtitle">Total du mois</span>
            <span className="tf-tag">{lignes.length} JOUR(S)</span>
          </div>
          <div className="tf-ticket">
            <div className="tf-ticket-row">
              <span>Livré à crédit</span>
              <span>{fmt(somme("livre_credit"))} Ar</span>
            </div>
            <div className="tf-ticket-row">
              <span>Encaissé</span>
              <span>{fmt(somme("encaisse"))} Ar</span>
            </div>
            <div className="tf-ticket-row">
              <span style={{ fontWeight: 600 }}>Encaissé moins charges</span>
              <span style={{ fontWeight: 600 }}>
                {fmt(somme("encaisse") - somme("charges"))} Ar
              </span>
            </div>
          </div>
          <p className="tf-note">
            Ce solde ne vaut pas bénéfice : il ignore la provende et l'amortissement des poulettes,
            qui pèsent l'essentiel du coût d'un œuf. Pour le résultat réel, va au Bilan.
          </p>
        </div>
      </main>
    </div>
  );
}
