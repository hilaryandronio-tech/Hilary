import { today } from "./format";

// Le choix du mois affiché, avec ses bornes. Repris de l'écran Clients, où
// il servait seul : les écrans d'historique posent tous la même question —
// « montre-moi septembre, pas août » — et devaient tous la résoudre à leur
// façon.
//
// Rien n'est archivé ni effacé : un mois passé reste à une flèche de là.

export const moisCourant = () => today().slice(0, 7);

export const bornesMois = (mois) => {
  const [a, m] = mois.split("-").map(Number);
  const dernier = new Date(Date.UTC(a, m, 0)).getUTCDate();
  return [`${mois}-01`, `${mois}-${String(dernier).padStart(2, "0")}`];
};

export const decalerMois = (mois, n) => {
  const [a, m] = mois.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1 + n, 1)).toISOString().slice(0, 7);
};

export const labelMois = (mois) =>
  new Date(mois + "-01T12:00:00").toLocaleDateString("fr-FR", { month: "long", year: "numeric" });

export default function MoisSelector({ mois, onChange }) {
  // Un mois à venir n'a rien à montrer, et la flèche qui y mène donne un
  // écran vide sans dire pourquoi.
  const futur = decalerMois(mois, 1) > moisCourant();
  return (
    <div className="tf-dateselect">
      <button className="tf-dateselect-nav" onClick={() => onChange(decalerMois(mois, -1))}
        aria-label="Mois précédent">‹</button>
      <div className="tf-dateselect-val">{labelMois(mois)}</div>
      <button className="tf-dateselect-nav" onClick={() => onChange(decalerMois(mois, 1))}
        disabled={futur} aria-label="Mois suivant">›</button>
      {mois !== moisCourant() && (
        <button className="tf-dateselect-today" onClick={() => onChange(moisCourant())}>Ce mois</button>
      )}
    </div>
  );
}
