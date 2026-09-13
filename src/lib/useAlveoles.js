import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import { lectureCachee } from "./cacheLecture";
import { onQueueChange, operationsEnAttente } from "./offlineQueue";

// Les alvéoles de la ferme qui dorment chez un client, par client.
//
// La vue ne rend que les clients qui empruntent nos alvéoles : la présence
// d'une entrée dit donc à la fois « celui-là compte ses alvéoles » et
// combien il en a. C'est aussi pourquoi le drapeau n'est pas allé rejoindre
// les colonnes de `useClients` : là-bas, une colonne absente ferait refuser
// toute la liste des clients et la caisse repartirait sur son repli d'usine,
// sans identifiants, jusqu'à ce que la migration soit jouée. Ici, une vue
// absente ne coûte que les alvéoles.
//
// Ce qui attend la synchronisation compte déjà : les alvéoles sont parties
// avec le client, que le téléphone ait pu le dire ou non. Sans ça le solde
// saute au moment où la file se vide, et on ne sait plus s'il a bougé parce
// qu'on a saisi ou parce que le réseau est revenu.
export function useAlveoles() {
  const [parClient, setParClient] = useState({});

  useEffect(() => {
    let vivant = true;
    const relire = async () => {
      const { data } = await lectureCachee("v_alveoles_client", () =>
        supabase.from("v_alveoles_client").select("*"));
      const etat = {};
      (data ?? []).forEach((r) => {
        etat[r.client_id] = {
          nom: r.nom,
          sorties: Number(r.sorties ?? 0),
          rendues: Number(r.rendues ?? 0),
          chez: Number(r.chez_le_client ?? 0),
          dernier: r.dernier_mouvement,
          enAttente: false,
        };
      });
      const ops = await operationsEnAttente("mouvements_alveoles");
      ops.forEach((op) => {
        const m = op.payload;
        if (!m?.client_id) return;
        const e = (etat[m.client_id] ??= { sorties: 0, rendues: 0, chez: 0, dernier: null });
        e.sorties += m.sorties ?? 0;
        e.rendues += m.rendues ?? 0;
        e.chez += (m.sorties ?? 0) - (m.rendues ?? 0);
        if (!e.dernier || m.date > e.dernier) e.dernier = m.date;
        e.enAttente = true;
      });
      if (vivant) setParClient(etat);
    };
    relire();
    const stop = onQueueChange(relire);
    return () => { vivant = false; stop(); };
  }, []);

  return parClient;
}
