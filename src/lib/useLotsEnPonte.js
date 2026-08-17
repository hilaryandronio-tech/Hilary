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
        // Trié : PostgREST ne garantit aucun ordre, et des bâtiments qui
        // changent de place d'un chargement à l'autre font choisir le mauvais.
        setLots(
          data
            .filter((l) => l.en_ponte)
            .sort((a, b) => a.lot_id.localeCompare(b.lot_id))
            .map((l) => ({ id: l.lot_id, nom: l.nom, vivant: l.vivant }))
        );
      });
  }, []);

  return lots;
}
