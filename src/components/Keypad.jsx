import { fmt } from "./format";

// Integrated numeric keypad — the system keyboard is too slow and covers the
// screen (docs/03-brief-technique.md section 2).
export default function Keypad({ field, onChange, onClose }) {
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
      </div>
    </div>
  );
}
