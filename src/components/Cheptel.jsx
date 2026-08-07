import { useEffect, useState } from "react";
import NumField from "./NumField";
import Keypad from "./Keypad";
import { fmt } from "./format";
import { supabase } from "../lib/supabaseClient";
import { enqueue, onQueueChange } from "../lib/offlineQueue";

// L'effectif vivant n'est pas stocké : la vue v_effectif le calcule comme
// `effectif_initial - mortalité cumulée`. Pour que la direction saisisse
// directement le nombre de poules réellement comptées, on remonte le calcul et
// on écrit dans `effectif_initial` la valeur qui redonnera ce vivant-là,
// mortalité déjà enregistrée comprise.
//
// Conséquence à connaître : après un comptage, `effectif_initial` ne désigne
// plus l'effectif du jour de la mise en place mais un point de départ
// recalculé. C'est le prix à payer pour corriger un cheptel sans toucher aux
// saisies de mortalité, qui sont des faits datés et ne doivent pas bouger.
export default function Cheptel() {
  const [lots, setLots] = useState([]);
  const [pad, setPad] = useState(null);
  const [flash, setFlash] = useState("");

  const charger = () => {
    supabase
      .from("v_effectif")
      .select("lot_id, nom, en_ponte, effectif_initial, vivant")
      .then(({ data, error }) => {
        if (error || !data) return;
        setLots([...data].sort((a, b) => a.lot_id.localeCompare(b.lot_id)));
      });
  };

  useEffect(() => {
    charger();
    return onQueueChange(charger);
  }, []);

  const enregistrer = async (lotId, vivantVoulu) => {
    const lot = lots.find((l) => l.lot_id === lotId);
    if (!lot) return;
    const mortaliteCumulee = lot.effectif_initial - lot.vivant;
    const nouvelInitial = vivantVoulu + mortaliteCumulee;
    // `lots.effectif_initial` porte un check > 0 : un cheptel à zéro serait
    // refusé par la base. On le dit ici plutôt que de laisser l'écriture partir.
    if (nouvelInitial <= 0) {
      setFlash("L'effectif doit rester supérieur à zéro.");
      setTimeout(() => setFlash(""), 3000);
      return;
    }
    setLots((ls) =>
      ls.map((l) =>
        l.lot_id === lotId ? { ...l, vivant: vivantVoulu, effectif_initial: nouvelInitial } : l
      )
    );
    await enqueue({
      table: "lots",
      kind: "update",
      payload: { effectif_initial: nouvelInitial },
      match: { id: lotId },
    });
    setFlash(`${lotId} : ${fmt(vivantVoulu)} poules vivantes.`);
    setTimeout(() => setFlash(""), 2600);
  };

  const ouvrir = (lot) =>
    setPad({
      key: lot.lot_id,
      label: `${lot.lot_id} — poules vivantes`,
      unit: "poules",
      value: lot.vivant,
      depart: lot.vivant,
    });

  const fermer = () => {
    if (pad && pad.value !== pad.depart) enregistrer(pad.key, pad.value);
    setPad(null);
  };

  return (
    <div className="tf-card">
      <div className="tf-cardhead">
        <span className="tf-cardtitle">Cheptel par bâtiment</span>
        <span className="tf-tag">{fmt(lots.reduce((s, l) => s + l.vivant, 0))} POULES</span>
      </div>

      {lots.length === 0 ? (
        <p className="tf-empty">Bâtiments non chargés — vérifie la connexion.</p>
      ) : (
        <div className="tf-fields">
          {lots.map((l) => (
            <NumField
              key={l.lot_id}
              label={`${l.lot_id} · ${l.nom}${l.en_ponte ? "" : " (poulettes)"}`}
              unit="poules"
              value={l.vivant}
              detail={
                l.effectif_initial - l.vivant > 0
                  ? `${fmt(l.effectif_initial - l.vivant)} mortes depuis la mise en place`
                  : null
              }
              onOpen={() => ouvrir(l)}
            />
          ))}
        </div>
      )}

      <p className="tf-note">
        Saisis le nombre de poules réellement comptées dans le bâtiment. La mortalité déjà
        enregistrée reste déduite pour les jours suivants — un comptage corrige l'écart accumulé,
        il n'efface pas les saisies du chef de ferme.
      </p>

      {flash && <div className="tf-flash">{flash}</div>}
      <Keypad field={pad} onChange={(v) => setPad({ ...pad, value: v })} onClose={fermer} />
    </div>
  );
}
