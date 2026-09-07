-- =====================================================================
--  TAMA FERME — Les mentions de facturation de Masteva
--
--  À exécuter dans Supabase > SQL Editor. Rejouable.
--
--  Masteva facture sous son propre nom : `nom_facture` reste vide, et
--  l'application imprime alors le nom de la base. Cette colonne n'existe
--  que pour les écarts — « Mada-Rest » pour MadaRest, « Coté cour » pour
--  Côté cour. Y recopier « Masteva » ne ferait qu'ajouter une valeur à
--  tenir à jour en double.
--
--  `conditionnement = 1` est posé par déduction, pas par relevé : aucune
--  facture Masteva n'a été fournie. Tous les clients de ce type dont on a
--  vu la facture — La Terrasse, MadaRest, La braise, Côté cour, Mr Mamy —
--  facturent à l'œuf. Par défaut la colonne vaut 30, et la facture
--  écrirait « 4 alvéoles à 24 000 Ar » là où les autres impriment
--  « 120 à 800 Ar ». À vérifier sur la prochaine facture envoyée.
--
--  Le délai de trente jours et le tarif L2 à 800 Ar sont déjà posés,
--  docs/36 et docs/19.
-- =====================================================================

update clients set
  adresse       = E'Salazamay\nToamasina 501, Madagascar',
  telephone_fac = '+261320704309',
  conditionnement = 1
where nom = 'Masteva';


-- Contrôle : Masteva avec son adresse, à l'œuf, à trente jours, L2 à 800.
select c.nom, c.actif, c.nom_facture, c.adresse, c.telephone_fac,
       c.conditionnement, c.delai_paiement_jours, c.coordonnees_paiement,
       t.prix as prix_l2
from   clients c
left   join tarifs_clients t on t.client_id = c.id and t.calibre = 'L2'
where  c.nom = 'Masteva';
