// Comptage de formes rondes sur une photo — les œufs d'une alvéole, vus du
// dessus. Tout le calcul se fait sur le téléphone. Le réseau est intermittent à
// la ferme (docs/03-brief-technique.md), donc une saisie ne peut pas attendre
// l'aller-retour vers un service de reconnaissance d'images : ni la magasinière
// ni la file d'attente hors ligne ne sauraient quoi faire d'un comptage qui
// revient dix minutes plus tard.
//
// Aucune dépendance : pas d'OpenCV (8 Mo de WebAssembly à mettre en cache pour
// un seul écran), pas de modèle entraîné (il faudrait des milliers de photos
// annotées de la ferme, et le modèle ne tiendrait pas dans un téléphone
// d'entrée de gamme).
//
// La méthode, en trois temps :
//
//  1. On retire l'éclairage. Chaque pixel est comparé à la moyenne de son
//     voisinage large, pas à une valeur absolue : un coin de bâtiment plus
//     sombre que l'autre ne doit pas décider du comptage.
//  2. On sépare les œufs du fond par un seuil d'Otsu, puis on nettoie au
//     grain près (ouverture morphologique).
//  3. On mesure, pour chaque pixel d'œuf, sa distance au bord le plus proche.
//     Le centre d'un œuf est le point le plus éloigné de tout bord : c'est un
//     sommet de cette carte de distance, et sa valeur donne le rayon. Deux œufs
//     qui se touchent gardent chacun leur sommet, là où un simple découpage en
//     taches les aurait fondus en un seul.
//
// Une transformée de Hough pour les cercles a été essayée avant et écartée :
// un œuf n'est pas un cercle. Ses rayons de courbure vont du simple au tiers en
// plus entre le bout et le flanc, les votes ne se rassemblent jamais en un
// point, et le comptage partait sur le grain du fond. La carte de distance, qui
// ne présume aucune forme, tient l'ovale sans broncher.

// Au-delà, on ne gagne plus en justesse, on ne perd que du temps : une photo de
// 12 mégapixels ramenée à 800 px garde largement de quoi séparer deux œufs.
const MAX_COTE = 800;

// Charge le fichier de l'appareil photo dans un canevas réduit. `imageOrientation`
// est indispensable : les photos Android portent leur orientation dans leurs
// métadonnées, et une alvéole analysée couchée donne des tailles fausses.
export async function chargerImage(fichier) {
  const bitmap = await enBitmap(fichier);
  const echelle = Math.min(1, MAX_COTE / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * echelle));
  const h = Math.max(1, Math.round(bitmap.height * echelle));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();
  return { canvas, w, h, donnees: ctx.getImageData(0, 0, w, h) };
}

async function enBitmap(fichier) {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(fichier, { imageOrientation: "from-image" });
    } catch {
      // Certains Android anciens refusent l'option : on retombe sur la balise
      // <img>, qui applique l'orientation d'elle-même depuis Chrome 81.
    }
  }
  const url = URL.createObjectURL(fichier);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function enGris(donnees) {
  const { data } = donnees;
  const g = new Float32Array(donnees.width * donnees.height);
  for (let i = 0, p = 0; i < g.length; i++, p += 4) {
    g[i] = 0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2];
  }
  return g;
}

// Gaussienne 5 points, séparée en deux passes. Sans elle, le grain du capteur
// en basse lumière — les bâtiments sont sombres — fabrique des trous dans les
// œufs au moment du seuillage.
function flou(src, w, h) {
  const noyau = [1, 4, 6, 4, 1];
  const tmp = new Float32Array(w * h);
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let d = -2; d <= 2; d++) s += src[y * w + Math.min(w - 1, Math.max(0, x + d))] * noyau[d + 2];
      tmp[y * w + x] = s / 16;
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let d = -2; d <= 2; d++) s += tmp[Math.min(h - 1, Math.max(0, y + d)) * w + x] * noyau[d + 2];
      out[y * w + x] = s / 16;
    }
  }
  return out;
}

// Moyenne sur une grande fenêtre, par image intégrale : le coût ne dépend pas
// de la taille de la fenêtre, ce qui compte quand elle fait le huitième de la
// photo.
function moyenneLocale(src, w, h, rayon) {
  const ii = new Float64Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) {
    let ligne = 0;
    for (let x = 0; x < w; x++) {
      ligne += src[y * w + x];
      ii[(y + 1) * (w + 1) + x + 1] = ii[y * (w + 1) + x + 1] + ligne;
    }
  }
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - rayon);
    const y1 = Math.min(h - 1, y + rayon);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - rayon);
      const x1 = Math.min(w - 1, x + rayon);
      const somme =
        ii[(y1 + 1) * (w + 1) + x1 + 1] - ii[y0 * (w + 1) + x1 + 1] -
        ii[(y1 + 1) * (w + 1) + x0] + ii[y0 * (w + 1) + x0];
      out[y * w + x] = somme / ((y1 - y0 + 1) * (x1 - x0 + 1));
    }
  }
  return out;
}

