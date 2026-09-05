import { useEffect, useState } from "react";
import { fmt, dLabel } from "./format";
import { POIDS } from "../data/constants";
import { supabase } from "../lib/supabaseClient";
import { lectureCachee } from "../lib/cacheLecture";
import { onQueueChange, operationsEnAttente } from "../lib/offlineQueue";
import ComptageStock from "./ComptageStock";

// Les œufs en magasin : ce qui a été ramassé moins ce qui est sorti, calibre
// par calibre. Les pertes ne s'en retirent pas — elles n'ont jamais rejoint
// les lignes de collecte (voir docs/31).

const libelle = (c) => (c === "CASSE" ? "Cassés" : c);

export default function StockOeufs({ avecComptage = false }) {
  const [rafraichir, setRafraichir] = useState(0);
  const [lignes, setLignes] = useState([]);
  const [reserve, setReserve] = useState(null);
  const [enFile, setEnFile] = useState({ collecte: 0, vente: 0 });
  const [jours, setJours] = useState([]);

  useEffect(() => {
    const charger = async () => {
      const [{ data }, { data: r }, { data: j }] = await Promise.all([
        lectureCachee("v_stock_oeufs", () =>
          supabase.from("v_stock_oeufs").select("*").order("ordre")),
        lectureCachee("v_stock_reserve", () =>
          supabase.from("v_stock_oeufs_reserve").select("*").maybeSingle()),
        // Tout l'historique depuis le point de référence, pas un mois : les
        // premiers jours sont ceux qui expliquent le solde, et les couper
        // revenait à cacher l'essentiel. La liste défile dans son cadre.
        lectureCachee("v_stock_oeufs_jour", () =>
          supabase.from("v_stock_oeufs_jour").select("*")
            .order("date", { ascending: false }).limit(180)),
      ]);
      if (data) setLignes(data);
      if (r) setReserve(r);
      if (j) setJours(j);

      // Ce qui attend encore la synchronisation compte déjà dans le magasin :
      // les œufs sont ramassés ou sortis, que le téléphone ait pu le dire ou
      // non. Sans ça le stock saute au moment où la file se vide.
      const [pontes, ventes] = await Promise.all([
        operationsEnAttente("ponte_lignes"),
        operationsEnAttente("vente_lignes"),
      ]);
      const somme = (ops) =>
        ops.reduce((s, op) => s + [].concat(op.payload).reduce((t, l) => t + (l?.oeufs ?? 0), 0), 0);
      setEnFile({ collecte: somme(pontes), vente: somme(ventes) });
    };
    charger();
    return onQueueChange(charger);
  }, [rafraichir]);

  const total = lignes.reduce((s, l) => s + Number(l.disponibles ?? 0), 0)
    + enFile.collecte - enFile.vente;
  const depuis = lignes.map((l) => l.depuis).filter(Boolean).sort()[0];
  const attente = enFile.collecte || enFile.vente;

  return (
    <div className="tf-card">
      <div className="tf-cardhead">
        <span className="tf-cardtitle">Œufs disponibles</span>
        {depuis && (
          <span className="tf-tag">
            {lignes[0]?.compte_pose ? "COMPTÉ LE" : "DEPUIS LE"} {dLabel(depuis).toUpperCase()}
          </span>
        )}
      </div>

      <div className="tf-live" data-alerte={total < 0 ? 1 : 0}>
        <span className="tf-live-n">{fmt(total)}</span>
        <span className="tf-live-l">
          œufs en magasin — soit {fmt(Math.floor(Math.abs(total) / 30))} alvéoles
        </span>
      </div>

      {jours.length > 0 && (
        <div className="tf-releve-cadre" data-long="1">
          <table className="tf-releve">
            <thead>
              <tr><th>Jour</th><th>Collectés</th><th>Vendus</th><th>Reste</th></tr>
            </thead>
            <tbody>
              {jours.map((j) => (
                <tr key={j.date}>
                  <th>{dLabel(j.date)}</th>
                  <td>{fmt(j.collectes)}</td>
                  <td>{fmt(j.vendus)}</td>
                  <td data-alerte={Number(j.disponibles) < 0 ? 1 : 0}>{fmt(j.disponibles)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="tf-eyebrow" style={{ margin: "14px 0 6px" }}>Par calibre</p>

      <div className="tf-releve-cadre">
        <table className="tf-releve">
          <thead>
            <tr><th>Calibre</th><th>Collectés</th><th>Vendus</th><th>Reste</th></tr>
          </thead>
          <tbody>
            {lignes.map((l) => (
              <tr key={l.calibre}>
                <th>
                  {libelle(l.calibre)}
                  <span className="tf-sous">{POIDS[l.calibre]}</span>
                </th>
                <td>{fmt(l.collectes)}</td>
                <td>{fmt(l.vendus)}</td>
                <td data-alerte={Number(l.disponibles) < 0 ? 1 : 0}>{fmt(l.disponibles)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {attente > 0 && (
        <p className="tf-note">
          Les saisies pas encore synchronisées sont comprises dans ce total.
        </p>
      )}

      {total < 0 && (
        <p className="tf-note">
          Le compte est négatif : il est sorti plus d'œufs qu'il n'en est entré depuis le début du
          suivi. C'est normal tant que le magasin n'a pas été compté — il n'était pas vide au
          départ, et ce qui s'y trouvait déjà n'a jamais été enregistré comme entrée. Compte-le une
          fois, le solde repartira juste.
        </p>
      )}

      {avecComptage && <ComptageStock onFini={() => setRafraichir((n) => n + 1)} />}

      {reserve?.ventes_sans_detail > 0 && (
        <p className="tf-note">
          {reserve.ventes_sans_detail} vente{reserve.ventes_sans_detail > 1 ? "s" : ""} au comptoir
          {reserve.ventes_sans_detail > 1 ? " ont" : " a"} été saisie
          {reserve.ventes_sans_detail > 1 ? "s" : ""} en montant global ({fmt(reserve.ariary)} Ar),
          sans détail par calibre. Ces œufs-là sont sortis du magasin sans être déduits : le reste
          ci-dessus est d'autant trop élevé.
        </p>
      )}
    </div>
  );
}
