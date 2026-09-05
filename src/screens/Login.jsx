import { useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { TEAM } from "../data/team";
import Version from "../components/Version";

const CODE_LEN = 6; // longueur minimale par défaut de Supabase Auth — voir src/data/team.js

export default function Login() {
  const [qui, setQui] = useState(TEAM[0].key);
  const [pin, setPin] = useState("");
  const [erreur, setErreur] = useState("");
  const [envoi, setEnvoi] = useState(false);

  const entree = TEAM.find((t) => t.key === qui);

  const connecter = async () => {
    setEnvoi(true);
    setErreur("");
    const { error } = await supabase.auth.signInWithPassword({ email: entree.email, password: pin });
    setEnvoi(false);
    if (error) {
      // « Code incorrect » pour toute erreur, c'était mentir une fois sur
      // deux : une coupure réseau ou une limite de tentatives donne le même
      // refus, et on retape indéfiniment un code qui est pourtant le bon.
      const sansReponse = !error.status || error.status >= 500;
      setErreur(
        sansReponse
          ? "Le serveur ne répond pas. Vérifie la connexion, puis réessaie."
          : error.status === 429
            ? "Trop de tentatives. Attends une minute avant de réessayer."
            : "Code incorrect. Réessaie."
      );
      setPin("");
    }
  };

  return (
    <div className="tf">
      <div className="tf-login">
        <div className="tf-login-in">
          <img src="/icones/icone-blanc-512.png" alt="Tama Ferme" />
          <div className="tf-login-t">Tama Ferme</div>
          <div className="tf-login-s">Gestion de la ferme · Toamasina</div>

          <div className="tf-login-lbl">Qui es-tu ?</div>
          <div className="tf-who">
            {TEAM.map((t) => (
              <button key={t.key} data-on={qui === t.key ? 1 : 0} onClick={() => { setQui(t.key); setPin(""); setErreur(""); }}>
                {t.nom}
              </button>
            ))}
          </div>

          <div className="tf-login-lbl">Code à {CODE_LEN} chiffres</div>
          <div className="tf-pin">
            {[...Array(CODE_LEN).keys()].map((i) => <i key={i} data-on={pin.length > i ? 1 : 0} />)}
          </div>

          {erreur && <p className="tf-login-err">{erreur}</p>}

          <div className="tf-keys">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9", "C", "0", "<"].map((k) => (
              <button key={k} className="tf-key" onClick={() => {
                if (envoi) return;
                if (k === "C") return setPin("");
                if (k === "<") return setPin(pin.slice(0, -1));
                if (pin.length < CODE_LEN) setPin(pin + k);
              }}>{k}</button>
            ))}
            <button className="tf-key" data-ok="1" disabled={pin.length < CODE_LEN || envoi} onClick={connecter}>
              {envoi ? "…" : "Entrer"}
            </button>
          </div>
        </div>
        {/* Version complète ici : c'est l'écran qu'on demande de regarder quand
            on cherche pourquoi un téléphone ne se comporte pas comme un autre. */}
        <p className="tf-login-v"><Version complet /></p>
      </div>
    </div>
  );
}
