import { supabase } from "./supabaseClient";
import { lectureCachee } from "./cacheLecture";

// Quatre écrans lisaient `v_effectif` chacun de son côté, avec ses colonnes.
// Sous un cache, cela voudrait dire qu'un écran ouvert hors ligne reste vide
// parce que c'est un autre qui avait été consulté en ligne. Une seule requête,
// toutes les colonnes, une seule clé : n'importe quel écran consulté avec du
// réseau garnit le cache pour tous les autres.
//
// Triés : PostgREST ne garantit aucun ordre, et des bâtiments qui changent de
// place d'un chargement à l'autre font choisir le mauvais.
export async function lireEffectifs() {
  const { data, cache, a } = await lectureCachee("v_effectif", () =>
    supabase
      .from("v_effectif")
      .select("lot_id, nom, en_ponte, effectif_initial, vivant, age_semaines, prix_provende_kg")
  );
  return {
    lots: data ? [...data].sort((x, y) => x.lot_id.localeCompare(y.lot_id)) : null,
    cache,
    a,
  };
}
