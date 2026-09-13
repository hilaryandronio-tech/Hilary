import { useEffect, useMemo, useRef, useState } from "react";
import Header from "../components/Header";
import { fmt, dLabel } from "../components/format";
import MoisSelector, { moisCourant, bornesMois, labelMois } from "../components/MoisSelector";
import { supabase } from "../lib/supabaseClient";
import { lectureCachee } from "../lib/cacheLecture";
import { onQueueChange } from "../lib/offlineQueue";
import { lireEffectifs } from "../lib/effectifs";

// Le livre de la provende : ce qui est entré, ce qui a été distribué et ce que
// ça coûte, vague par vague, jour par jour, sur un mois.
//
// Le chef de ferme voit son stock du soir, la direction voit une courbe et un
// coût global. Entre les deux, personne ne pouvait ouvrir un mois et suivre un
// bâtiment ligne à ligne — c'est pourtant ainsi que la feuille papier se lit,
// et le seul moyen de retrouver d'où vient un écart.

// Vérifié sur la feuille d'août 2026 : 167 kg distribués pour 3,34 sacs.
const SAC_KG = 50;

// Un calage se lit avec son sens : « −317 », signe moins et non trait d'union.
const signe = (kg) => (kg > 0 ? `+${fmt(kg)}` : `−${fmt(Math.abs(kg))}`);

