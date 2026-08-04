import { fmt } from "./format";

export default function NumField({ label, unit, value, tone, onOpen }) {
  return (
    <button className="tf-field" data-filled={value ? 1 : 0} data-tone={tone} onClick={onOpen}>
      <span className="tf-label">{label}</span>
      <span className="tf-value" data-zero={value ? 0 : 1}>
        {fmt(value)}<span className="tf-unit">{unit}</span>
      </span>
    </button>
  );
}
