import { useEffect, useMemo, useRef, useState } from "react";
import Header from "../components/Header";
import { fmt, dLabel } from "../components/format";
import MoisSelector, { moisCourant, bornesMois, labelMois } from "../components/MoisSelector";
import { POIDS } from "../data/constants";
import { supabase } from "../lib/supabaseClient";
import { lectureCachee } from "../lib/cacheLecture";
import { onQueueChange } from "../lib/offlineQueue";

// Le registre des achats : une ligne par calibre acheté, avec le numéro de
// bon, le client, la date et la quantité.
//
// Les autres écrans regardent la même matière par un autre bout — « Ventes »
// totalise la journée, « Clients » ouvre le compte d'un client à la fois.
// Aucun ne répond à « retrouve-moi le bon 082 » ni à « qui a pris du L1 ce
// mois-ci ». C'est une liste plate, et c'est tout l'intérêt : elle se lit
// comme le carnet de bons, ligne à ligne.

const libelle = (c) => (c === "CASSE" ? "Cassés" : c);

// Le numéro porté par la vente fait foi : c'est celui du carnet, recopié à la
// caisse. Les commandes livrées gardent le leur de leur côté — il sert quand
// la vente est née d'une commande et n'a pas reçu de numéro propre.
const numeroBon = (v) => v.numero_commande || v.commandes?.[0]?.numero || null;

// Une vente au comptoir n'a pas de client : elle n'en est pas moins un achat.
const nomClient = (v) => v.clients?.nom || "Comptoir";

// « 219-09-2026 » se range après « 76-09-2026 » dans l'ordre des chaînes :
// c'est le rang du bon qui compte, pas son écriture. Un bon sans numéro passe
// en dernier plutôt que de remonter en tête avec un zéro.
const rangBon = (numero) => (numero ? Number.parseInt(numero, 10) || 0 : -1);

