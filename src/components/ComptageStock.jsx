import { useState } from "react";
import NumField from "./NumField";
import Keypad from "./Keypad";
import { fmt, today } from "./format";
import { ALV, CALIBRES, POIDS } from "../data/constants";
import { enqueue } from "../lib/offlineQueue";
import { useAuth } from "../context/AuthContext";

// Le comptage physique du magasin. C'est lui qui donne au stock son point de
// départ : à partir de sa date, le solde ne dépend plus que de ce qui entre et
// de ce qui sort, et l'historique d'avant cesse de peser.
//
// À compter le soir, après la collecte et après les livraisons — sinon le
// comptage et les mouvements du jour se chevauchent.

const LIGNES = [...CALIBRES, "CASSE"];
const libelle = (c) => (c === "CASSE" ? "Cassés" : c);

export default function ComptageStock({ onFini }) {
  const { profil } = useAuth();
  const [ouvert, setOuvert] = useState(false);
  const [date, setDate] = useState(today());
  const [draft, setDraft] = useState({});
  const [pad, setPad] = useState(null);
  const [envoi, setEnvoi] = useState(false);

  const val = (c) => draft[c] || 0;
  const poser = (c, v) => setDraft((d) => ({ ...d, [c]: v }));
  const total = LIGNES.reduce((s, c) => s + val(c), 0);

  const enregistrer = async () => {
    setEnvoi(true);
    // Toutes les lignes partent, y compris à zéro : un calibre laissé vide
    // veut dire « il n'y en a plus », pas « je n'ai pas compté ».
    await enqueue({
      table: "stock_oeufs_compte",
      conflict: "date,calibre",
      payload: LIGNES.map((c) => ({ date, calibre: c, oeufs: val(c), auteur: profil?.id })),
    });
    setEnvoi(false);
    setOuvert(false);
    setDraft({});
    onFini?.();
  };

  if (!ouvert) {
    return (
      <div className="tf-chips">
        <button className="tf-chip" onClick={() => setOuvert(true)}>Compter le magasin</button>
      </div>
    );
  }

  return (
    <div className="tf-card">
      <div className="tf-cardhead">
        <span className="tf-cardtitle">Comptage du magasin</span>
        <span className="tf-tag">{fmt(total)} ŒUFS</span>
      </div>

      <label className="tf-field" style={{ marginBottom: 8 }}>
        <span className="tf-label">Compté le</span>
        <span className="tf-value">
          <input className="tf-saisie" type="date" value={date} max={today()}
                 onChange={(e) => setDate(e.target.value)} />
        </span>
      </label>

      <div className="tf-grid4">
        {LIGNES.map((c) => (
          <NumField key={c} label={libelle(c)} sous={POIDS[c]} unit="œufs" value={val(c)}
            detail={val(c) ? `${(val(c) / ALV).toFixed(1)} alv` : null}
            onOpen={() => setPad({ key: c, label: `${libelle(c)} en magasin`, unit: "œufs", value: val(c) })}
            onChange={(v) => poser(c, v)} />
        ))}
      </div>

      <div className="tf-cta-in" style={{ marginTop: 10 }}>
        <button className="tf-btn" onClick={enregistrer} disabled={envoi}>
          {envoi ? "…" : "Enregistrer le comptage"}
        </button>
        <button className="tf-btn tf-btn-ghost" onClick={() => setOuvert(false)}>Annuler</button>
      </div>

      <p className="tf-note">
        À compter le soir, après la collecte et après les livraisons. Ce chiffre devient le point
        de départ : le stock affiché repartira de là, et tout ce qui précède cessera de compter.
        Un calibre laissé à zéro veut dire qu'il n'en reste aucun.
      </p>

      <Keypad field={pad}
        onChange={(v) => { poser(pad.key, v); setPad({ ...pad, value: v }); }}
        onClose={() => setPad(null)} />
    </div>
  );
}
