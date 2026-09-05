// Régénère les icônes de l'application depuis public/logo-tama-ferme.png.
//   node docs/import/icones.cjs      (à lancer depuis la racine du dépôt)
//
// À relancer si le logo change. Produit les trois icônes du manifeste plus
// logo-marque.png, le dessin sans le mot « Tama Ferme » — l'en-tête et
// l'écran de connexion écrivent déjà le nom à côté.
// Fabrique les icônes de l'application à partir du logo à fond transparent.
// Pas de bibliothèque d'images dans le projet : PNG RGBA 8 bits non entrelacé,
// que zlib suffit à décoder et à réencoder.
const fs = require("fs");
const zlib = require("zlib");

// ---------- décodage ----------
function lirePng(chemin) {
  const b = fs.readFileSync(chemin);
  const largeur = b.readUInt32BE(16), hauteur = b.readUInt32BE(20);
  if (b[24] !== 8 || b[25] !== 6 || b[28] !== 0) throw new Error("PNG non pris en charge");
  const blocs = [];
  let o = 8;
  while (o < b.length) {
    const len = b.readUInt32BE(o);
    const type = b.slice(o + 4, o + 8).toString("ascii");
    if (type === "IDAT") blocs.push(b.slice(o + 8, o + 8 + len));
    o += 12 + len;
    if (type === "IEND") break;
  }
  const brut = zlib.inflateSync(Buffer.concat(blocs));
  const px = Buffer.alloc(largeur * hauteur * 4);
  const pas = largeur * 4;
  let src = 0;
  for (let y = 0; y < hauteur; y++) {
    const filtre = brut[src++];
    const ligne = brut.slice(src, src + pas); src += pas;
    const sortie = px.slice(y * pas, (y + 1) * pas);
    const dessus = y ? px.slice((y - 1) * pas, y * pas) : null;
    for (let i = 0; i < pas; i++) {
      const a = i >= 4 ? sortie[i - 4] : 0;
      const b2 = dessus ? dessus[i] : 0;
      const c = dessus && i >= 4 ? dessus[i - 4] : 0;
      let v = ligne[i];
      if (filtre === 1) v += a;
      else if (filtre === 2) v += b2;
      else if (filtre === 3) v += (a + b2) >> 1;
      else if (filtre === 4) {
        const p = a + b2 - c, pa = Math.abs(p - a), pb = Math.abs(p - b2), pc = Math.abs(p - c);
        v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b2 : c);
      }
      sortie[i] = v & 255;
    }
  }
  return { largeur, hauteur, px };
}

