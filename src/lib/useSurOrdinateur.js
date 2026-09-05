import { useEffect, useState } from "react";

// Souris ou doigt ? On ne devine pas à la largeur de l'écran — une tablette
// posée sur un clavier est large et tactile, un portable est étroit et pointé.
// `hover: hover` et `pointer: fine` décrivent l'appareil de pointage lui-même :
// vrai pour une souris ou un pavé tactile, faux pour un doigt.
//
// Le média est réévalué en direct : brancher une souris sur une tablette, ou
// passer en mode tablette sur un portable convertible, bascule l'interface sans
// recharger.
const REQUETE = "(hover: hover) and (pointer: fine)";

export function useSurOrdinateur() {
  const [surOrdinateur, setSurOrdinateur] = useState(
    () => typeof window !== "undefined" && window.matchMedia(REQUETE).matches
  );

  useEffect(() => {
    const media = window.matchMedia(REQUETE);
    const suivre = (e) => setSurOrdinateur(e.matches);
    media.addEventListener("change", suivre);
    return () => media.removeEventListener("change", suivre);
  }, []);

  return surOrdinateur;
}
