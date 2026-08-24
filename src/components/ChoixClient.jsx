import { useMemo, useState } from "react";
import { sansAccent } from "./format";

// Une pastille par client tenait tant qu'il y en avait quatre. Avec près de
// soixante, il faut chercher. Le champ filtre sans tenir compte des accents ni
// de la casse — « angeline » trouve « Angéline ».
//
// Le filtre ne montre que ce qui correspond, sans y remettre d'office la
// sélection courante : ça polluait chaque recherche d'un nom sans rapport.
// C'est à l'écran appelant de rappeler en clair à qui la saisie est destinée,
// sans quoi on cherche un client, on tape des chiffres sans avoir cliqué, et
// la vente part chez le précédent.


export default function ChoixClient({ clients, selection, onSelect, marque }) {
  const [recherche, setRecherche] = useState("");

  const affiches = useMemo(() => {
    const q = sansAccent(recherche.trim());
    if (!q) return clients;
    return clients.filter((c) => sansAccent(c.nom).includes(q));
  }, [clients, recherche]);

  return (
    <>
      <input
        className="tf-recherche"
        type="search"
        value={recherche}
        onChange={(e) => setRecherche(e.target.value)}
        placeholder={`Chercher parmi ${clients.length} clients…`}
        aria-label="Chercher un client"
      />
      <div className="tf-chips tf-chips-scroll">
        {affiches.map((cl) => (
          <button
            key={cl.nom}
            className="tf-chip"
            data-on={selection === cl.nom ? 1 : 0}
            data-dot={marque?.(cl) ? 1 : 0}
            onClick={() => onSelect(cl.nom)}
          >
            {cl.nom}
          </button>
        ))}
        {affiches.length === 0 && <p className="tf-empty">Aucun client à ce nom.</p>}
      </div>
    </>
  );
}
