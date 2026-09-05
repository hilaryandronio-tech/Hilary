import { NavLink } from "react-router-dom";
import { dLabel, today } from "./format";
import EtatSync from "./EtatSync";
import Version from "./Version";
import { useAuth } from "../context/AuthContext";

// Chaque rôle arrive directement sur son écran principal après connexion
// (docs/03-brief-technique.md section 4). Certains rôles ont plus d'un écran
// (point de vente : caisse + créances ; direction : accès complet) — ces
// onglets ne servent qu'à naviguer entre les écrans déjà autorisés par les
// policies RLS, ils ne changent pas les droits.
const ECRANS = {
  chef_ferme: [
    { to: "/ferme", l: "Ferme" },
    { to: "/suivi", l: "Suivi" },
  ],
  magasiniere: [{ to: "/magasin", l: "Ponte" }],
  point_vente: [
    { to: "/vente", l: "Caisse" },
    { to: "/commandes", l: "Commandes" },
    { to: "/collecte", l: "Ponte" },
    { to: "/creances", l: "Créances" },
    { to: "/clients", l: "Clients" },
  ],
  direction: [
    { to: "/direction", l: "Tableau de bord" },
    { to: "/journal", l: "Journal" },
    { to: "/ferme", l: "Ferme" },
    { to: "/suivi", l: "Suivi" },
    { to: "/magasin", l: "Ponte" },
    { to: "/vente", l: "Caisse" },
    { to: "/commandes", l: "Commandes" },
    { to: "/creances", l: "Créances" },
    { to: "/clients", l: "Clients" },
    { to: "/bilan", l: "Bilan" },
  ],
};

export default function Header() {
  const { profil, signOut } = useAuth();
  const ecrans = ECRANS[profil?.role] ?? [];

  return (
    <header className="tf-head">
      <div className="tf-brand">
        <div className="tf-mark">
          <img src="/icones/icone-blanc-512.png" alt="Tama Ferme" />
          <div className="tf-logo">Tama<span>·</span>Ferme</div>
        </div>
        <div className="tf-brand-etat">
          <div className="tf-date">{dLabel(today())}</div>
          <EtatSync />
        </div>
      </div>
      <div className="tf-roles">
        {ecrans.map((e) => (
          <NavLink key={e.to} to={e.to} className={({ isActive }) => `tf-role${isActive ? " tf-role-active" : ""}`}>
            {e.l}
          </NavLink>
        ))}
        <button className="tf-role" onClick={signOut}>Déconnexion</button>
        {/* En bout de rangée, hors du chemin : l'équipe reste connectée des
            jours entiers, la version doit rester atteignable sans se
            déconnecter. */}
        <span className="tf-role tf-role-version"><Version /></span>
      </div>
    </header>
  );
}
