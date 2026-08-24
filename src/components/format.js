export const fmt = (n) => new Intl.NumberFormat("fr-FR").format(Math.round(n || 0));
export const today = () => new Date().toISOString().slice(0, 10);
export const dLabel = (d) =>
  new Date(d + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "short", day: "2-digit", month: "short" });

// Comparaison de noms saisis à la main : « angeline » doit trouver
// « Angéline », et « La Braise » ne doit pas créer un doublon de « La braise ».
export const sansAccent = (s) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
