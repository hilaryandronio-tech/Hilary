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

// La signature manuscrite du gérant figure sur les factures actuelles. Déposer
// l'image dans public/ et donner son chemin ici pour qu'elle s'imprime ;
// laissé vide, la facture réserve la place pour signer à la main.
export const SIGNATURE = "";

export const MOTS = {
  fr: {
    client: "Nom du client", adresse: "Adresse", tel: "Tél",
    facture: "Facture N°", commande: "N° Commande", date: "Date",
    designation: "Désignation", code: "Code M", quantite: "Quantité",
    prixUnit: "Prix unitaire (MGA)", montant: "Montant (MGA)", total: "Total",
    conditions: (j) => `Condition de paiement: ${j} jours à date de facture`,
    comptant: "Condition de paiement: à réception",
    banque: "Numéro de compte bancaire :", mvola: "Mvola :", titulaire: "Nom :",
    gerant: "Gérant", merci: "Merci pour votre confiance.",
    oeufs: "Oeufs", paquet: (n) => `Oeufs x${n}`,
  },
  en: {
    client: "Customer Name", adresse: "Adress", tel: "Tel",
    facture: "Invoice No.", commande: "Order No.", date: "Date",
    designation: "Description", code: "Code M", quantite: "Quantity",
    prixUnit: "Unite Price (MGA)", montant: "Amount (MGA)", total: "Total",
    conditions: (j) => `Payment terms: ${j} days from invoice date`,
    comptant: "Payment terms: on delivery",
    banque: "Bank account number:", mvola: "Mvola:", titulaire: "Name:",
    gerant: "Manager", merci: "We appreciate your trust.",
    oeufs: "Eggs", paquet: (n) => `Eggs x${n}`,
  },
};
