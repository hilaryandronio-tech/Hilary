import { useId, useMemo, useState } from "react";

// Un graphique en SVG, sans bibliothèque : l'application doit rester légère et
// utilisable hors ligne sur un téléphone d'entrée de gamme.
//
// Les deux couleurs de série ont été validées contre le fond des cartes
// (#EFFCF3) : bande de clarté, saturation, séparation en protanopie et
// deutéranopie (ΔE 20), contraste supérieur à 3:1. Le jaune d'œuf de la charte
// ne passait pas — 1,9:1, illisible en plein soleil — d'où cette version
// assombrie.
export const COURBE_OR = "#B0670A";
export const COURBE_BLEU = "#0072A8";

const L = 38;   // marge gauche, pour les libellés d'axe
const R = 10;
const H_HAUT = 8;
const H_BAS = 18;
const LARGEUR = 320;
const HAUTEUR = 150;

const joli = (n) => {
  const a = Math.abs(n);
  if (a >= 1_000_000) return `${(n / 1_000_000).toFixed(a >= 10_000_000 ? 0 : 1)} M`;
  if (a >= 1_000) return `${Math.round(n / 1000)} k`;
  return String(Math.round(n));
};

/**
 * @param {{nom: string, couleur: string, valeurs: (number|null)[]}[]} series
 * @param {string[]} labels        une étiquette par point, la plus ancienne en premier
 * @param {(n:number)=>string} format  rendu d'une valeur dans le relevé
 * @param {{valeur:number, nom:string}} [repere]  ligne de référence horizontale
 * @param {boolean} [zeroDansLeCadre]  garder le zéro visible (voir plus bas)
 */
