import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import Login from "./screens/Login";
import ChefFerme from "./screens/ChefFerme";
import Magasiniere from "./screens/Magasiniere";
import Collecte from "./screens/Collecte";
import Clients from "./screens/Clients";
import Suivi from "./screens/Suivi";
import PointVente from "./screens/PointVente";
import Creances from "./screens/Creances";
import Bilan from "./screens/Bilan";
import Direction from "./screens/Direction";

// Écran d'accueil par rôle : chacun arrive directement sur son écran après
// connexion (docs/03-brief-technique.md section 4). La direction seule peut
// naviguer entre tous les écrans (routes /* ci-dessous).
const ECRAN_PAR_ROLE = {
  chef_ferme: "/ferme",
  magasiniere: "/magasin",
  point_vente: "/vente",
  direction: "/direction",
};

function RoutePrivee({ roles, children }) {
  const { session, profil, loading } = useAuth();
  if (loading || (session && !profil)) return <div className="tf" />;
  if (!session) return <Navigate to="/connexion" replace />;
  if (roles && !roles.includes(profil.role) && profil.role !== "direction") {
    return <Navigate to={ECRAN_PAR_ROLE[profil.role] ?? "/connexion"} replace />;
  }
  return children;
}

export default function App() {
  const { session, profil, loading } = useAuth();

  return (
    <Routes>
      <Route
        path="/connexion"
        element={
          loading || (session && !profil) ? (
            <div className="tf" />
          ) : session ? (
            <Navigate to={ECRAN_PAR_ROLE[profil.role] ?? "/ferme"} replace />
          ) : (
            <Login />
          )
        }
      />
      <Route path="/ferme" element={<RoutePrivee roles={["chef_ferme"]}><ChefFerme /></RoutePrivee>} />
      {/* Calendrier vaccinal et traitements — le chef de ferme les exécute. */}
      <Route path="/suivi" element={<RoutePrivee roles={["chef_ferme"]}><Suivi /></RoutePrivee>} />
      <Route path="/magasin" element={<RoutePrivee roles={["magasiniere"]}><Magasiniere /></RoutePrivee>} />
      <Route path="/vente" element={<RoutePrivee roles={["point_vente"]}><PointVente /></RoutePrivee>} />
      {/* Le relevé de collecte en lecture, pour vendre en sachant ce qui est rentré. */}
      <Route path="/collecte" element={<RoutePrivee roles={["point_vente"]}><Collecte /></RoutePrivee>} />
      <Route path="/creances" element={<RoutePrivee roles={["point_vente"]}><Creances /></RoutePrivee>} />
      {/* Le compte d'un client grossiste, réglé ou non — l'écran Créances ne
          garde que les impayées. */}
      <Route path="/clients" element={<RoutePrivee roles={["point_vente"]}><Clients /></RoutePrivee>} />
      <Route path="/bilan" element={<RoutePrivee roles={["direction"]}><Bilan /></RoutePrivee>} />
      <Route path="/direction" element={<RoutePrivee roles={["direction"]}><Direction /></RoutePrivee>} />
      <Route path="*" element={<Navigate to="/connexion" replace />} />
    </Routes>
  );
}
