import { useEffect, useState } from "react";
import { lireEffectifs } from "./effectifs";
import { SEED_LOTS } from "../data/constants";

// Les bâtiments actuellement en ponte, partagés par l'écran de saisie de la
// magasinière et le relevé consulté au point de vente — les deux doivent
// montrer les mêmes colonnes.
//
// Le repli de constants.js n'est plus qu'un dernier recours, pour un téléphone
// qui n'aurait jamais réussi à charger la liste. Dès qu'elle l'a été une fois,
// c'est la vraie liste qui ressert hors ligne — sans quoi l'écran affichait
// 3 000 poules par bâtiment et un taux de ponte faux.
const seed = SEED_LOTS.filter((l) => l.en_ponte).map((l) => ({
  id: l.id,
  nom: l.nom,
  vivant: l.effectif_initial,
}));

export function useLotsEnPonte() {
  const [lots, setLots] = useState(seed);

  useEffect(() => {
    lireEffectifs().then(({ lots: data }) => {
      if (!data) return; // jamais chargé et hors ligne : on garde le repli
      setLots(
        data
          .filter((l) => l.en_ponte)
          .map((l) => ({ id: l.lot_id, nom: l.nom, vivant: l.vivant }))
      );
    });
  }, []);

  return lots;
}