// Seuil d'Otsu : la coupure qui sépare le mieux les pixels en deux populations.
// Rien à régler à la main, et il s'adapte à une photo où les œufs occupent le
// quart du cadre comme à une autre où ils en occupent les trois quarts.
function otsu(valeurs) {
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < valeurs.length; i++) {
    if (valeurs[i] < min) min = valeurs[i];
    if (valeurs[i] > max) max = valeurs[i];
  }
  if (!(max > min)) return { seuil: min, min, max };
  const cases = new Float64Array(256);
  const pas = 255 / (max - min);
  for (let i = 0; i < valeurs.length; i++) cases[Math.round((valeurs[i] - min) * pas)]++;

  const total = valeurs.length;
  let sommeTotale = 0;
  for (let c = 0; c < 256; c++) sommeTotale += c * cases[c];
  let poidsBas = 0;
  let sommeBas = 0;
  let varianceMax = -1;
  let coupe = 0;
  for (let c = 0; c < 256; c++) {
    poidsBas += cases[c];
    if (!poidsBas) continue;
    const poidsHaut = total - poidsBas;
    if (!poidsHaut) break;
    sommeBas += c * cases[c];
    const moyBas = sommeBas / poidsBas;
    const moyHaut = (sommeTotale - sommeBas) / poidsHaut;
    const variance = poidsBas * poidsHaut * (moyBas - moyHaut) ** 2;
    if (variance > varianceMax) {
      varianceMax = variance;
      coupe = c;
    }
  }
  return { seuil: min + coupe / pas, min, max };
}

// Ouverture morphologique 3×3 : érosion puis dilatation. Elle efface les grains
// isolés et détache deux œufs que le seuillage avait collés par un pixel, sans
// entamer les formes pleines.
function ouverture(masque, w, h) {
  const erode = new Uint8Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      erode[i] =
        masque[i] && masque[i - 1] && masque[i + 1] && masque[i - w] && masque[i + w] &&
        masque[i - w - 1] && masque[i - w + 1] && masque[i + w - 1] && masque[i + w + 1] ? 1 : 0;
    }
  }
  const dilate = new Uint8Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      dilate[i] =
        erode[i] || erode[i - 1] || erode[i + 1] || erode[i - w] || erode[i + w] ||
        erode[i - w - 1] || erode[i - w + 1] || erode[i + w - 1] || erode[i + w + 1] ? 1 : 0;
    }
  }
  return dilate;
}

// Carte de distance au bord, par chanfrein 3-4 en deux balayages. Le vrai
// calcul euclidien coûterait bien plus cher pour 2 % de justesse en plus, dont
// un comptage n'a que faire. Les bords de l'image comptent comme du fond : un
// œuf coupé par le cadre doit ressortir petit, pas entier.
function distanceAuBord(masque, w, h) {
  const INF = 1e9;
  const d = new Float32Array(w * h);
  for (let i = 0; i < d.length; i++) d[i] = masque[i] ? INF : 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!d[i]) continue;
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) { d[i] = 3; continue; }
      let v = d[i];
      v = Math.min(v, d[i - w] + 3, d[i - 1] + 3, d[i - w - 1] + 4, d[i - w + 1] + 4);
      d[i] = v;
    }
  }
  for (let y = h - 1; y >= 0; y--) {
    for (let x = w - 1; x >= 0; x--) {
      const i = y * w + x;
      if (!d[i]) continue;
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) { d[i] = 3; continue; }
      let v = d[i];
      v = Math.min(v, d[i + w] + 3, d[i + 1] + 3, d[i + w + 1] + 4, d[i + w - 1] + 4);
      d[i] = v;
    }
  }
  for (let i = 0; i < d.length; i++) d[i] /= 3;
  return d;
}

function sommets(d, w, h, distMini) {
  const bruts = [];
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const v = d[i];
      if (v < distMini) continue;
      if (
        v >= d[i - 1] && v >= d[i + 1] && v >= d[i - w] && v >= d[i + w] &&
        v >= d[i - w - 1] && v >= d[i - w + 1] && v >= d[i + w - 1] && v >= d[i + w + 1]
      ) bruts.push({ x, y, r: v });
    }
  }
  bruts.sort((a, b) => b.r - a.r);

  // Le plateau au centre d'un œuf donne plusieurs sommets voisins de même
  // valeur, et un œuf coupé par le cadre en sème de petits le long de la
  // coupure. On garde le plus gros et on écarte deux sortes de voisins : ceux
  // qui tombent plus près que le rayon du plus petit des deux, et ceux qui
  // tombent carrément à l'intérieur d'une forme déjà retenue. Deux œufs côte à
  // côte ont leurs centres à deux rayons l'un de l'autre, la marge tient dans
  // les deux cas.
  const gardes = [];
  for (const p of bruts) {
    let libre = true;
    for (const q of gardes) {
      const d = Math.hypot(p.x - q.x, p.y - q.y);
      if (d < 1.25 * Math.min(p.r, q.r) || d < 0.8 * q.r) { libre = false; break; }
    }
    if (libre) gardes.push(p);
    if (gardes.length >= 1500) break;
  }
  return gardes;
}