export default function Courbe({
  series, labels, format = joli, repere, unite = "", zeroDansLeCadre = true,
}) {
  const [choisi, setChoisi] = useState(null);
  const id = useId();

  const { min, max } = useMemo(() => {
    const tout = series.flatMap((s) => s.valeurs).filter((v) => v != null);
    if (repere) tout.push(repere.valeur);
    if (!tout.length) return { min: 0, max: 1 };
    // Pour de l'argent, le zéro reste dans le cadre : un bénéfice négatif doit
    // se lire comme tel, pas comme une courbe basse. Pour un niveau qui oscille
    // haut — un taux de ponte autour de 85 %, une ration autour de 650 kg — le
    // zéro écraserait toute la variation dans le dernier cinquième du cadre ;
    // on cadre alors sur les valeurs, l'axe restant chiffré pour qu'on ne lise
    // pas le bas du cadre comme un zéro.
    const bas = Math.min(...(zeroDansLeCadre ? [0, ...tout] : tout));
    const haut = Math.max(...tout);
    return { min: bas, max: haut === bas ? bas + 1 : haut };
  }, [series, repere, zeroDansLeCadre]);

  const n = labels.length;
  if (!n) return <p className="tf-empty">Pas encore de données à tracer.</p>;

  const x = (i) => L + (n === 1 ? (LARGEUR - L - R) / 2 : (i * (LARGEUR - L - R)) / (n - 1));
  const y = (v) => H_HAUT + (1 - (v - min) / (max - min)) * (HAUTEUR - H_HAUT - H_BAS);

  const chemin = (valeurs) => {
    let d = "";
    let leve = true;
    valeurs.forEach((v, i) => {
      if (v == null) { leve = true; return; }
      d += `${leve ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)} `;
      leve = false;
    });
    return d.trim();
  };

  const dernier = (s) => {
    for (let i = s.valeurs.length - 1; i >= 0; i--) if (s.valeurs[i] != null) return i;
    return -1;
  };

  const indice = choisi ?? null;
  const graduations = [max, min + (max - min) / 2, min];

  return (
    <div className="tf-courbe">
      {/* Relevé permanent plutôt qu'une infobulle flottante : sur un téléphone
          le doigt masque le point qu'il désigne. */}
      <div className="tf-courbe-releve">
        {indice == null ? (
          <span className="tf-courbe-invite">Appuie sur la courbe pour lire une journée.</span>
        ) : (
          <>
            <strong>{labels[indice]}</strong>
            {series.map((s) => (
              <span key={s.nom} className="tf-courbe-val">
                <i style={{ background: s.couleur }} aria-hidden="true" />
                {s.nom}{" "}
                {s.valeurs[indice] == null
                  ? "pas de saisie"
                  : `${format(s.valeurs[indice])}${unite}`}
              </span>
            ))}
          </>
        )}
      </div>

      <svg viewBox={`0 0 ${LARGEUR} ${HAUTEUR}`} className="tf-courbe-svg"
           role="img" aria-label={series.map((s) => s.nom).join(", ")}>
        {graduations.map((v, i) => (
          <g key={i}>
            <line x1={L} x2={LARGEUR - R} y1={y(v)} y2={y(v)} className="tf-courbe-grille" />
            <text x={L - 5} y={y(v) + 3} className="tf-courbe-axe" textAnchor="end">{joli(v)}</text>
          </g>
        ))}
        {min < 0 && (
          <line x1={L} x2={LARGEUR - R} y1={y(0)} y2={y(0)} className="tf-courbe-zero" />
        )}
        {repere && (
          <>
            <line x1={L} x2={LARGEUR - R} y1={y(repere.valeur)} y2={y(repere.valeur)}
                  className="tf-courbe-repere" />
            {/* Sous le trait quand celui-ci frôle le haut du cadre — sinon
                l'étiquette sort du viewBox et se fait rogner. */}
            <text x={LARGEUR - R} y={y(repere.valeur) + (y(repere.valeur) < H_HAUT + 10 ? 12 : -4)}
                  className="tf-courbe-axe" textAnchor="end">
              {repere.nom}
            </text>
          </>
        )}

        {series.map((s) => (
          <path key={s.nom} d={chemin(s.valeurs)} fill="none" stroke={s.couleur}
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        ))}

        {/* Point terminal étiqueté : l'identité ne repose jamais sur la seule
            couleur, et c'est la valeur du jour qu'on cherche le plus souvent. */}
        {series.map((s) => {
          const i = dernier(s);
          if (i < 0) return null;
          return <circle key={s.nom} cx={x(i)} cy={y(s.valeurs[i])} r="4" fill={s.couleur} />;
        })}

        {indice != null && (
          <>
            <line x1={x(indice)} x2={x(indice)} y1={H_HAUT} y2={HAUTEUR - H_BAS}
                  className="tf-courbe-viseur" />
            {series.map((s) => s.valeurs[indice] == null ? null : (
              <circle key={s.nom} cx={x(indice)} cy={y(s.valeurs[indice])} r="4.5"
                      fill={s.couleur} stroke="var(--card)" strokeWidth="2" />
            ))}
          </>
        )}

        <text x={L} y={HAUTEUR - 5} className="tf-courbe-axe">{labels[0]}</text>
        <text x={LARGEUR - R} y={HAUTEUR - 5} className="tf-courbe-axe" textAnchor="end">
          {labels[n - 1]}
        </text>

        {/* Zones de contact larges : viser un trait de 2 px au doigt est vain. */}
        {labels.map((_, i) => (
          <rect key={`${id}-${i}`} x={x(i) - (LARGEUR - L - R) / (2 * Math.max(1, n - 1))}
                y={0} width={(LARGEUR - L - R) / Math.max(1, n - 1)} height={HAUTEUR}
                fill="transparent" onPointerDown={() => setChoisi(i === choisi ? null : i)} />
        ))}
      </svg>

      {series.length > 1 && (
        <div className="tf-courbe-legende">
          {series.map((s) => (
            <span key={s.nom}>
              <i style={{ background: s.couleur }} aria-hidden="true" />
              {s.nom}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
