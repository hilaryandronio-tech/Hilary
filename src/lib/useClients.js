import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";
import { lectureCachee } from "./cacheLecture";
import { onQueueChange, operationsEnAttente } from "./offlineQueue";
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
  const [serveur, setServeur] = useState(null);
  const [file, setFile] = useState([]);

  useEffect(() => {
    let vivant = true;
    const relire = async () => {
      const { data } = await lectureCachee("clients", () =>
        supabase
          .from("clients")
          .select("id, nom, adresse, nif, stat, refs_legales, telephone_fac, langue, coordonnees_paiement, conditionnement, delai_paiement_jours, tarifs_clients(calibre, prix, prix_facture)")
          .eq("actif", true)
      );
      if (!vivant) return;
      if (data?.length) {
        setServeur(
          data.map((c) => ({
            ...c,
            tarifs: Object.fromEntries((c.tarifs_clients ?? []).map((t) => [t.calibre, t.prix])),
            // Ce que le client paie, quand ce n'est pas ce que la ferme
            // encaisse — la part d'un intermédiaire, chez Mercy Ships.
            tarifsFacture: Object.fromEntries(
              (c.tarifs_clients ?? []).filter((t) => t.prix_facture)
                .map((t) => [t.calibre, t.prix_facture])
            ),
          }))
        );
      }
      // Un client créé hors ligne doit être facturable tout de suite : sans
      // ça, le responsable de vente le saisit, ne le voit pas revenir, et le
      // saisit une deuxième fois.
      const ops = await operationsEnAttente("clients");
      if (vivant) setFile(ops.map((op) => op.payload).filter((c) => c?.nom && c?.id));
    };
    relire();
    const stop = onQueueChange(relire);
    return () => { vivant = false; stop(); };
  }, []);

  return useMemo(() => {
    const base = serveur ?? CLIENTS_FALLBACK;
    // Le serveur fait foi : un client qui vient d'être synchronisé mais n'a
    // pas encore quitté la file apparaîtrait deux fois.
    const connus = new Set(base.map((c) => c.nom));
    const ajouts = file
      .filter((c) => !connus.has(c.nom))
      .map((c) => ({ id: c.id, nom: c.nom, tarifs: {} }));
    // Trié : PostgREST ne garantit aucun ordre, et une liste de soixante
    // clients qui change de place d'un chargement à l'autre est impossible à
    // parcourir.
    return [...base, ...ajouts].sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
  }, [serveur, file]);
}
