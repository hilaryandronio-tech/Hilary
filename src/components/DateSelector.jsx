import { dLabel, today } from "./format";

// Lets a screen enter data for a past day, not just today — needed to
// backfill days entered late or missed before the app was in use.
//
// `avenir` lifts the ceiling: an order is taken today to be delivered next
// week, so that one screen must be able to move forward. Everywhere else the
// cap stands — there is nothing to record about a day that has not happened.
export default function DateSelector({ value, onChange, avenir = false }) {
  const shift = (jours) => {
    const d = new Date(value + "T12:00:00");
    d.setDate(d.getDate() + jours);
    const next = d.toISOString().slice(0, 10);
    if (avenir || next <= today()) onChange(next);
  };
  const estAujourdhui = value === today();

  return (
    <div className="tf-dateselect">
      <button className="tf-dateselect-nav" onClick={() => shift(-1)} aria-label="Jour précédent">‹</button>
      <div className="tf-dateselect-val">
        {estAujourdhui ? "Aujourd'hui" : dLabel(value)}
      </div>
      <button className="tf-dateselect-nav" onClick={() => shift(1)}
        disabled={estAujourdhui && !avenir} aria-label="Jour suivant">›</button>
      {!estAujourdhui && (
        <button className="tf-dateselect-today" onClick={() => onChange(today())}>Aujourd'hui</button>
      )}
    </div>
  );
}
