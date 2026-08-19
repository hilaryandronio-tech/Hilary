import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import { lectureCachee } from "./cacheLecture";
import { CLIENTS_FALLBACK } from "../data/constants";

// Les clients grossistes et leurs tarifs négociés, partagés par la caisse et
// la fiche client.
//
// La liste chargée une fois est conservée sur le téléphone et ressert hors
// ligne, tarifs négociés compris. Le repli de CLIENTS_FALLBACK ne sert plus
// qu'au tout premier lancement sans réseau : ses `id` valent null, un client
// sans id ne peut ni être facturé ni voir son historique, et l'écran de caisse
// le dit alors en clair.
export function useClients() {
  const [clients, setClients] = useState(CLIENTS_FALLBACK);

  useEffect(() => {
    lectureCachee("clients", () =>
      supabase
        .from("clients")
        .select("id, nom, tarifs_clients(calibre, prix)")
        .eq("actif", true)
    )
      .then(({ data }) => {
        if (!data?.length) return; // jamais chargé et hors ligne : repli sans id
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
