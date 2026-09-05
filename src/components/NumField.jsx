import { useState } from "react";
import { fmt } from "./format";
import { useSurOrdinateur } from "../lib/useSurOrdinateur";

const MAX = 9999999;

// Sans `onOpen`, le champ n'est là que pour être lu (le prix des œufs pour un
// rôle autre que la direction) : il doit cesser d'avoir l'air tapable, sinon
// on tape dessus et rien ne se passe.
//
// Deux formes selon l'appareil. Au doigt, un bouton qui ouvre le pavé dessiné
// pour ça — le clavier système est trop lent et couvre l'écran
// (docs/03-brief-technique.md section 2). À la souris, une case où l'on tape
// directement : ouvrir un pavé tactile devant quelqu'un qui a un clavier sous
// les mains, c'est lui faire viser douze touches pour rien.
//
// Deux façons de rendre la valeur, selon ce que l'écran demande :
//  - `onChange` : à chaque touche, pour un brouillon qu'on enregistre plus tard ;
//  - `onCommit` : à la sortie du champ seulement, quand la saisie déclenche une
//    écriture — un prix de vente, une correction de stock. Une écriture par
//    chiffre tapé remplirait la file d'attente de valeurs intermédiaires.
export default function NumField({
  label, sous, unit, value, tone, detail, onOpen, onChange, onCommit,
}) {
  const surOrdinateur = useSurOrdinateur();
  const saisieDirecte = surOrdinateur && onOpen && (onChange || onCommit);
  // Pendant la frappe, le champ affiche ce qu'on tape et non la valeur reçue :
  // celle du reste de provende est calculée, elle ne suivrait pas la frappe.
  // `null` veut dire « pas en cours d'édition ».
  const [saisie, setSaisie] = useState(null);

  const contenu = (
    <>
      <span className="tf-label">{label}</span>
      {/* Sous-titre du champ — la tranche de poids d'un calibre, pour ne pas
          avoir à traduire entre la balance et l'écran. */}
      {sous && <span className="tf-sous">{sous}</span>}
    </>
  );

  // La ligne de détail est réservée en permanence dès qu'un écran passe
  // `detail` — une espace insécable quand il n'y a rien à montrer. Sinon elle
  // apparaît au premier chiffre tapé et fait sauter tout l'écran.
  const ligneDetail = detail !== undefined && (
    <span className="tf-tag tf-field-tag">{detail ?? " "}</span>
  );

  if (saisieDirecte) {
    const texte = (n) => (n ? String(n) : "");
    return (
      <label className="tf-field" data-filled={value ? 1 : 0} data-tone={tone} data-saisie="1">
        {contenu}
        <span className="tf-value">
          <input
            className="tf-saisie"
            type="text"
            inputMode="numeric"
            // Pas de séparateur de milliers pendant la frappe : « 1 234 » se
            // rejetterait lui-même au caractère suivant.
            value={saisie ?? texte(value)}
            placeholder="0"
            aria-label={`${label}${unit ? ` en ${unit}` : ""}`}
            onFocus={(e) => { setSaisie(texte(value)); e.target.select(); }}
            onChange={(e) => {
              const chiffres = e.target.value.replace(/\D/g, "");
              setSaisie(chiffres);
              onChange?.(chiffres ? Math.min(Number(chiffres), MAX) : 0);
            }}
            onBlur={() => {
              if (saisie !== null && Number(saisie || 0) !== (value || 0)) {
                onCommit?.(Math.min(Number(saisie || 0), MAX));
              }
              setSaisie(null);
            }}
            // Entrée sort du champ : la validation passe par le même chemin que
            // le clic ailleurs, il n'y a qu'un endroit où l'écriture part.
            onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
          />
          <span className="tf-unit">{unit}</span>
        </span>
        {ligneDetail}
      </label>
    );
  }

  return (
    <button className="tf-field" data-filled={value ? 1 : 0} data-tone={tone}
            onClick={onOpen} disabled={!onOpen}>
      {contenu}
      <span className="tf-value" data-zero={value ? 0 : 1}>
        {fmt(value)}<span className="tf-unit">{unit}</span>
      </span>
      {ligneDetail}
    </button>
  );
}