export default function Provende() {
  const [mois, setMois] = useState(moisCourant());
  const [lots, setLots] = useState([]);
  const [saisies, setSaisies] = useState([]);
  const [livraisons, setLivraisons] = useState([]);
  const requete = useRef(0);

  useEffect(() => {
    lireEffectifs().then(({ lots: data }) => { if (data) setLots(data); });
  }, []);

  useEffect(() => {
    const jeton = ++requete.current;
    // Vider avant de recharger : sans ça le mois quitté reste affiché le temps
    // de la requête, et sur une connexion de ferme cela dure.
    setSaisies([]);
    setLivraisons([]);
    const [debut, fin] = bornesMois(mois);
    const charger = async () => {
      // La clé porte le mois : deux mois partageraient sinon le même cache,
      // et hors ligne on resservirait le mauvais.
      const [{ data: s }, { data: l }] = await Promise.all([
        lectureCachee(`provende:saisies:${mois}`, () =>
          supabase.from("saisies_ferme")
            .select("date, lot_id, provende_kg, prix_provende_kg")
            .gte("date", debut).lte("date", fin)),
        // `select("*")` et non la liste des colonnes : `motif` est arrivé par
        // une migration tardive (docs/15), et nommer une colonne absente fait
        // refuser toute la requête — l'écran serait vide sans dire pourquoi.
        lectureCachee(`provende:livraisons:${mois}`, () =>
          supabase.from("livraisons_provende").select("*")
            .gte("date", debut).lte("date", fin)),
      ]);
      if (jeton !== requete.current) return;
      if (s) setSaisies(s);
      if (l) setLivraisons(l);
    };
    charger();
    return onQueueChange(charger);
  }, [mois]);

  // Un jour par ligne et par vague : ce qui est entré ce jour-là, ce qui en est
  // sorti, et ce que les kilos sortis ont coûté. Le prix figé le soir de la
  // saisie fait foi ; à défaut — les lignes d'avant docs/09 — le tarif courant
  // du bâtiment, faute de mieux.
  const parVague = useMemo(() => {
    const tarifCourant = Object.fromEntries(lots.map((l) => [l.lot_id, l.prix_provende_kg]));
    const vagues = {};
    const jourDe = (lotId, date) => {
      const v = (vagues[lotId] ??= {});
      return (v[date] ??= { date, recu: 0, calage: 0, distribue: 0, cout: 0, aliments: [] });
    };

    saisies.forEach((s) => {
      const kg = Number(s.provende_kg ?? 0);
      if (!kg) return;
      const j = jourDe(s.lot_id, s.date);
      j.distribue += kg;
      j.cout += kg * Number(s.prix_provende_kg ?? tarifCourant[s.lot_id] ?? 0);
    });

    livraisons.forEach((v) => {
      const j = jourDe(v.lot_id, v.date);
      const kg = Number(v.sacs) * Number(v.poids_sac ?? SAC_KG);
      // Un calage après comptage n'est pas un arrivage : rien n'est entré au
      // magasin, on a seulement constaté que le compte était faux. Mêlé aux
      // livraisons, il ferait lire des sacs reçus qui n'ont jamais existé —
      // d'où sa colonne.
      if (v.motif) j.calage += kg;
      else {
        j.recu += kg;
        if (v.aliment && !j.aliments.includes(v.aliment)) j.aliments.push(v.aliment);
      }
    });

    // Décroissant : le plus récent en haut, comme sur les autres écrans.
    return Object.fromEntries(
      Object.entries(vagues).map(([lotId, jours]) => [
        lotId,
        Object.values(jours).sort((a, b) => b.date.localeCompare(a.date)),
      ])
    );
  }, [saisies, livraisons, lots]);

  const somme = (jours, champ) => jours.reduce((s, j) => s + j[champ], 0);

  // Les vagues de la base d'abord, dans l'ordre ; puis celles qui n'ont plus de
  // ligne dans `lots` mais qui ont consommé ce mois-là — un bâtiment arrêté ne
  // doit pas emporter son mois avec lui.
  const vagues = useMemo(() => {
    const connus = lots.map((l) => ({ id: l.lot_id, nom: l.nom }));
    const orphelins = Object.keys(parVague)
      .filter((id) => !connus.some((l) => l.id === id))
      .map((id) => ({ id, nom: null }));
    return [...connus, ...orphelins]
      .map((l) => ({ ...l, jours: parVague[l.id] ?? [] }))
      .filter((l) => l.jours.length > 0);
  }, [lots, parVague]);

  const totalRecu = vagues.reduce((s, v) => s + somme(v.jours, "recu"), 0);
  const totalCalage = vagues.reduce((s, v) => s + somme(v.jours, "calage"), 0);
  const totalDistribue = vagues.reduce((s, v) => s + somme(v.jours, "distribue"), 0);
  const totalCout = vagues.reduce((s, v) => s + somme(v.jours, "cout"), 0);

  return (
    <div className="tf">
      <Header />
      <main className="tf-body">
        <p className="tf-eyebrow">Provende</p>
        <h1 className="tf-h1">Le mois, vague par vague</h1>
        <p className="tf-sub">
          Chaque jour de chaque bâtiment : les sacs reçus, les kilos distribués et ce qu'ils
          coûtent. Les totaux du mois sont en bas.
        </p>

        <MoisSelector mois={mois} onChange={setMois} />

        <div className="tf-kpis">
          <div className="tf-kpi" data-hero="1">
            <div className="tf-kpi-n">{fmt(totalDistribue)}</div>
            <div className="tf-kpi-l">kg distribués en {labelMois(mois)}</div>
          </div>
          <div className="tf-kpi">
            <div className="tf-kpi-n">{fmt(totalCout)}</div>
            <div className="tf-kpi-l">Ar de provende consommée</div>
          </div>
          <div className="tf-kpi">
            <div className="tf-kpi-n">{fmt(totalRecu / SAC_KG)}</div>
            <div className="tf-kpi-l">sacs reçus · {fmt(totalRecu)} kg</div>
          </div>
          <div className="tf-kpi" data-alert={totalCalage ? 1 : 0}>
            <div className="tf-kpi-n">{totalCalage ? signe(totalCalage) : "0"}</div>
            <div className="tf-kpi-l">kg de calage après comptage</div>
          </div>
        </div>

        {vagues.length === 0 && (
          <div className="tf-card">
            <p className="tf-empty">Aucune provende reçue ni distribuée en {labelMois(mois)}.</p>
          </div>
        )}

        {vagues.map((v) => {
          const recu = somme(v.jours, "recu");
          const calage = somme(v.jours, "calage");
          const distribue = somme(v.jours, "distribue");
          const cout = somme(v.jours, "cout");
          return (
            <div className="tf-card" key={v.id}>
              <div className="tf-cardhead">
                <span className="tf-cardtitle">{v.id}{v.nom ? ` · ${v.nom}` : ""}</span>
                <span className="tf-tag">{fmt(distribue)} KG · {fmt(cout)} AR</span>
              </div>
              <div className="tf-releve-cadre" data-long="1">
                <table className="tf-releve">
                  <thead>
                    <tr>
                      <th>Jour</th>
                      <th>Reçu</th>
                      <th>Calage</th>
                      <th>Distribué</th>
                      <th>Coût</th>
                    </tr>
                  </thead>
                  <tbody>
                    {v.jours.map((j) => (
                      <tr key={j.date}>
                        <th>{dLabel(j.date)}</th>
                        <td>
                          {j.recu ? fmt(j.recu) : "—"}
                          {j.aliments.length > 0 && <span className="tf-sous">{j.aliments.join(" · ")}</span>}
                        </td>
                        <td data-alerte={j.calage ? 1 : 0}>{j.calage ? signe(j.calage) : "—"}</td>
                        <td>{j.distribue ? fmt(j.distribue) : "—"}</td>
                        <td>{j.cout ? fmt(j.cout) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <th>Total {v.id}</th>
                      <td>{fmt(recu)}</td>
                      <td>{calage ? signe(calage) : "—"}</td>
                      <td>{fmt(distribue)}</td>
                      <td>{fmt(cout)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          );
        })}

        {vagues.length > 0 && (
          <div className="tf-card">
            <div className="tf-cardhead">
              <span className="tf-cardtitle">Totaux du mois</span>
              <span className="tf-tag">{labelMois(mois).toUpperCase()}</span>
            </div>
            <div className="tf-releve-cadre">
              <table className="tf-releve">
                <thead>
                  <tr>
                    <th>Vague</th>
                    <th>Reçu</th>
                    <th>Calage</th>
                    <th>Distribué</th>
                    <th>Prix moyen</th>
                    <th>Coût</th>
                  </tr>
                </thead>
                <tbody>
                  {vagues.map((v) => {
                    const calage = somme(v.jours, "calage");
                    const distribue = somme(v.jours, "distribue");
                    const cout = somme(v.jours, "cout");
                    return (
                      <tr key={v.id}>
                        <th>
                          {v.id}
                          {v.nom && <span className="tf-sous">{v.nom}</span>}
                        </th>
                        <td>{fmt(somme(v.jours, "recu"))}</td>
                        <td data-alerte={calage ? 1 : 0}>{calage ? signe(calage) : "—"}</td>
                        <td>{fmt(distribue)}</td>
                        {/* Le prix moyen du mois, pas le tarif du jour : une
                            hausse en cours de mois se lit ici, entre les deux. */}
                        <td>{distribue ? `${fmt(cout / distribue)} Ar` : "—"}</td>
                        <td>{fmt(cout)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <th>Les {vagues.length} vagues</th>
                    <td>{fmt(totalRecu)}</td>
                    <td>{totalCalage ? signe(totalCalage) : "—"}</td>
                    <td>{fmt(totalDistribue)}</td>
                    <td>{totalDistribue ? `${fmt(totalCout / totalDistribue)} Ar` : "—"}</td>
                    <td>{fmt(totalCout)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <p className="tf-note">
              Tout est en kilos, le sac à {SAC_KG} kg. « Reçu » ne compte que les arrivages ; un
              calage est un écart constaté au comptage des sacs, pas de la provende entrée. Le coût
              retient le prix figé le soir de la saisie : une hausse du fournisseur ne réécrit pas
              les mois passés.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
