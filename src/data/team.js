// Placeholder team directory for the login screen's profile tiles.
//
// The prototype's login (profile tile + numeric code) is a UX choice, not an
// auth mechanism — profils.id must reference a real auth.users row (see
// docs/01-schema-supabase.sql section 2), and the RLS policy on `profils`
// only lets a signed-in user read their own row, so this list can't be
// fetched from the database before login. This hardcoded directory drives
// the tiles and each entry's code is exchanged for `email` + code as the
// password. Code length is 6 digits (src/screens/Login.jsx CODE_LEN) so it
// meets Supabase Auth's default minimum password length without having to
// weaken that setting — still a numeric-only password, so treat this as a
// starting point, not a final security posture.
// Le code à 6 chiffres de chaque compte n'est volontairement pas stocké ici :
// ce fichier finit dans le bundle JS envoyé au navigateur, donc tout ce qui
// s'y trouve est public une fois déployé. Les codes ne vivent que dans la
// tête de chaque personne (et éventuellement un gestionnaire de mots de
// passe côté direction) — jamais dans le dépôt.
export const TEAM = [
  { key: "chef_ferme", nom: "Chef de ferme", role: "chef_ferme", email: "chef-ferme@tamaferme.local" },
  { key: "magasiniere", nom: "Magasinière", role: "magasiniere", email: "magasiniere@tamaferme.local" },
  { key: "point_vente", nom: "Point de vente", role: "point_vente", email: "point-vente@tamaferme.local" },
  { key: "direction", nom: "Direction", role: "direction", email: "direction@tamaferme.local" },
];
