import { useState } from "react";
import { enqueue, uuid } from "../lib/offlineQueue";
import { sansAccent } from "./format";

// Créer un client depuis la caisse. Jusqu'ici la liste ne se remplissait que
// par script : un nouveau client attendait la direction, et la vente partait
// en « Comptoir », donc sans compte ni créance à son nom.


export default function NouveauClient({ clients, onCree }) {
  const [ouvert, setOuvert] = useState(false);
  const [nom, setNom] = useState("");
  const [erreur, setErreur] = useState(null);

  const fermer = () => {
    setOuvert(false);
    setNom("");
    setErreur(null);
  };

  const creer = async () => {
    const propre = nom.trim().replace(/\s+/g, " ");
    if (propre.length < 2) {
      setErreur("Écris le nom du client.");
      return;
    }
    // `clients.nom` est unique : sans ce contrôle, le doublon partirait dans
    // la file, serait refusé par la base et finirait en « saisie non
    // enregistrée » — un message que personne ne saurait relier à ça.
    const jumeau = clients.find((c) => sansAccent(c.nom) === sansAccent(propre));
    if (jumeau) {
      setErreur(`« ${jumeau.nom} » existe déjà dans la liste.`);
      return;
    }
    const id = uuid();
    await enqueue({
      table: "clients",
      payload: { id, nom: propre, type: "gros", delai_paiement_jours: 0, actif: true },
    });
    fermer();
    onCree?.(propre);
  };

  if (!ouvert) {
    return (
      <div className="tf-chips">
        <button className="tf-chip" onClick={() => setOuvert(true)}>+ Nouveau client</button>
      </div>
    );
  }

  return (
    <div className="tf-card">
      <div className="tf-cardhead">
        <span className="tf-cardtitle">Nouveau client</span>
        <span className="tf-tag">PRIX DE BASE</span>
      </div>
      <input
        className="tf-recherche"
        type="text"
        value={nom}
        autoFocus
        onChange={(e) => { setNom(e.target.value); setErreur(null); }}
        onKeyDown={(e) => e.key === "Enter" && creer()}
        placeholder="Nom du client"
        aria-label="Nom du nouveau client"
      />
      {erreur && <p className="tf-livraison-s" data-alerte="1">{erreur}</p>}
      <div className="tf-cta-in">
        <button className="tf-btn" onClick={creer} disabled={nom.trim().length < 2}>
          Créer le client
        </button>
        <button className="tf-btn tf-btn-ghost" onClick={fermer}>Annuler</button>
      </div>
      <p className="tf-note">
        Le client achète au prix de base de chaque calibre. Un tarif négocié se pose ensuite par
        la direction — demande-le si le prix a été convenu autrement.
      </p>
    </div>
  );
}
