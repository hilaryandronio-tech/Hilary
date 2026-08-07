import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import { CLIENTS_FALLBACK } from "../data/constants";

// Les clients grossistes et leurs tarifs négociés, partagés par la caisse et
// la fiche client.
//
// Attention au repli : hors ligne au démarrage à froid, la liste vient de
// CLIENTS_FALLBACK et les `id` valent null. Un client sans id ne peut ni être
// facturé ni voir son historique — chaque écran doit le dire plutôt que de
// laisser croire à un client sans activité (voir src/data/constants.js).
export function useClients() {
  const [clients, setClients] = useState(CLIENTS_FALLBACK);

  useEffect(() => {
    supabase
      .from("clients")
      .select("id, nom, tarifs_clients(calibre, prix)")
      .eq("actif", true)
      .then(({ data, error }) => {
        if (error || !data?.length) return; // hors ligne : liste sans id, non vendable
        // Trié : PostgREST ne garantit aucun ordre, et une liste de soixante
        // clients qui change de place d'un chargement à l'autre est
        // impossible à parcourir.
        setClients(
          data
            .map((c) => ({
              id: c.id,
              nom: c.nom,
              tarifs: Object.fromEntries((c.tarifs_clients ?? []).map((t) => [t.calibre, t.prix])),
            }))
            .sort((a, b) => a.nom.localeCompare(b.nom, "fr"))
        );
      });
  }, []);

  return clients;
}
