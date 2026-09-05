import { useEffect, useRef } from "react";
import { fmt } from "./format";

// Integrated numeric keypad — the system keyboard is too slow and covers the
// screen (docs/03-brief-technique.md section 2).
//
// Sur ordinateur, ce même pavé oblige à viser douze touches à la souris alors
// qu'un clavier est là. Il écoute donc aussi les vraies touches : les chiffres
// saisissent, Retour arrière efface, Échap ferme, Entrée valide. Rien ne change
// sur le téléphone, où aucune de ces touches n'existe.
export default function Keypad({ field, onChange, onClose }) {
  const valeur = field?.value;

  // Le gestionnaire lit la valeur ici, pas dans la portée du rendu : trois
  // chiffres tapés vite se suivent en un seul lot, avant tout réaffichage, et
  // chacun repartait alors de la même valeur périmée — « 650 » donnait 0.
  const valeurRef = useRef(valeur);
  valeurRef.current = valeur;

  useEffect(() => {
    if (!field) return;
    const poser = (v) => { valeurRef.current = v; onChange(v); };
    const auClavier = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key >= "0" && e.key <= "9") {
        const suivant = Number(String(valeurRef.current || 0) + e.key);
        if (suivant <= 9999999) poser(suivant);
      } else if (e.key === "Backspace") {
        poser(Math.floor((valeurRef.current || 0) / 10));
      } else if (e.key === "Delete") {
        poser(0);
      } else if (e.key === "Enter" || e.key === "Escape") {
        onClose();
      } else {
        return;
      }
      // Après coup seulement : une touche qu'on ne traite pas doit garder son
      // comportement normal, à commencer par la tabulation.
      e.preventDefault();
    };
    window.addEventListener("keydown", auClavier);
    return () => window.removeEventListener("keydown", auClavier);
  }, [field, onChange, onClose]);

  if (!field) return null;

  const push = (k) => {
    if (k === "C") return onChange(0);
    if (k === "<") return onChange(Math.floor((field.value || 0) / 10));
    const next = Number(String(field.value || 0) + k);
    if (next <= 9999999) onChange(next);
  };

  return (
    <div className="tf-pad" onClick={onClose}>
      <div className="tf-pad-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="tf-pad-head">
          <span className="tf-pad-label">{field.label}</span>
          <span className="tf-pad-val">
            {fmt(field.value)}
            <span className="tf-unit">{field.unit}</span>
          </span>
        </div>
        <div className="tf-keys">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9", "C", "0", "<"].map((k) => (
            <button key={k} className="tf-key" onClick={() => push(k)}>{k}</button>
          ))}
          <button className="tf-key" data-ok="1" onClick={onClose}>Valider</button>
        </div>
        <p className="tf-pad-aide">Au clavier : les chiffres, ⌫ pour effacer, Entrée pour valider.</p>
      </div>
    </div>
  );
}
