import { useState } from "react";
import Header from "../components/Header";
import CompteurImage from "../components/CompteurImage";
import { fmt } from "../components/format";
import { ALV } from "../data/constants";
import { useLotsEnPonte } from "../lib/useLotsEnPonte";

// Comptage sur photo, hors de toute fiche : on compte, on lit le résultat, on
// le recopie là où il doit aller. Rien n'est enregistré depuis cet écran —
// c'est un instrument de mesure, pas une écriture. La fiche de ponte reste le
// seul endroit où la collecte du jour s'enregistre, sinon deux chemins
// d'écriture finiraient par se contredire.
export default function Comptage() {
  const lots = useLotsEnPonte();
  const [compteur, setCompteur] = useState(null); // null | "oeufs" | "poules"
  const [oeufs, setOeufs] = useState(null);
  const [poules, setPoules] = useState(null);
  const [lotId, setLotId] = useState(null);

  const lot = lots.find((l) => l.id === lotId) ?? null;
  const ecart = lot && poules != null ? poules - lot.vivant : null;

  return (
    <div className="tf">
      <Header />
      <main className="tf-body">
        <p className="tf-eyebrow">Comptage · sur photo</p>
        <h1 className="tf-h1">Compter sur une photo</h1>
        <p className="tf-sub">
          La photo est analysée sur le téléphone, sans réseau. La détection propose un
          comptage, tu le corriges au doigt, et c'est ton chiffre qui compte.
        </p>

        <div className="tf-card">
          <div className="tf-cardhead">
            <span className="tf-cardtitle">Œufs</span>
            <span className="tf-tag">DÉTECTION AUTOMATIQUE</span>
          </div>
          {oeufs == null ? (
            <p className="tf-note">
              Photographie l'alvéole <strong>bien à plat, du dessus</strong>, en remplissant le cadre.
              De biais, les œufs du fond deviennent des ovales serrés que la détection confond.
            </p>
          ) : (
            <div className="tf-compte-resultat">
              <span className="tf-compte-n">{fmt(oeufs)}</span>
              <span className="tf-compte-l">
                œufs · {Math.floor(oeufs / ALV)} alvéole{Math.floor(oeufs / ALV) > 1 ? "s" : ""} pleine
                {Math.floor(oeufs / ALV) > 1 ? "s" : ""} et {oeufs % ALV} au détail
              </span>
            </div>
          )}
          <div className="tf-compteur-outils">
            <button className="tf-role" onClick={() => setCompteur("oeufs")}>
              {oeufs == null ? "Compter des œufs" : "Recompter"}
            </button>
          </div>
          <p className="tf-note">
            Pour que ce chiffre entre dans la collecte du jour, passe par la fiche de
            ponte : elle a le même bouton photo, et elle sait dans quel calibre le poser.
          </p>
        </div>

        <div className="tf-card">
          <div className="tf-cardhead">
            <span className="tf-cardtitle">Poules</span>
            <span className="tf-tag">POINTAGE AU DOIGT</span>
          </div>
          <p className="tf-note">
            Ici la détection automatique est éteinte, et ce n'est pas un oubli. Des poules
            qui se chevauchent, bougent et se cachent sous les mangeoires ne se détectent
            pas de façon fiable : le chiffre serait faux sans qu'on sache de combien.
            Tu pointes chaque poule du doigt, l'application tient le compte et garde les
            marques — c'est le pointage qu'on fait sur papier, sans perdre sa ligne.
            Le bouton <strong>Détecter</strong> reste là si tu veux voir ce qu'elle en dit.
          </p>

          {poules != null && (
            <div className="tf-compte-resultat">
              <span className="tf-compte-n">{fmt(poules)}</span>
              <span className="tf-compte-l">poules pointées sur la photo</span>
            </div>
          )}

          {lots.length > 0 && (
            <div className="tf-chips">
              {lots.map((l) => (
                <button key={l.id} className="tf-chip" data-on={lotId === l.id ? 1 : 0}
                  onClick={() => setLotId(lotId === l.id ? null : l.id)}>
                  {l.id}
                </button>
              ))}
            </div>
          )}

          {/* L'écart avec le registre est le seul usage honnête du comptage par
              photo sur des poules : il ne remplace pas l'effectif, il signale
              qu'il faut aller vérifier. Une photo ne voit jamais tout le
              bâtiment, donc un écart négatif est normal — c'est son ampleur,
              répétée d'un jour à l'autre, qui parle. */}
          {ecart != null && (
            <p className="tf-note" data-alerte={Math.abs(ecart) > lot.vivant * 0.1 ? 1 : 0}>
              Registre {lot.id} : {fmt(lot.vivant)} vivantes. Écart avec la photo :{" "}
              {ecart > 0 ? "+" : ""}{fmt(ecart)}. Une photo ne couvre qu'une partie du bâtiment —
              compare deux photos du même angle plutôt que la photo au registre.
            </p>
          )}

          <div className="tf-compteur-outils">
            <button className="tf-role" onClick={() => setCompteur("poules")}>
              {poules == null ? "Compter des poules" : "Recompter"}
            </button>
          </div>
        </div>
      </main>

      {compteur === "oeufs" && (
        <CompteurImage
          titre="Œufs sur la photo"
          aide="Alvéole à plat, vue du dessus, qui remplit le cadre."
          onValider={(n) => setOeufs(n)}
          onFermer={() => setCompteur(null)}
          libelleValider="Garder"
        />
      )}
      {compteur === "poules" && (
        <CompteurImage
          titre="Poules sur la photo"
          aide="Cadre une zone que tu peux couvrir d'un regard. Deux photos valent mieux qu'une seule trop large."
          autoDetecter={false}
          onValider={(n) => setPoules(n)}
          onFermer={() => setCompteur(null)}
          libelleValider="Garder"
        />
      )}
    </div>
  );
}
