// Le montant écrit en toutes lettres — « Arrêté à la somme de : … » — comme
// sur les factures de Mada-Rest. C'est ce qui empêche qu'un chiffre soit
// retouché après coup sur un papier signé.
//
// Les factures existantes lient tous les mots par des traits d'union, dans
// l'orthographe rectifiée : « Cent-neuf-mille-cinq-cents ». On la suit.

const UNITES = [
  "zéro", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf",
  "dix", "onze", "douze", "treize", "quatorze", "quinze", "seize",
  "dix-sept", "dix-huit", "dix-neuf",
];
const DIZAINES = [
  "", "", "vingt", "trente", "quarante", "cinquante",
  "soixante", "soixante", "quatre-vingt", "quatre-vingt",
];

function sousCent(n) {
  if (n < 20) return UNITES[n];
  const d = Math.floor(n / 10);
  const u = n % 10;
  // Soixante-dix et quatre-vingt-dix comptent par vingtaines : 71 se dit
  // « soixante et onze », pas « septante et un ».
  if (d === 7 || d === 9) {
    const base = DIZAINES[d];
    return u === 1 && d === 7 ? `${base} et onze` : `${base}-${UNITES[10 + u]}`;
  }
  if (u === 0) return d === 8 ? "quatre-vingts" : DIZAINES[d];
  if (u === 1 && d !== 8) return `${DIZAINES[d]} et un`;
  return `${DIZAINES[d]}-${UNITES[u]}`;
}

function sousMille(n) {
  if (n < 100) return sousCent(n);
  const c = Math.floor(n / 100);
  const reste = n % 100;
  if (reste === 0) return c === 1 ? "cent" : `${UNITES[c]} cents`;
  return `${c === 1 ? "cent" : `${UNITES[c]} cent`} ${sousCent(reste)}`;
}

// « Vingt » et « cent » prennent un s quand ils sont multipliés, mais le
// perdent devant un autre numéral : quatre-vingts, et quatre-vingt mille ;
// deux cents, et deux cent mille.
const devantUnNumeral = (texte) => texte.replace(/(vingt|cent)s$/, "$1");

/** 109500 → « cent-neuf-mille-cinq-cents ». Entiers positifs seulement. */
export function enLettres(nombre) {
  const n = Math.round(Math.abs(nombre || 0));
  if (n === 0) return "zéro";

  const tranches = [
    { valeur: 1_000_000_000, singulier: "milliard", pluriel: "milliards" },
    { valeur: 1_000_000, singulier: "million", pluriel: "millions" },
    { valeur: 1_000, singulier: "mille", pluriel: "mille" },
  ];

  let reste = n;
  const morceaux = [];
  for (const t of tranches) {
    const combien = Math.floor(reste / t.valeur);
    if (!combien) continue;
    reste %= t.valeur;
    // « mille » est invariable et ne prend pas « un » devant.
    if (t.valeur === 1_000) {
      morceaux.push(combien === 1 ? "mille" : `${devantUnNumeral(sousMille(combien))} mille`);
    } else {
      morceaux.push(`${devantUnNumeral(sousMille(combien))} ${combien === 1 ? t.singulier : t.pluriel}`);
    }
  }
  if (reste) morceaux.push(sousMille(reste));
  return morceaux.join(" ").replace(/ /g, "-");
}

/** « Cent-neuf-mille-cinq-cents ariary », tel qu'imprimé sur les factures. */
export function sommeArrettee(montant) {
  const mots = enLettres(montant);
  return `${mots[0].toUpperCase()}${mots.slice(1)} ariary`;
}
