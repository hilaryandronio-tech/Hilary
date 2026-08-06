import { useEffect, useState } from "react";
import { nombreEchecs, onQueueChange } from "../lib/offlineQueue";

// Un écran qui affiche un cumul doit avertir quand des saisies ont été
// refusées : elles ne sont ni dans Supabase ni dans la file d'attente, donc
// le total retombe à zéro comme si personne n'avait rien saisi. On ne les
// compte pas dans les chiffres — elles ne sont pas enregistrées — mais on
// refuse de faire comme si elles n'existaient pas.
export default function AlerteEchecs({ tables }) {
  const [combien, setCombien] = useState(0);

  useEffect(() => {
    const relire = () => nombreEchecs(tables).then(setCombien);
    relire();
    return onQueueChange(relire);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tables.join(",")]);

  if (!combien) return null;

  return (
    <p className="tf-note" data-alerte="1">
      {combien} saisie{combien > 1 ? "s" : ""} refusée{combien > 1 ? "s" : ""} par Supabase
      {combien > 1 ? " ne sont pas comptées" : " n'est pas comptée"} ici. Ouvre « non enregistrée
      {combien > 1 ? "s" : ""} » en haut de l'écran pour voir pourquoi.
    </p>
  );
}
