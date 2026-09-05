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
// La case ne s'active que si l'écran passe `onChange`. Un appelant qui ne le
// fait pas garde le pavé partout, donc rien ne casse tant que tout n'est pas
// converti.
export default function NumField({ label, sous, unit, value, tone, detail, onOpen, onChange }) {
  const surOrdinateur = useSurOrdinateur();
  const saisieDirecte = surOrdinateur && onOpen && onChange;

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
            value={value ? String(value) : ""}
            placeholder="0"
            aria-label={`${label}${unit ? ` en ${unit}` : ""}`}
            onFocus={(e) => e.target.select()}
            onChange={(e) => {
              const chiffres = e.target.value.replace(/\D/g, "");
              onChange(chiffres ? Math.min(Number(chiffres), MAX) : 0);
            }}
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
