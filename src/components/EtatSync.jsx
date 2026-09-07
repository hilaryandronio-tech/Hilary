import { useEffect, useState } from "react";
import { etatFile, listerEchecs, oublierEchec, onQueueChange, rejouerEchecs } from "../lib/offlineQueue";
import { dLabel, fmt } from "./format";

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

// Le nom de la table et la date ne suffisaient pas à décider. Devant « Vente
// — dim. 06 sept. », personne ne peut dire s'il s'agit d'une livraison de
// 400 000 Ar à ressaisir ou d'un doublon à jeter, et le bouton d'à côté
// efface définitivement. On montre donc ce qu'il y a dedans.
function resume(echec) {
  const lignes = [].concat(echec.payload ?? []);
  const premiere = lignes[0] ?? {};
  const nom = NOMS_TABLES[echec.table] ?? echec.table;
  const bouts = [];
  if (premiere.date) bouts.push(dLabel(premiere.date));
  if (premiere.montant != null) bouts.push(`${fmt(premiere.montant)} Ar`);
  // Un détail de vente ou de ponte porte plusieurs lignes de calibre : c'est
  // le total qui parle, pas la première.
  const oeufs = lignes.reduce((s, l) => s + (l?.oeufs ?? 0), 0);
  if (oeufs) bouts.push(`${fmt(oeufs)} œufs`);
  return bouts.length ? `${nom} — ${bouts.join(" · ")}` : nom;
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
            {/* « Droits insuffisants » se lit comme une erreur de compte, et
                c'en est rarement une : le plus souvent la session avait
                expiré au moment de l'envoi, et le serveur a vu passer une
                requête anonyme. Réessayer une fois reconnecté suffit. Sans
                cette phrase, on efface une vraie vente en croyant qu'elle
                sera toujours refusée. */}
            <p className="tf-note">
              « Droits insuffisants » signifie le plus souvent que la session avait expiré
              quand la saisie est partie, pas que le compte est en cause. Clique d'abord
              sur <b>Tout réessayer</b> : maintenant que tu es connecté, elle passera.
              Ne supprime que ce que tu retrouves déjà enregistré ailleurs.
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
