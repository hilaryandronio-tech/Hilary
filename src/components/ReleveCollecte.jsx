import { useEffect, useMemo, useRef, useState } from "react";
import { fmt, today, dLabel } from "./format";
import { CALIBRES, POIDS } from "../data/constants";
import { supabase } from "../lib/supabaseClient";
import { onQueueChange, operationsEnAttente } from "../lib/offlineQueue";
import { lectureCachee } from "../lib/cacheLecture";
import AlerteEchecs from "./AlerteEchecs";

const TABLES = ["pontes", "ponte_lignes"];

// Le relevé de la collecte d'une journée, calibre par calibre et bâtiment par
// bâtiment. Sert à deux endroits et doit y dire exactement la même chose : la
// magasinière le lit pour vérifier ce qu'elle vient de saisir, le point de
// vente pour savoir ce qu'il a en stock à vendre.

// Les cassés se vendent à part, à 500 Ar : ils comptent dans le total au même
// titre qu'un calibre. Les deux autres sorts figurent sous le total, hors de
// celui-ci — les sales sont nettoyés puis vendus, donc déjà comptés dans leur
// calibre, et les perdus ne sont pas de la production.
const LIGNES = [...CALIBRES, "CASSE"];
const libelle = (c) => (c === "CASSE" ? "Cassés" : c);
const vide = () => ({ sales: 0, perdus: 0 });

