import { useEffect, useState } from "react";
import { etatFile, listerEchecs, oublierEchec, onQueueChange, rejouerEchecs } from "../lib/offlineQueue";
import { dLabel } from "./format";

// Ce que la file d'attente a dans le ventre, affiché dans l'en-tête. Sans ça,
// une saisie refusée par Supabase ne se voit nulle part : l'écran affiche
// « Enregistré », la ligne dort dans IndexedDB, et personne ne l'apprend.

const NOMS_TABLES = {
  saisies_ferme: "Saisie ferme",
  pontes: "Fiche de ponte",
  ponte_lignes: "Détail de ponte",
  ventes: "Vente",
  vente_lignes: "Détail de vente",
  charges: "Charge",
  calibres: "Prix de vente",
  parametres: "Paramètre",
};

function resume(echec) {
  const ligne = Array.isArray(echec.payload) ? echec.payload[0] : echec.payload;
  const nom = NOMS_TABLES[echec.table] ?? echec.table;
  return ligne?.date ? `${nom} — ${dLabel(ligne.date)}` : nom;
}

export default function EtatSync() {
  const [etat, setEtat] = useState({ attente: 0, echecs: 0 });
  const [echecs, setEchecs] = useState([]);
  const [ouvert, setOuvert] = useState(false);

  useEffect(() => {
    const relire = () => {
      etatFile().then(setEtat);
      listerEchecs().then(setEchecs);
    };
    relire();
    return onQueueChange(relire);
  }, []);

  const supprimer = async (echec) => {
    const ok = window.confirm(
      `Supprimer définitivement « ${resume(echec)} » ? Cette saisie ne sera jamais enregistrée.`
    );
    if (ok) await oublierEchec(echec.id);
  };

  if (!etat.attente && !etat.echecs) return null;

  return (
    <>
      {etat.echecs > 0 ? (
        <button className="tf-sync" data-echec="1" onClick={() => setOuvert(true)}>
          {etat.echecs} non enregistrée{etat.echecs > 1 ? "s" : ""}
        </button>
      ) : (
        <span className="tf-sync">
          {etat.attente} en attente
        </span>
      )}

      {ouvert && (
        <div className="tf-pad" onClick={() => setOuvert(false)}>
          <div className="tf-pad-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="tf-pad-head">
              <span className="tf-pad-label">Saisies non enregistrées</span>
              <button className="tf-role" data-on="1" onClick={() => setOuvert(false)}>Fermer</button>
            </div>
            <p className="tf-note">
              Supabase a refusé ces saisies. Elles ne bloquent plus les suivantes, mais
              elles ne sont pas dans les comptes tant qu'elles sont ici.
            </p>
            <div className="tf-echecs">
              {echecs.map((echec) => (
                <div className="tf-echec" key={echec.id}>
                  <div>
                    <div className="tf-echec-t">{resume(echec)}</div>
                    <div className="tf-echec-e">{echec.erreur}</div>
                  </div>
                  <button className="tf-due-btn" onClick={() => supprimer(echec)}>Supprimer</button>
                </div>
              ))}
            </div>
            <div className="tf-cta-in">
              <button className="tf-btn" onClick={() => rejouerEchecs()}>Tout réessayer</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
