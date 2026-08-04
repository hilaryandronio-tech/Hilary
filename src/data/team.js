// Placeholder team directory for the login screen's profile tiles.
//
// The prototype's login (profile tile + 4-digit code) is a UX choice, not an
// auth mechanism — profils.id must reference a real auth.users row (see
// docs/01-schema-supabase.sql section 2), and the RLS policy on `profils`
// only lets a signed-in user read their own row, so this list can't be
// fetched from the database before login. Until direction confirms how PINs
// map to Supabase Auth credentials, this hardcoded directory drives the
// tiles and each entry's PIN is exchanged for `email` + PIN as the password.
//
// This needs a decision (see docs/03-brief-technique.md section 6) before
// going to real users: a 4-digit password is weak, so Supabase Auth's
// minimum password length (Dashboard > Authentication > Providers > Email)
// must be lowered from its default of 6, which is a real security trade-off
// to confirm, not just a config tweak.
export const TEAM = [
  { key: "chef_ferme", nom: "Chef de ferme", role: "chef_ferme", email: "chef-ferme@tamaferme.local" },
  { key: "magasiniere", nom: "Magasinière", role: "magasiniere", email: "magasiniere@tamaferme.local" },
  { key: "point_vente", nom: "Point de vente", role: "point_vente", email: "point-vente@tamaferme.local" },
  { key: "direction", nom: "Direction", role: "direction", email: "direction@tamaferme.local" },
];
