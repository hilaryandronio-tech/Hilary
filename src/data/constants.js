// Mirrors docs/01-schema-supabase.sql seed data. Screens fetch the live
// values from Supabase (calibres, lots, categories_charges) and fall back to
// this when offline on a cold start — see the offline layer note in
// docs/03-brief-technique.md section 7.
export const ALV = 30;

export const CALIBRES = ["S1", "S2", "M1", "M2", "L1", "L2", "XL1", "XL2"];

export const PRIX_BASE = { S1: 600, S2: 620, M1: 650, M2: 660, L1: 670, L2: 680, XL1: 700, XL2: 750 };

// Les tranches de poids que l'équipe utilise réellement sur ses feuilles de
// compta — elles s'alignent une pour une sur les huit calibres, dans l'ordre.
// Le code court reste la référence (il est en base), le poids est là pour que
// personne n'ait à traduire de tête entre la balance et l'écran.
export const POIDS = {
  S1: "42–46 g",
  S2: "47–56 g",
  M1: "57–60 g",
  M2: "61–63 g",
  L1: "64–66 g",
  L2: "67–69 g",
  XL1: "70–74 g",
  XL2: "75 g +",
  CASSE: "hors calibre",
};

// Prix des œufs cassés — les sales/fêlés sont comptés à zéro aujourd'hui,
// non tranché (docs/03-brief-technique.md section 6).
export const PRIX_CASSE = 500;

// Utilisé si le fetch de la table `clients` échoue au chargement à froid,
// hors ligne (pas encore de cache local des référentiels — voir README).
// Sans id Supabase résolu, ces clients ne peuvent pas être sélectionnés pour
// une vente tant que l'app n'a pas pu charger la vraie table au moins une fois.
export const CLIENTS_FALLBACK = [
  { id: null, nom: "Calypso", tarifs: { L2: 800 } },
  { id: null, nom: "Leader Price", tarifs: { M1: 760 } },
  { id: null, nom: "La Terrasse", tarifs: { L1: 750 } },
  { id: null, nom: "Mercy Ships", tarifs: { L1: 800 } },
  { id: null, nom: "Masteva", tarifs: { L2: 800 } },
];

export const SEED_LOTS = [
  { id: "V1", nom: "Bâtiment 1", effectif_initial: 3000, en_ponte: true },
  { id: "V2", nom: "Bâtiment 2", effectif_initial: 3000, en_ponte: true },
  { id: "V3", nom: "Bâtiment 3", effectif_initial: 3000, en_ponte: false },
];

export const CATEGORIES_CHARGES = [
  "Produit véto", "Connexion", "Sakafo", "Nettoyage", "Salaire", "Curbu Hilary",
  "Carburant", "Voiture", "Frais", "Alvéoles", "Papier film", "Étiquette",
  "Loyer", "Dératisation", "Remb. machine", "Autres",
];

export const CATEGORIES_CHARGES_VENTE = [
  "Taimbakona", "Bozaka", "Sachet", "Frais", "Crédit", "Scotch",
  "Carton", "Kesika", "Electricité", "Loyer", "Salaire", "Autres",
];