// ---------- encodage ----------
function ecrirePng(chemin, largeur, hauteur, px) {
  const pas = largeur * 4;
  const brut = Buffer.alloc((pas + 1) * hauteur);
  for (let y = 0; y < hauteur; y++) {
    brut[y * (pas + 1)] = 0;                       // filtre « aucun »
    px.copy(brut, y * (pas + 1) + 1, y * pas, (y + 1) * pas);
  }
  const bloc = (type, data) => {
    const t = Buffer.from(type, "ascii");
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(Buffer.concat([t, data])) >>> 0);
    return Buffer.concat([len, t, data, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(largeur, 0); ihdr.writeUInt32BE(hauteur, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  fs.writeFileSync(chemin, Buffer.concat([
    Buffer.from("89504e470d0a1a0a", "hex"),
    bloc("IHDR", ihdr),
    bloc("IDAT", zlib.deflateSync(brut, { level: 9 })),
    bloc("IEND", Buffer.alloc(0)),
  ]));
  return fs.statSync(chemin).size;
}

// ---------- outils ----------
// Boîte de l'encre : tout ce qui n'est pas parfaitement transparent.
function bornes(img) {
  let x1 = img.largeur, y1 = img.hauteur, x2 = -1, y2 = -1;
  for (let y = 0; y < img.hauteur; y++)
    for (let x = 0; x < img.largeur; x++)
      if (img.px[(y * img.largeur + x) * 4 + 3] > 8) {
        if (x < x1) x1 = x; if (x > x2) x2 = x;
        if (y < y1) y1 = y; if (y > y2) y2 = y;
      }
  return { x1, y1, x2, y2 };
}

// Profil d'encre par rangée, pour repérer le blanc entre le dessin et le mot.
function profilRangees(img, x1, x2) {
  const p = new Array(img.hauteur).fill(0);
  for (let y = 0; y < img.hauteur; y++)
    for (let x = x1; x <= x2; x++)
      if (img.px[(y * img.largeur + x) * 4 + 3] > 8) p[y]++;
  return p;
}

// Réduction par moyenne de boîte, en prémultipliant l'alpha : sans ça les
// bords transparents tirent la couleur vers le noir.
function reduire(img, sx, sy, sw, sh, dw, dh) {
  const out = Buffer.alloc(dw * dh * 4);
  for (let dy = 0; dy < dh; dy++) {
    const y0 = sy + Math.floor(dy * sh / dh), y1 = sy + Math.floor((dy + 1) * sh / dh);
    for (let dx = 0; dx < dw; dx++) {
      const x0 = sx + Math.floor(dx * sw / dw), x1 = sx + Math.floor((dx + 1) * sw / dw);
      let r = 0, g = 0, b = 0, a = 0, n = 0;
      for (let y = y0; y < Math.max(y1, y0 + 1); y++)
        for (let x = x0; x < Math.max(x1, x0 + 1); x++) {
          const i = (y * img.largeur + x) * 4, al = img.px[i + 3] / 255;
          r += img.px[i] * al; g += img.px[i + 1] * al; b += img.px[i + 2] * al;
          a += img.px[i + 3]; n++;
        }
      const o = (dy * dw + dx) * 4, moyA = a / n;
      out[o + 3] = Math.round(moyA);
      const k = moyA > 0 ? (n * 255) / (a || 1) : 0;
      out[o] = Math.min(255, Math.round(r * k / n * (moyA / 255) * (255 / (moyA || 1))));
      out[o + 1] = Math.min(255, Math.round(g * k / n * (moyA / 255) * (255 / (moyA || 1))));
      out[o + 2] = Math.min(255, Math.round(b * k / n * (moyA / 255) * (255 / (moyA || 1))));
    }
  }
  return out;
}

// Pose une image réduite au centre d'un carré, sur fond transparent ou plein.
function carre(img, boite, cote, marge, fond) {
  const px = Buffer.alloc(cote * cote * 4);
  if (fond) for (let i = 0; i < cote * cote; i++) {
    px[i * 4] = fond[0]; px[i * 4 + 1] = fond[1]; px[i * 4 + 2] = fond[2]; px[i * 4 + 3] = 255;
  }
  const sw = boite.x2 - boite.x1 + 1, sh = boite.y2 - boite.y1 + 1;
  const utile = cote - 2 * marge;
  const e = Math.min(utile / sw, utile / sh);
  const dw = Math.max(1, Math.round(sw * e)), dh = Math.max(1, Math.round(sh * e));
  const petit = reduire(img, boite.x1, boite.y1, sw, sh, dw, dh);
  const ox = Math.round((cote - dw) / 2), oy = Math.round((cote - dh) / 2);
  for (let y = 0; y < dh; y++)
    for (let x = 0; x < dw; x++) {
      const s = (y * dw + x) * 4, d = ((oy + y) * cote + ox + x) * 4;
      const al = petit[s + 3] / 255;
      if (!al) continue;
      px[d] = Math.round(petit[s] * al + px[d] * (1 - al));
      px[d + 1] = Math.round(petit[s + 1] * al + px[d + 1] * (1 - al));
      px[d + 2] = Math.round(petit[s + 2] * al + px[d + 2] * (1 - al));
      px[d + 3] = fond ? 255 : Math.max(px[d + 3], petit[s + 3]);
    }
  return px;
}

// ---------- fabrication ----------
const img = lirePng("public/logo-tama-ferme.png");
const b = bornes(img);
console.log("encre :", b, "→", b.x2 - b.x1 + 1, "×", b.y2 - b.y1 + 1);

// Où s'arrête le dessin et où commence le mot « Tama Ferme » : on cherche la
// plus large bande vide entre les deux, dans la moitié basse.
const prof = profilRangees(img, b.x1, b.x2);
let meilleure = null, debut = null;
for (let y = Math.floor(img.hauteur * 0.5); y <= b.y2; y++) {
  if (prof[y] === 0) { if (debut === null) debut = y; }
  else if (debut !== null) {
    const h = y - debut;
    if (!meilleure || h > meilleure.h) meilleure = { debut, fin: y - 1, h };
    debut = null;
  }
}
console.log("bande vide la plus large :", meilleure);

const marque = meilleure
  ? { x1: b.x1, y1: b.y1, x2: b.x2, y2: meilleure.debut - 1 }
  : b;
console.log("marque seule :", marque, "→", marque.x2 - marque.x1 + 1, "×", marque.y2 - marque.y1 + 1);

const FOND = [175, 72, 31];  // var(--brick) — le fond du menu de démarrage
const sorties = [
  ["public/icones/icone-192.png", 192, 6, null, b],
  ["public/icones/icone-512.png", 512, 16, null, b],
  ["public/icones/icone-maskable-512.png", 512, 92, FOND, b],
  ["public/logo-marque.png", 512, 0, null, marque],   // le dessin seul, pour l'en-tête
];
for (const [chemin, cote, marge, fond, boite] of sorties) {
  const px = carre(img, boite, cote, marge, fond);
  const taille = ecrirePng(chemin, cote, cote, px);
  console.log(chemin, cote + "×" + cote, Math.round(taille / 1024) + " Ko");
}