export default function ReleveCollecte({ date, lots }) {
  // Ce qui est collecté ce jour-là vient de deux sources qu'il faut réunir :
  //   - `serveur` : ce que Supabase a enregistré ;
  //   - `file`    : ce qui est saisi mais attend la synchro.
  // Ignorer la seconde, c'est afficher un total qui ne bouge pas quand la
  // magasinière vient d'enregistrer hors ligne.
  const [serveur, setServeur] = useState({}); // { [lot_id]: { [calibre]: oeufs } }
  const [file, setFile] = useState({});
  // Sales et perdus vivent sur l'en-tête de la fiche, pas dans les lignes de
  // calibre : ils sont donc suivis à part.
  const [degatsServeur, setDegatsServeur] = useState({});
  const [degatsFile, setDegatsFile] = useState({});
  const requete = useRef(0);

  const chargerServeur = async (jeton) => {
    // Une clé par jour : le relevé de la veille reste lisible au poulailler
    // même sans réseau.
    const { data } = await lectureCachee(`pontes:${date}`, () =>
      supabase
        .from("pontes")
        .select("lot_id, oeufs_sales, oeufs_perdus, ponte_lignes(calibre, oeufs)")
        .eq("date", date)
        .not("lot_id", "is", null)
    );
    // Deux requêtes lancées coup sur coup peuvent revenir dans le désordre :
    // seule la dernière demandée a le droit d'écrire dans l'état.
    if (jeton !== requete.current) return;
    if (!data) return; // jamais chargé et hors ligne
    const parLot = {};
    const degats = {};
    data.forEach((p) => {
      const lignes = (parLot[p.lot_id] ??= {});
      (p.ponte_lignes ?? []).forEach((l) => {
        lignes[l.calibre] = (lignes[l.calibre] ?? 0) + l.oeufs;
      });
      const d = (degats[p.lot_id] ??= vide());
      d.sales += p.oeufs_sales ?? 0;
      d.perdus += p.oeufs_perdus ?? 0;
    });
    setServeur(parLot);
    setDegatsServeur(degats);
  };

  const chargerFile = async () => {
    const [entetes, lignes] = await Promise.all([
      operationsEnAttente("pontes"),
      operationsEnAttente("ponte_lignes"),
    ]);
    // L'en-tête porte la date et le bâtiment, les lignes n'ont que ponte_id.
    const lotParPonte = {};
    const degats = {};
    entetes.forEach((op) => {
      const p = op.payload;
      if (p?.date !== date) return;
      lotParPonte[p.id] = p.lot_id;
      degats[p.lot_id] = { sales: p.oeufs_sales ?? 0, perdus: p.oeufs_perdus ?? 0 };
    });
    setDegatsFile(degats);
    const parLot = {};
    lignes.forEach((op) => {
      [].concat(op.payload).forEach((l) => {
        const lotId = lotParPonte[l.ponte_id];
        if (!lotId) return;
        // Ces écritures sont des upsert : à la synchro elles remplaceront la
        // valeur du serveur pour ce calibre, pas s'y ajouter.
        (parLot[lotId] ??= {})[l.calibre] = l.oeufs;
      });
    });
    setFile(parLot);
  };

  useEffect(() => {
    const jeton = ++requete.current;
    setServeur({}); // sinon, hors ligne, les chiffres de la veille restent sous la nouvelle date
    setFile({});
    setDegatsServeur({});
    setDegatsFile({});
    const relire = () => { chargerServeur(jeton); chargerFile(); };
    relire();
    // se rafraîchit aussi quand la file bouge (saisie ajoutée, sync qui rattrape)
    return onQueueChange(relire);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  const collecte = useMemo(() => {
    const fusion = {};
    for (const lotId of new Set([...Object.keys(serveur), ...Object.keys(file)])) {
      fusion[lotId] = { ...serveur[lotId], ...file[lotId] };
    }
    return fusion;
  }, [serveur, file]);

  const totalLot = (lotId) => Object.values(collecte[lotId] ?? {}).reduce((s, n) => s + n, 0);
  const totalGeneral = lots.reduce((s, l) => s + totalLot(l.id), 0);
  const enAttente = Object.keys(file).length > 0;

  // Une fiche en file remplace celle du serveur, elle ne s'y ajoute pas.
  const degatsLot = (lotId, champ) =>
    (degatsFile[lotId] ?? degatsServeur[lotId] ?? vide())[champ];
  const degatsTotal = (champ) => lots.reduce((s, l) => s + degatsLot(l.id, champ), 0);

  if (!lots.length) return null;

  return (
    <div className="tf-card">
      <div className="tf-cardhead">
        <span className="tf-cardtitle">Œufs collectés · {lots.map((l) => l.id).join(" + ")}</span>
        <span className="tf-tag">{date === today() ? "AUJOURD'HUI" : dLabel(date).toUpperCase()}</span>
      </div>
      {/* Tous les calibres sont listés, même à zéro : à position fixe d'un
          jour sur l'autre, un calibre oublié se repère d'un coup d'œil. */}
      <div className="tf-releve-cadre">
        <table className="tf-releve">
          <thead>
            <tr>
              <th>Calibre</th>
              {lots.map((l) => <th key={l.id}>{l.id}</th>)}
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {LIGNES.map((c) => {
              const parLot = lots.map((l) => collecte[l.id]?.[c] ?? 0);
              const total = parLot.reduce((s, n) => s + n, 0);
              return (
                <tr key={c}>
                  <th>
                    {libelle(c)}
                    <span className="tf-sous">{POIDS[c]}</span>
                  </th>
                  {parLot.map((n, i) => <td key={lots[i].id}>{fmt(n)}</td>)}
                  <td>{fmt(total)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <th>Total œufs</th>
              {lots.map((l) => <td key={l.id}>{fmt(totalLot(l.id))}</td>)}
              <td>{fmt(totalGeneral)}</td>
            </tr>
            {/* Sous le total, et volontairement dehors : les sales sont
                nettoyés puis vendus, donc déjà comptés dans leur calibre —
                les remettre ici les compterait deux fois. Les perdus ne sont
                pas de la production. */}
            <tr data-hors-total="1">
              <th>
                Sales
                <span className="tf-sous">à nettoyer</span>
              </th>
              {lots.map((l) => <td key={l.id}>{fmt(degatsLot(l.id, "sales"))}</td>)}
              <td>{fmt(degatsTotal("sales"))}</td>
            </tr>
            <tr data-hors-total="1">
              <th>
                Perdus
                <span className="tf-sous">irrécupérables</span>
              </th>
              {lots.map((l) => (
                <td key={l.id} data-alerte={degatsLot(l.id, "perdus") > 0 ? 1 : 0}>
                  {fmt(degatsLot(l.id, "perdus"))}
                </td>
              ))}
              <td data-alerte={degatsTotal("perdus") > 0 ? 1 : 0}>{fmt(degatsTotal("perdus"))}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <div className="tf-live">
        <span className="tf-live-n">{fmt(totalGeneral)}</span>
        <span className="tf-live-l">œufs déjà enregistrés, tous bâtiments confondus</span>
      </div>
      {enAttente && (
        <p className="tf-note">Les saisies pas encore synchronisées sont comprises dans ces chiffres.</p>
      )}
      <AlerteEchecs tables={TABLES} />
    </div>
  );
}
