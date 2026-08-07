import { fmt } from "./format";

// Sans `onOpen`, le champ n'est là que pour être lu (le prix des œufs pour un
// rôle autre que la direction) : il doit cesser d'avoir l'air tapable, sinon
// on tape dessus et rien ne se passe.
export default function NumField({ label, unit, value, tone, detail, onOpen }) {
  return (
    <button className="tf-field" data-filled={value ? 1 : 0} data-tone={tone}
            onClick={onOpen} disabled={!onOpen}>
      <span className="tf-label">{label}</span>
      <span className="tf-value" data-zero={value ? 0 : 1}>
        {fmt(value)}<span className="tf-unit">{unit}</span>
      </span>
      {/* Dès qu'un écran passe `detail`, la ligne est réservée en permanence —
          une espace insécable quand il n'y a rien à montrer. Sinon elle
          apparaît au premier chiffre tapé et fait sauter tout l'écran. */}
      {detail !== undefined && (
        <span className="tf-tag tf-field-tag">{detail ?? " "}</span>
      )}
    </button>
  );
}