function mediane(nombres) {
  if (!nombres.length) return 0;
  const t = [...nombres].sort((a, b) => a - b);
  return t[t.length >> 1];
}

// Laquelle des deux lectures de la photo est la bonne : les œufs clairs sur un
// fond sombre, ou l'inverse ? La question se pose à chaque photo — un œuf roux
// sous une lampe est plus clair que l'alvéole, le même œuf à l'ombre est plus
// sombre — et personne à la ferme n'a à y répondre à notre place.
//
// La mauvaise lecture ne donne pas rien : elle donne les interstices entre les
// œufs, un filet qui court dans toute la photo. Deux traits le trahissent. Ses
// formes n'ont pas de taille commune, alors qu'une alvéole d'œufs est une
// famille d'objets qui se ressemblent. Et ses sommets se serrent les uns contre
// les autres le long du filet, alors que des œufs posés côte à côte ont leurs
// centres à deux rayons l'un de l'autre.
function coherence(peaks) {
  if (peaks.length < 2) return peaks.length * 0.01;
  const med = mediane(peaks.map((p) => p.r)) || 1;
  const memeTaille = peaks.filter((p) => p.r >= med * 0.75 && p.r <= med * 1.4).length / peaks.length;

  // Sur un échantillon : la distance au voisin le plus proche coûte le carré du
  // nombre de sommets, et le filet en produit des centaines.
  const ech = peaks.slice(0, 200);
  let sommeVoisins = 0;
  for (const p of ech) {
    let plusProche = Infinity;
    for (const q of ech) {
      if (q === p) continue;
      const dd = Math.hypot(p.x - q.x, p.y - q.y);
      if (dd < plusProche) plusProche = dd;
    }
    if (plusProche < Infinity) sommeVoisins += plusProche;
  }
  const espacement = sommeVoisins / ech.length / med;

  // Le dernier facteur écarte la lecture qui ne trouve que deux ou trois
  // formes : elles se ressemblent forcément, ça ne prouve rien.
  return memeTaille * Math.min(1, espacement / 2) * Math.min(1, peaks.length / 4);
}

// Analyse la photo une fois pour toutes et rend la liste des formes trouvées,
// de la plus franche à la plus douteuse. Les réglages de l'écran — sensibilité
// et taille — ne font ensuite que trancher dans cette liste, sans recalcul :
// c'est ce qui permet à la glissière de répondre sous le doigt.
export function analyser(donnees) {
  const w = donnees.width;
  const h = donnees.height;
  const g = flou(enGris(donnees), w, h);

  // Fenêtre large : elle doit contenir plusieurs œufs et du fond, sinon elle
  // suit les œufs eux-mêmes et le relief qu'on cherche s'annule.
  const fond = moyenneLocale(g, w, h, Math.max(8, Math.round(Math.min(w, h) / 8)));
  const relief = new Float32Array(w * h);
  for (let i = 0; i < relief.length; i++) relief[i] = g[i] - fond[i];

  const { seuil } = otsu(relief);
  const distMini = Math.max(3, Math.min(w, h) / 120);

  let meilleur = [];
  let meilleureNote = -1;
  for (const sens of [1, -1]) {
    const masque = new Uint8Array(w * h);
    for (let i = 0; i < masque.length; i++) {
      masque[i] = (relief[i] - seuil) * sens > 0 ? 1 : 0;
    }
    const peaks = sommets(distanceAuBord(ouverture(masque, w, h), w, h), w, h, distMini);
    const note = coherence(peaks);
    if (note > meilleureNote) {
      meilleureNote = note;
      meilleur = peaks;
    }
  }

  // Le score sert la glissière de sensibilité : 1 pour les formes qui font la
  // taille courante, moins pour celles qui restent en deçà — un œuf à demi
  // caché au bord du cadre, un éclat de coquille, une ombre.
  const med = mediane(meilleur.map((p) => p.r)) || 1;
  return {
    candidats: meilleur.map((p, i) => ({
      id: i,
      x: p.x,
      y: p.y,
      r: p.r,
      score: Math.min(1, p.r / med),
    })),
  };
}
