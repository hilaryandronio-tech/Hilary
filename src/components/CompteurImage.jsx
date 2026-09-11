import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { analyser, chargerImage } from "../lib/detectionImage";
import { fmt } from "./format";

// Comptage sur photo. Le pointage au doigt est le mode normal : chaque doigt
// posé ajoute une marque, chaque doigt sur une marque la retire, et le nombre
// validé est le nombre de marques à l'écran.
//
// La détection automatique ne se déclenche plus à l'ouverture d'une photo. Sur
// les treize photos réelles de la ferme, elle comptait le carrelage, les trous
// vides des alvéoles et les croisillons du plastique : 731 marques pour huit
// alvéoles posées au sol, et la taille retenue restait collée à son minimum sur
// toutes. Ces motifs sont réguliers et tous de la même taille, et c'est
// exactement ce que la détection récompense — le sol gagne contre les œufs.
// Elle reste derrière un bouton, pour pouvoir la juger sur pièces, mais
// personne ne doit la subir.
//
// Ce qui lui manque, c'est la taille d'un œuf et le sens clair-sombre. Un doigt
// posé sur un œuf avant la détection donnerait les deux d'un coup ; c'est la
// piste à reprendre.
//
// Même feuille que le pavé numérique (Keypad) : plein écran, fond sombre,
// validation en bas. C'est le geste que l'équipe connaît déjà.

// Bornes de la glissière de sensibilité, en score de forme (1 = la forme fait
// la taille courante). À gauche, seules les formes pleine taille comptent ; à
// droite, tout passe, jusqu'au tiers d'œuf. Les deux bornes serrent la plage
// utile : étalée de 1 à 0, les trois quarts de la course ne changeaient rien et
// tout le réglage se jouait dans le premier centimètre.
const SEUIL_SEVERE = 1;
const SEUIL_LARGE = 0.3;

// Tolérance de taille autour du rayon réglé. Un œuf photographié de biais varie
// d'un bon tiers entre le bord et le centre de l'alvéole ; au-delà on laisserait
// rentrer le cercle du plateau lui-même.
const ECART_TAILLE = 1.7;

// Où poser la glissière à l'ouverture, sans que personne ait à y toucher.
//
// On balaie toute la course et on compte les marques à chaque cran. Le bon
// réglage est le palier : la plage de sensibilité sur laquelle le compte ne
// bouge plus. Trop sévère, on perd des œufs un par un ; trop large, le bruit
// en rajoute un par un ; entre les deux, le compte tient bon sur une large
// plage, et c'est le nombre d'œufs.
//
// La première version cherchait la plus grosse marche dans les scores. Elle
// tombait juste sur une alvéole rangée, où tous les œufs se ressemblent, et
// franchement à côté sur un panier où ils sont de tailles inégales : la marche
// la plus nette s'y trouve entre deux gros œufs, pas entre les œufs et le fond.
function seuilAuto(candidats) {
  if (candidats.length < 3) return SEUIL_LARGE;
  const CRANS = 40;
  const seuils = [];
  const comptes = [];
  for (let i = 0; i <= CRANS; i++) {
    const s = SEUIL_SEVERE - (SEUIL_SEVERE - SEUIL_LARGE) * (i / CRANS);
    seuils.push(s);
    // La liste vient triée du plus franc au plus douteux : le compte est le
    // rang du premier qui décroche.
    let n = 0;
    while (n < candidats.length && candidats[n].score >= s) n++;
    comptes.push(n);
  }

  let debut = 0;
  let meilleurDebut = 0;
  let meilleureLongueur = 0;
  const retiens = (d, longueur) => {
    if (comptes[d] > 0 && longueur > meilleureLongueur) {
      meilleureLongueur = longueur;
      meilleurDebut = d;
    }
  };
  for (let i = 1; i <= CRANS; i++) {
    if (comptes[i] !== comptes[debut]) {
      retiens(debut, i - debut);
      debut = i;
    }
  }
  retiens(debut, CRANS + 1 - debut);
  return seuils[meilleurDebut + (meilleureLongueur >> 1)];
}

