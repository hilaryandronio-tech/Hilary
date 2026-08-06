import { useEffect, useMemo, useRef, useState } from "react";
import { fmt, today, dLabel } from "./format";
import { CALIBRES } from "../data/constants";
import { supabase } from "../lib/supabaseClient";
import { onQueueChange, operationsEnAttente } from "../lib/offlineQueue";
import AlerteEchecs from "./AlerteEchecs";

const TABLES = ["pontes", "ponte_lignes"];

// Le relevé de la collecte d'une journée, calibre par calibre et bâtiment par
// bâtiment. Sert à deux endroits et doit y dire exactement la même chose : la
// magasinière le lit pour vérifier ce qu'elle vient de saisir, le point de
// vente pour savoir ce qu'il a en stock à vendre.

// Les cassés se vendent, donc ils figurent au relevé au même titre qu'un
// calibre — contrairement aux sales/fêlés, qui restent un pur dégât.
const LIGNES = [...CALIBRES, "CASSE"];
const libelle = (c) => (c === "CASSE" ? "Cassés" : c);

export default function ReleveCollecte({ date, lots }) {
  // Ce qui est collecté ce jour-là vient de deux sources qu'il faut réunir :
  //   - `serveur` : ce que Supabase a enregistré ;
  //   - `file`    : ce qui est saisi mais attend la synchro.
  // Ignorer la seconde, c'est afficher un total qui ne bouge pas quand la
  // magasinière vient d'enregistrer hors ligne.
  const [serveur, setServeur] = useState({}); // { [lot_id]: { [calibre]: oeufs } }
  const [file, setFile] = useState({});
  const requete = useRef(0);

  const chargerServeur = async (jeton) => {
    const { data, error } = await supabase
      .from("pontes")
      .select("lot_id, ponte_lignes(calibre, oeufs)")
      .eq("date", date)
      .not("lot_id", "is", null);
    // Deux requêtes lancées coup sur coup peuvent revenir dans le désordre :
    // seule la dernière demandée a le droit d'écrire dans l'état.
    if (jeton !== requete.current) return;
    if (error || !data) return; // hors ligne : on garde ce qu'on savait déjà
    const parLot = {};
    data.forEach((p) => {
      const lignes = (parLot[p.lot_id] ??= {});
      (p.ponte_lignes ?? []).forEach((l) => {
        lignes[l.calibre] = (lignes[l.calibre] ?? 0) + l.oeufs;
      });
    });
    setServeur(parLot);
  };

  const chargerFile = async () => {
    const [entetes, lignes] = await Promise.all([
      operationsEnAttente("pontes"),
      operationsEnAttente("ponte_lignes"),
    ]);
    // L'en-tête porte la date et le bâtiment, les lignes n'ont que ponte_id.
    const lotParPonte = {};
    entetes.forEach((op) => {
      if (op.payload?.date === date) lotParPonte[op.payload.id] = op.payload.lot_id;
    });
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
                  <th>{libelle(c)}</th>
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
