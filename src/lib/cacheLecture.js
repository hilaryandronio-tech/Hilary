import { dbPromise, CACHE } from "./baseLocale";

// Jusqu'ici seules les *écritures* survivaient à une coupure : elles partaient
// dans la file d'attente. Les *lectures*, elles, échouaient en silence et les
// écrans retombaient sur les valeurs codées en dur de src/data/constants.js —
// 3 000 poules par bâtiment, les anciens prix, des clients sans identifiant.
// Hors ligne, l'application affichait donc des chiffres faux sans le dire, et
// une vente client devenait impossible.
//
// Ici, toute réponse du serveur est conservée telle quelle. À la requête
// suivante, si le serveur ne répond pas, on ressert la dernière réponse connue
// au lieu d'un repli d'usine. Les valeurs restent vraies, simplement datées.

export async function ecrireCache(cle, data) {
  const db = await dbPromise;
  await db.put(CACHE, { cle, data, a: Date.now() });
}

export async function lireCache(cle) {
  const db = await dbPromise;
  return db.get(CACHE, cle);
}

/**
 * Exécute une requête Supabase et conserve son résultat. En cas d'échec —
 * réseau coupé, serveur injoignable — rend la dernière réponse connue.
 *
 * Retourne { data, cache, a } : `cache` dit si la donnée vient du disque, et
 * `a` quand elle a été relevée, pour que l'écran puisse le signaler.
 *
 * @param {string} cle          identifiant stable de la requête
 * @param {() => Promise} requete  la requête Supabase, non encore attendue
 */
export async function lectureCachee(cle, requete) {
  const { data, error } = await requete();
  if (!error && data) {
    await ecrireCache(cle, data);
    return { data, cache: false, a: Date.now() };
  }
  const garde = await lireCache(cle);
  if (garde) return { data: garde.data, cache: true, a: garde.a };
  // Jamais chargé, et hors ligne : à l'appelant de décider de son repli.
  return { data: null, cache: false, a: null };
}

/** Vide le cache — utile après un changement de compte. */
export async function viderCache() {
  const db = await dbPromise;
  await db.clear(CACHE);
}