function mediane(nombres, defaut) {
  if (!nombres.length) return defaut;
  const t = [...nombres].sort((a, b) => a - b);
  return t[t.length >> 1];
}

export default function CompteurImage({
  titre,
  aide,
  autoDetecter = false,
  cibles,
  libelleValider = "Reporter",
  onValider,
  onFermer,
}) {
  const [image, setImage] = useState(null);
  const [candidats, setCandidats] = useState([]);
  const [seuil, setSeuil] = useState(0.3);
  const [taille, setTaille] = useState(0);
  const [retires, setRetires] = useState(() => new Set());
  const [ajouts, setAjouts] = useState([]);
  const [etat, setEtat] = useState("vide"); // vide | analyse | pret | erreur
  const [erreur, setErreur] = useState("");
  const [zoom, setZoom] = useState(1);
  const [cible, setCible] = useState(cibles?.[0]?.cle ?? null);

  const canvasRef = useRef(null);
  const sceneRef = useRef(null);
  const departRef = useRef(null);
  const compteurAjout = useRef(0);

  const detectes = useMemo(() => {
    if (!taille) return candidats.filter((c) => c.score >= seuil);
    const min = taille / ECART_TAILLE;
    const max = taille * ECART_TAILLE;
    return candidats.filter((c) => c.score >= seuil && c.r >= min && c.r <= max);
  }, [candidats, seuil, taille]);

  const marques = useMemo(
    () => [...detectes.filter((c) => !retires.has(c.id)), ...ajouts],
    [detectes, retires, ajouts],
  );

  const total = marques.length;

  // Redessin à chaque changement : la photo dessous, les marques dessus. Le
  // canevas est à la résolution d'analyse et non à celle de l'écran, sinon les
  // coordonnées des marques ne voudraient plus rien dire après un zoom.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !image) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, image.w, image.h);
    ctx.drawImage(image.canvas, 0, 0);

    const epaisseur = Math.max(1.5, Math.min(image.w, image.h) / 300);
    const chiffres = marques.length <= 80;
    marques.forEach((m, i) => {
      const manuel = typeof m.id === "string";
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
      ctx.strokeStyle = manuel ? "#AF481F" : "#FAA429";
      ctx.lineWidth = epaisseur;
      ctx.stroke();
      ctx.fillStyle = manuel ? "rgba(175,72,31,0.22)" : "rgba(250,164,41,0.22)";
      ctx.fill();
      if (!chiffres) return;
      const corps = Math.min(20, Math.max(9, m.r * 0.7));
      ctx.font = `600 ${corps}px "IBM Plex Mono", monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      // Liseré sombre sous le chiffre : sur une alvéole claire au soleil, du
      // blanc sur du blanc ne se lit pas.
      ctx.lineWidth = Math.max(2, corps / 5);
      ctx.strokeStyle = "rgba(54,37,30,0.85)";
      ctx.strokeText(String(i + 1), m.x, m.y);
      ctx.fillStyle = "#FFFFFF";
      ctx.fillText(String(i + 1), m.x, m.y);
    });
  }, [image, marques]);

  const lancerAnalyse = useCallback((img) => {
    setEtat("analyse");
    // Un tour de boucle avant de bloquer le fil : sans ça l'écran reste sur
    // « Choisis une photo » pendant toute l'analyse, et on croit que rien ne
    // s'est passé.
    setTimeout(() => {
      try {
        const { candidats: trouves } = analyser(img.donnees);
        const s = seuilAuto(trouves);
        const passants = trouves.filter((c) => c.score >= s);
        setCandidats(trouves);
        setSeuil(s);
        setTaille(mediane(passants.map((c) => c.r), Math.round(Math.min(img.w, img.h) / 25)));
        setEtat("pret");
      } catch (e) {
        console.error("Analyse de la photo interrompue", e);
        setErreur("Analyse impossible sur cette photo. Compte au doigt, ça marche quand même.");
        setEtat("pret");
      }
    }, 30);
  }, []);

  const prendrePhoto = async (e) => {
    const fichier = e.target.files?.[0];
    // Le champ garde le dernier fichier choisi : sans cette remise à zéro,
    // reprendre deux fois la même photo ne déclenche rien.
    e.target.value = "";
    if (!fichier) return;
    setErreur("");
    setEtat("analyse");
    try {
      const img = await chargerImage(fichier);
      setImage(img);
      setCandidats([]);
      setRetires(new Set());
      setAjouts([]);
      setZoom(1);
      if (autoDetecter) lancerAnalyse(img);
      else {
        setTaille(Math.round(Math.min(img.w, img.h) / 25));
        setEtat("pret");
      }
    } catch (err) {
      console.error("Photo illisible", err);
      setErreur("Photo illisible. Reprends-la, ou choisis-en une autre.");
      setEtat("erreur");
    }
  };

  // Un doigt posé sur une marque la retire, posé ailleurs il en ajoute une.
  // Pas de bouton « mode gomme » : à cent poules à pointer, changer de mode
  // toutes les trois marques ferait perdre le fil du comptage.
  const auDoigt = (ex, ey) => {
    const canvas = canvasRef.current;
    if (!canvas || !image) return;
    const cadre = canvas.getBoundingClientRect();
    const x = ((ex - cadre.left) / cadre.width) * image.w;
    const y = ((ey - cadre.top) / cadre.height) * image.h;

    const touchee = [...marques]
      .map((m) => ({ m, d: Math.hypot(m.x - x, m.y - y) }))
      .filter((c) => c.d <= Math.max(c.m.r, 12))
      .sort((a, b) => a.d - b.d)[0]?.m;

    if (touchee) {
      if (typeof touchee.id === "string") setAjouts((a) => a.filter((m) => m.id !== touchee.id));
      else setRetires((s) => new Set(s).add(touchee.id));
      return;
    }
    const r = taille || Math.round(Math.min(image.w, image.h) / 25);
    setAjouts((a) => [...a, { id: `m${compteurAjout.current++}`, x, y, r }]);
  };

  // On distingue le pointage du défilement : dans une photo zoomée, le doigt
  // sert aussi à se déplacer, et chaque glissement laisserait une marque.
  const surPointerDown = (e) => {
    departRef.current = { x: e.clientX, y: e.clientY, t: Date.now(), sx: sceneRef.current?.scrollLeft ?? 0, sy: sceneRef.current?.scrollTop ?? 0 };
  };
  const surPointerUp = (e) => {
    const d = departRef.current;
    departRef.current = null;
    if (!d) return;
    const bouge = Math.hypot(e.clientX - d.x, e.clientY - d.y) > 8;
    const defile =
      Math.abs((sceneRef.current?.scrollLeft ?? 0) - d.sx) > 2 ||
      Math.abs((sceneRef.current?.scrollTop ?? 0) - d.sy) > 2;
    if (bouge || defile || Date.now() - d.t > 700) return;
    auDoigt(e.clientX, e.clientY);
  };

  useEffect(() => {
    const auClavier = (e) => { if (e.key === "Escape") onFermer(); };
    window.addEventListener("keydown", auClavier);
    return () => window.removeEventListener("keydown", auClavier);
  }, [onFermer]);

  const valider = () => {
    onValider(total, cible);
    onFermer();
  };

  return (
    <div className="tf-pad" onClick={onFermer}>
      <div className="tf-pad-sheet tf-compteur" onClick={(e) => e.stopPropagation()}>
        <div className="tf-pad-head">
          <span className="tf-pad-label">{titre}</span>
          <span className="tf-pad-val">
            {fmt(total)}
            <span className="tf-unit">{total > 1 ? "marques" : "marque"}</span>
          </span>
        </div>

        {!image && (
          <div className="tf-compteur-vide">
            <p className="tf-note" data-alerte={erreur ? 1 : 0}>{erreur || aide}</p>
            {/* Dit d'emblée que le comptage se fait au doigt : sans ça on
                attend une détection qui ne viendra pas. */}
            <p className="tf-note">Tu compteras en touchant chaque forme du doigt.</p>
            <label className="tf-btn tf-btn-fichier">
              Prendre une photo
              <input type="file" accept="image/*" capture="environment" onChange={prendrePhoto} />
            </label>
            <label className="tf-btn tf-btn-ghost tf-btn-fichier">
              Choisir une photo
              <input type="file" accept="image/*" onChange={prendrePhoto} />
            </label>
          </div>
        )}

        {image && (
          <>
            <div className="tf-compteur-scene" ref={sceneRef}>
              <canvas
                ref={canvasRef}
                width={image.w}
                height={image.h}
                className="tf-compteur-canvas"
                style={zoom > 1 ? { width: `${zoom * 100}%`, maxHeight: "none" } : undefined}
                onPointerDown={surPointerDown}
                onPointerUp={surPointerUp}
              />
              {etat === "analyse" && <div className="tf-compteur-voile">Analyse…</div>}
            </div>

            <div className="tf-reglages">
              <label className="tf-reglage">
                <span className="tf-label">Sensibilité</span>
                <input
                  type="range" min="0" max="100"
                  value={Math.round(((SEUIL_SEVERE - seuil) / (SEUIL_SEVERE - SEUIL_LARGE)) * 100)}
                  disabled={!candidats.length}
                  onChange={(e) =>
                    setSeuil(SEUIL_SEVERE - (SEUIL_SEVERE - SEUIL_LARGE) * (Number(e.target.value) / 100))}
                />
              </label>
              <label className="tf-reglage">
                <span className="tf-label">Taille</span>
                <input
                  type="range"
                  min={Math.max(4, Math.round(Math.min(image.w, image.h) / 60))}
                  max={Math.round(Math.min(image.w, image.h) / 4)}
                  value={taille || Math.round(Math.min(image.w, image.h) / 25)}
                  onChange={(e) => setTaille(Number(e.target.value))}
                />
              </label>
            </div>

            <div className="tf-compteur-outils">
              <button className="tf-role" data-on={zoom > 1 ? 1 : 0}
                onClick={() => setZoom((z) => (z >= 3 ? 1 : z + 1))}>
                Zoom ×{zoom}
              </button>
              {!candidats.length && etat !== "analyse" && (
                <button className="tf-role" onClick={() => lancerAnalyse(image)}>Détecter</button>
              )}
              <button className="tf-role" onClick={() => { setAjouts([]); setRetires(new Set(candidats.map((c) => c.id))); }}>
                Tout effacer
              </button>
              <label className="tf-role tf-btn-fichier">
                Autre photo
                <input type="file" accept="image/*" capture="environment" onChange={prendrePhoto} />
              </label>
            </div>

            <p className="tf-note">
              Touche un cercle pour le retirer, touche ailleurs pour en ajouter un.
              Les cercles <strong>orange</strong> viennent de la détection, les <strong>rouges</strong> de ta main.
              {erreur && <> <strong>{erreur}</strong></>}
            </p>
          </>
        )}

        {cibles?.length > 0 && image && (
          <div className="tf-chips">
            {cibles.map((c) => (
              <button key={c.cle} className="tf-chip" data-on={cible === c.cle ? 1 : 0}
                onClick={() => setCible(c.cle)}>
                {c.label}
              </button>
            ))}
          </div>
        )}

        <div className="tf-cta-in tf-compteur-cta">
          <button className="tf-btn" disabled={!image || etat === "analyse"} onClick={valider}>
            {libelleValider} {fmt(total)}
          </button>
          <button className="tf-btn tf-btn-ghost" onClick={onFermer}>Fermer</button>
        </div>
      </div>
    </div>
  );
}
