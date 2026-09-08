-- =====================================================================
--  TAMA FERME — Les mentions de facturation de Calypso
--
--  À exécuter dans Supabase > SQL Editor. Rejouable.
--
--  Relevé sur la facture du 4 septembre 2026, F-20260904-075344, bon
--  060-09-2026 : 600 œufs à 800 Ar, 480 000 Ar, à trente jours.
--
--    Nom imprimé   Hôtel Calypso
--    Adresse       Rue Lieutenant Noël
--                  Ambodimanga BP 159
--                  Toamasina 501, Madagascar
--    Téléphone     +261 (0)20 76 304 57
--
--  `conditionnement = 1` : la facture compte « Oeufs · 600 · 800Ar », à
--  l'unité. Par défaut la colonne vaut 30 et la facture écrirait
--  « 20 alvéoles à 24 000 Ar » — même total, autre document.
--
--  Le modèle reste `simple` : quatre colonnes, Catégorie / Quantité / Prix
--  unitaire / Montant, sans Code M ni ligne de désignation. C'est celui de
--  La Terrasse, et c'est déjà la valeur par défaut.
--
--  Le délai de trente jours est déjà posé (docs/36) et le tarif L2 à
--  800 Ar depuis l'origine (docs/01) — la facture le confirme.
--
--  Une différence assumée : cette facture de septembre ne porte pas le
--  Mvola ni le compte bancaire. Le gérant a demandé le 7 septembre qu'ils
--  figurent sur toutes les factures sauf Leader Price ; celles de Calypso
--  les porteront donc désormais.
-- =====================================================================

update clients set
  nom_facture   = 'Hôtel Calypso',
  adresse       = E'Rue Lieutenant Noël\nAmbodimanga BP 159\nToamasina 501, Madagascar',
  telephone_fac = '+261 (0)20 76 304 57',
  conditionnement = 1
where nom = 'Calypso';


-- Contrôle 1 : les mentions posées.
select nom, nom_facture, adresse, telephone_fac, conditionnement,
       modele, delai_paiement_jours, coordonnees_paiement
from   clients
where  nom = 'Calypso';


-- Contrôle 2 : ses livraisons doivent toutes être en L2 à 800 Ar — une
-- seule ligne, 8 livraisons, 4 800 œufs, 3 840 000 Ar.
select l.calibre, l.prix_unit,
       count(distinct v.id) as livraisons,
       sum(l.oeufs)         as oeufs,
       sum(l.oeufs * l.prix_unit) as encaissable
from   ventes v
join   vente_lignes l on l.vente_id = v.id
join   clients c      on c.id = v.client_id
where  c.nom = 'Calypso'
group  by l.calibre, l.prix_unit
order  by l.calibre, l.prix_unit;
