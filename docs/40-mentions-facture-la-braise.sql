-- =====================================================================
--  TAMA FERME — Les mentions de facturation de La braise, après la
--  séparation d'avec Côté cour
--
--  À exécuter dans Supabase > SQL Editor. Rejouable.
--
--  docs/24 avait relevé « La braise Coté cour », 69 boulevard joffre, sur
--  la facture du 19 août : les deux établissements n'en faisaient qu'un.
--  Ils sont séparés depuis, et La braise a son propre siège au Club
--  Nautique. Le 69 boulevard joffre reste à Côté cour (docs/39).
--
--  L'adresse est écrite sur trois lignes plutôt qu'une : la colonne
--  client de la facture est étroite, et une adresse de cette longueur y
--  revient à la ligne n'importe où. Le contenu est celui donné par le
--  gérant, mot pour mot.
--
--  Ce que ce changement emporte : l'application réimprime une facture
--  avec les mentions du jour, non celles du jour de la vente. Les
--  factures d'août, envoyées sous « La braise Coté cour » au 69 boulevard
--  joffre, ressortiront désormais sous « La braise » au Club Nautique.
--  Le gérant l'a demandé en connaissance de cause ; les PDF déjà envoyés
--  gardent leur forme d'origine.
-- =====================================================================

update clients set
  nom_facture   = 'La braise',
  adresse       = E'Club Nautique et de Tennis\nBoulevard Ratsimilaho\nToamasina, Madagascar',
  telephone_fac = '+261372880784'
where nom = 'La braise';


-- Contrôle : deux comptes actifs, deux noms, deux adresses, deux
-- téléphones — et le même tarif L2 à 800 Ar.
select c.nom, c.actif, c.nom_facture, c.adresse, c.telephone_fac,
       c.conditionnement, c.delai_paiement_jours, t.prix as prix_l2
from   clients c
left   join tarifs_clients t on t.client_id = c.id and t.calibre = 'L2'
where  c.nom in ('La braise', 'Côté cour')
order  by c.nom;