export default function Achats() {
  const [ventes, setVentes] = useState([]);
  const [mois, setMois] = useState(moisCourant());
  const [qui, setQui] = useState(null);   // null = tous les clients
  const requete = useRef(0);

  useEffect(() => {
    const jeton = ++requete.current;
    // Vider avant de recharger : sans ça le mois quitté reste affiché le temps
    // de la requête, et sur une connexion de ferme cela dure.
    setVentes([]);
    const [debut, fin] = bornesMois(mois);
    const charger = async () => {
      // La clé porte le mois : deux mois partageraient sinon le même cache,
      // et hors ligne on resservirait le mauvais.
      const { data } = await lectureCachee(`achats:${mois}`, () =>
        supabase.from("ventes")
          .select("id, date, numero_commande, montant, credit, clients(nom), vente_lignes(calibre, oeufs, prix_unit, conditionnement), commandes(numero)")
          .gte("date", debut).lte("date", fin)
          .order("date", { ascending: false }));
      // Seule la dernière demande a le droit d'écrire : deux mois enchaînés
      // vite arrivent dans le désordre.
      if (jeton !== requete.current) return;
      if (data) setVentes(data);
    };
    charger();
    return onQueueChange(charger);
  }, [mois]);

  // Une ligne par calibre. Une vente saisie en montant global n'a pas de
  // détail : elle garde sa ligne, sans calibre ni quantité, plutôt que de
  // disparaître de la liste — le bon existe, il doit se retrouver.
  const lignes = useMemo(() => {
    const tout = [];
    ventes.forEach((v) => {
      const base = { id: v.id, date: v.date, numero: numeroBon(v), client: nomClient(v), credit: v.credit };
      const detail = v.vente_lignes ?? [];
      if (detail.length === 0) {
        tout.push({ ...base, cle: v.id, calibre: null, oeufs: null, montant: v.montant });
        return;
      }
      detail.forEach((l) => tout.push({
        ...base,
        cle: `${v.id}-${l.calibre}-${l.conditionnement ?? 0}`,
        calibre: l.calibre,
        conditionnement: l.conditionnement,
        oeufs: Number(l.oeufs),
        montant: Number(l.oeufs) * Number(l.prix_unit ?? 0),
      }));
    });
    // Décroissant : le plus récent en haut, comme partout ailleurs. À égalité
    // de date, le carnet donne l'ordre — le dernier bon rempli d'abord.
    return tout.sort((a, b) =>
      b.date.localeCompare(a.date) || rangBon(b.numero) - rangBon(a.numero));
  }, [ventes]);

  // Les clients du mois, pas les soixante de la base : la liste sert à
  // filtrer ce qui est là, et se parcourt à la souris sans rien taper.
  const clientsDuMois = useMemo(
    () => [...new Set(lignes.map((l) => l.client))].sort((a, b) => a.localeCompare(b, "fr")),
    [lignes]
  );

  const visibles = qui ? lignes.filter((l) => l.client === qui) : lignes;
  const totalOeufs = visibles.reduce((s, l) => s + (l.oeufs ?? 0), 0);
  const bons = new Set(visibles.map((l) => l.id)).size;

  return (
    <div className="tf">
      <Header />
      <main className="tf-body">
        <p className="tf-eyebrow">Registre</p>
        <h1 className="tf-h1">Achats des clients</h1>
        <p className="tf-sub">
          Chaque calibre acheté, avec son numéro de bon, le client, la date et la quantité.
          Du plus récent au plus ancien.
        </p>

        <MoisSelector mois={mois} onChange={setMois} />

        <div className="tf-kpis">
          <div className="tf-kpi" data-hero="1">
            <div className="tf-kpi-n">{fmt(totalOeufs)}</div>
            <div className="tf-kpi-l">
              œufs achetés en {labelMois(mois)} · {bons} bon{bons > 1 ? "s" : ""}
            </div>
          </div>
          <div className="tf-kpi">
            <div className="tf-kpi-n">{fmt(visibles.length)}</div>
            <div className="tf-kpi-l">ligne{visibles.length > 1 ? "s" : ""} d'achat</div>
          </div>
        </div>

        {clientsDuMois.length > 1 && (
          <div className="tf-chips tf-chips-scroll" style={{ marginBottom: 14 }}>
            <button className="tf-chip" data-on={qui ? 0 : 1} onClick={() => setQui(null)}>
              Tous
            </button>
            {clientsDuMois.map((nom) => (
              <button key={nom} className="tf-chip" data-on={qui === nom ? 1 : 0}
                onClick={() => setQui(nom)}>{nom}</button>
            ))}
          </div>
        )}

        {visibles.length === 0 && (
          <div className="tf-card">
            <p className="tf-empty">
              Aucun achat {qui ? `de ${qui} ` : ""}en {labelMois(mois)}.
            </p>
          </div>
        )}

        {visibles.length > 0 && (
          <div className="tf-card">
            <div className="tf-cardhead">
              <span className="tf-cardtitle">{qui ?? "Tous les clients"}</span>
              <span className="tf-tag">{labelMois(mois).toUpperCase()}</span>
            </div>
            <div className="tf-releve-cadre" data-long="1">
              <table className="tf-releve">
                <thead>
                  <tr>
                    <th>N° bon</th>
                    <th>Date</th>
                    <th>Client</th>
                    <th>Calibre</th>
                    <th>Œufs</th>
                  </tr>
                </thead>
                <tbody>
                  {visibles.map((l) => (
                    <tr key={l.cle}>
                      <th>
                        {l.numero ?? "—"}
                        {l.credit && <span className="tf-sous">à crédit</span>}
                      </th>
                      <td>{dLabel(l.date)}</td>
                      <td>{l.client}</td>
                      <td>
                        {l.calibre ? libelle(l.calibre) : "sans détail"}
                        {l.conditionnement > 1 ? ` ·x${l.conditionnement}` : ""}
                        {l.calibre && <span className="tf-sous">{POIDS[l.calibre]}</span>}
                      </td>
                      <td>{l.oeufs == null ? "—" : fmt(l.oeufs)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <th>Total</th>
                    <td />
                    <td />
                    <td />
                    <td>{fmt(totalOeufs)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <p className="tf-note">
              Une vente saisie en montant global n'a pas de calibre : sa ligne reste, sans
              quantité, et ses œufs ne sont pas comptés dans le total.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
