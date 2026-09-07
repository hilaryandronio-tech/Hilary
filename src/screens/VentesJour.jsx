import { useEffect, useMemo, useState } from "react";
import Header from "../components/Header";
import { fmt, dLabel } from "../components/format";
import { POIDS } from "../data/constants";
import { supabase } from "../lib/supabaseClient";
import { lectureCachee } from "../lib/cacheLecture";
import { onQueueChange } from "../lib/offlineQueue";

// Ce qui est sorti du magasin, jour par jour, avec le calibre et le prix.
//
// La caisse montre la journée en cours, le stock montre des totaux. Ni l'un
// ni l'autre ne dit à quel prix les œufs sont partis, ni ne permet de
// remonter deux semaines en arrière pour retrouver une livraison. C'est ce
// que cet écran fait, et rien d'autre : il ne saisit rien, il regarde.

const libelle = (c) => (c === "CASSE" ? "Cassés" : c);
const FENETRES = [
  { v: 7, l: "7 jours" },
  { v: 30, l: "30 jours" },
  { v: 90, l: "90 jours" },
  { v: 0, l: "Tout" },
];

export default function VentesJour() {
  const [lignes, setLignes] = useState([]);
  const [sansDetail, setSansDetail] = useState([]);
  const [fenetre, setFenetre] = useState(30);

  useEffect(() => {
    const charger = async () => {
      const [{ data }, { data: globales }] = await Promise.all([
        lectureCachee("v_ventes_jour_calibre", () =>
          supabase.from("v_ventes_jour_calibre").select("*")
            .order("date", { ascending: false }).order("ordre").limit(3000)),
        lectureCachee("v_ventes_jour_sans_detail", () =>
          supabase.from("v_ventes_jour_sans_detail").select("*")
            .order("date", { ascending: false }).limit(400)),
      ]);
      if (data) setLignes(data);
      if (globales) setSansDetail(globales);
    };
    charger();
    // Une vente enregistrée sur ce téléphone doit apparaître ici sans
    // attendre le réseau — mais elle passe par les vues, donc par le
    // serveur. On relit à chaque mouvement de la file : dès qu'elle est
    // partie, la journée se complète.
    return onQueueChange(charger);
  }, []);

  const globalesParJour = useMemo(
    () => Object.fromEntries(sansDetail.map((g) => [g.date, g])),
    [sansDetail]
  );

  // Les lignes arrivent déjà triées par date décroissante puis par ordre de
  // calibre : une Map suffit à les regrouper sans retrier.
  const jours = useMemo(() => {
    const parDate = new Map();
    lignes.forEach((l) => {
      if (!parDate.has(l.date)) parDate.set(l.date, []);
      parDate.get(l.date).push(l);
    });
    return [...parDate.entries()].map(([date, rangs]) => ({
      date,
      rangs,
      oeufs: rangs.reduce((s, r) => s + Number(r.oeufs), 0),
      montant: rangs.reduce((s, r) => s + Number(r.montant), 0),
    }));
  }, [lignes]);

  const vus = fenetre ? jours.slice(0, fenetre) : jours;
  const totalOeufs = vus.reduce((s, j) => s + j.oeufs, 0);
  const totalMontant = vus.reduce((s, j) => s + j.montant, 0);
  // Un jour sans vente n'a pas de ligne : la moyenne porte sur les journées
  // où il s'est passé quelque chose, pas sur le calendrier.
  const moyenne = vus.length ? Math.round(totalOeufs / vus.length) : 0;

  return (
    <div className="tf">
      <Header />
      <main className="tf-body">
        <p className="tf-eyebrow">Sorties</p>
        <h1 className="tf-h1">Œufs vendus par jour</h1>
        <p className="tf-sub">
          Chaque journée, calibre par calibre, avec le prix auquel les œufs sont partis.
        </p>

        <div className="tf-chips">
          {FENETRES.map((f) => (
            <button key={f.v} className="tf-chip" data-on={fenetre === f.v ? 1 : 0}
              onClick={() => setFenetre(f.v)}>{f.l}</button>
          ))}
        </div>

        <div className="tf-kpis">
          <div className="tf-kpi" data-hero="1">
            <div className="tf-kpi-n">{fmt(totalOeufs)}</div>
            <div className="tf-kpi-l">
              œufs vendus sur {vus.length} journée{vus.length > 1 ? "s" : ""}
            </div>
          </div>
          <div className="tf-kpi">
            <div className="tf-kpi-n">{fmt(totalMontant)}</div>
            <div className="tf-kpi-l">Ar de ventes détaillées</div>
          </div>
          <div className="tf-kpi">
            <div className="tf-kpi-n">{fmt(moyenne)}</div>
            <div className="tf-kpi-l">œufs par journée vendue</div>
          </div>
        </div>

        {jours.length === 0 && (
          <div className="tf-card">
            <p className="tf-empty">
              Aucune vente détaillée par calibre. Les ventes saisies en montant global
              n'apparaissent pas ici — elles ne portent pas de calibre.
            </p>
          </div>
        )}

        {vus.map((j) => {
          const globale = globalesParJour[j.date];
          return (
            <div className="tf-card" key={j.date}>
              <div className="tf-cardhead">
                <span className="tf-cardtitle">{dLabel(j.date)}</span>
                <span className="tf-tag">{fmt(j.oeufs)} ŒUFS · {fmt(j.montant)} AR</span>
              </div>
              <div className="tf-releve-cadre">
                <table className="tf-releve">
                  <thead>
                    <tr>
                      <th>Calibre</th>
                      <th>Œufs</th>
                      <th>Prix</th>
                      <th>Montant</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Un même calibre peut revenir deux fois dans la journée,
                        à deux prix : un client à tarif négocié et un autre au
                        prix de base. C'est voulu — une moyenne effacerait
                        justement ce qu'on vient regarder. */}
                    {j.rangs.map((r) => (
                      <tr key={`${r.calibre}-${r.prix_unit}`}>
                        <th>
                          {libelle(r.calibre)}
                          <span className="tf-sous">{POIDS[r.calibre]}</span>
                        </th>
                        <td>{fmt(r.oeufs)}</td>
                        <td>{fmt(r.prix_unit)} Ar</td>
                        <td>{fmt(r.montant)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <th>Total</th>
                      <td>{fmt(j.oeufs)}</td>
                      <td />
                      <td>{fmt(j.montant)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              {globale && (
                <p className="tf-note">
                  En plus : {globale.ventes} encaissement{globale.ventes > 1 ? "s" : ""} saisi
                  {globale.ventes > 1 ? "s" : ""} en montant global ({fmt(globale.montant)} Ar), sans
                  détail par calibre. Ces œufs-là ne sont pas comptés ci-dessus.
                </p>
              )}
            </div>
          );
        })}

        {jours.length > vus.length && (
          <p className="tf-note">
            {jours.length - vus.length} journée{jours.length - vus.length > 1 ? "s" : ""} plus
            ancienne{jours.length - vus.length > 1 ? "s" : ""} — choisis une fenêtre plus large
            pour les voir.
          </p>
        )}
      </main>
    </div>
  );
}
