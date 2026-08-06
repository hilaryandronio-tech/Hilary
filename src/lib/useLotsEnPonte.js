import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import { SEED_LOTS } from "../data/constants";

// Les bâtiments actuellement en ponte, partagés par l'écran de saisie de la
// magasinière et le relevé consulté au point de vente — les deux doivent
// montrer les mêmes colonnes.
const seed = SEED_LOTS.filter((l) => l.en_ponte).map((l) => ({
  id: l.id,
  nom: l.nom,
  vivant: l.effectif_initial,
}));

export function useLotsEnPonte() {
  const [lots, setLots] = useState(seed);

  useEffect(() => {
    supabase
      .from("v_effectif")
      .select("lot_id, nom, en_ponte, vivant")
      .then(({ data, error }) => {
        if (error || !data) return; // hors ligne : on garde le seed local
        setLots(
          data
            .filter((l) => l.en_ponte)
            .map((l) => ({ id: l.lot_id, nom: l.nom, vivant: l.vivant }))
        );
      });
  }, []);

  return lots;
}
