// Identité de la ferme et libellés de facture, relevés sur les factures
// existantes : Leader Price du 2026-09-03 (français) et Mercy Ships du
// 2026-09-05 (anglais).
//
// Ce fichier part dans le navigateur : rien d'autre ici que ce qui est déjà
// imprimé sur les factures envoyées aux clients.

export const FERME = {
  raison: "Tama Ferme SARL",
  telephone: "+261 34 01 763 05",
  emails: ["contact@tamaferme.com", "tama.fermes@gmail.com"],
  nif: "4019 353 097",
  stat: "01462 31 20250 011458",
  gerant: { nom: "HILARY JAHARISON Andronio", telephone: "+261 34 07 239 20" },
  // Même référence sur les deux factures : c'est un code de la ferme, pas
  // du client.
  codeArticle: "67218",
};

// L'adresse est traduite sur la facture anglaise — « En face » / « Opposite ».
export const ADRESSE = {
  fr: ["En face POKIMA Mangarivotra", "Toamasina 501, Madagascar"],
  en: ["Opposite POKIMA Mangarivotra", "Toamasina 501, Madagascar"],
};

// Affichées seulement pour les clients dont la fiche porte
// `coordonnees_paiement` — Mercy Ships aujourd'hui, pas Leader Price.
export const PAIEMENT = {
  banque: "MG46 0000 4000 1505 7922 2010 114",
  mvola: "+261 34 16 300 25",
  titulaire: "Hanitriniaina Fanantenana",
};

// La signature manuscrite du gérant. Le fichier déposé mesure 2544 × 432 mais
// l'encre n'en occupe qu'une bande étroite : mesuré au pixel, tout tient entre
// x 880 et 1680, le reste étant du vide et une poussière isolée à gauche. Sans
// ce cadrage, la signature affichée à hauteur de ligne serait minuscule.
//
// Le nom du fichier est volontairement peu devinable : tout ce qui est dans
// public/ est accessible à qui connaît l'adresse, et une signature manuscrite
// se recopie.
//
// Mettre `fichier` à "" rend à la facture une place vide, à signer à la main.
export const SIGNATURE = {
  fichier: "/paraphe-tf-7c31a9.png",
  image: [2544, 432],                       // dimensions réelles du fichier
  cadre: { x: 860, y: 110, l: 840, h: 185 }, // la zone à montrer
  largeurRendue: 240,                        // en pixels, sur la facture
};

export const MOTS = {
  fr: {
    client: "Nom du client", adresse: "Adresse", tel: "Tél",
    facture: "Facture N°", commande: "N° Commande", date: "Date",
    designation: "Désignation", categorie: "Catégorie", code: "Code M", quantite: "Quantité",
    arrete: "Arrêté à la somme de :",
    prixUnit: "Prix unitaire (MGA)", montant: "Montant (MGA)", total: "Total",
    conditions: (j) => `Condition de paiement: ${String(j).padStart(2, "0")} jours à date de facture`,
    comptant: "Condition de paiement: à réception",
    banque: "Numéro de compte bancaire :", mvola: "Mvola :", titulaire: "Nom :",
    gerant: "Gérant", merci: "Merci pour votre confiance.",
    oeufs: "Oeufs", paquet: (n) => `Oeufs x${n}`,
  },
  en: {
    client: "Customer Name", adresse: "Adress", tel: "Tel",
    facture: "Invoice No.", commande: "Order No.", date: "Date",
    designation: "Description", categorie: "Category", code: "Code M", quantite: "Quantity",
    arrete: "This invoice is closed in the sum of :",
    prixUnit: "Unite Price (MGA)", montant: "Amount (MGA)", total: "Total",
    conditions: (j) => `Payment terms: ${j} days from invoice date`,
    comptant: "Payment terms: on delivery",
    banque: "Bank account number:", mvola: "Mvola:", titulaire: "Name:",
    gerant: "Manager", merci: "We appreciate your trust.",
    oeufs: "Eggs", paquet: (n) => `Eggs x${n}`,
  },
};
