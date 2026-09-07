-- =====================================================================
--  TAMA FERME — Les mentions de facturation de Côté cour
--
--  À exécuter dans Supabase > SQL Editor. Rejouable. Suppose docs/37
--  passé, qui rouvre le compte.
--
--  Côté cour facture sous son seul nom, « Coté cour » — sans accent
--  circonflexe sur le document, là où la base écrit « Côté cour ». D'où
--  `nom_facture`, qui existe pour cet écart entre le nom qu'on saisit et
--  celui qu'on imprime.
--
--  L'adresse et le téléphone sont ceux de La braise : deux établissements
--  séparés, tenus par la même personne, au même endroit.
--
--  Reste une incohérence que ce fichier ne tranche pas : La braise
--  imprime encore « La braise Coté cour » (docs/24), un nom d'avant la
--  séparation. Maintenant que Côté cour facture de son côté, les deux
--  établissements apparaissent sur la facture de l'un d'eux seulement.
--  À corriger quand le gérant aura dit sous quel nom La braise doit
--  facturer désormais.
-- =====================================================================

update clients set
  nom_facture   = 'Coté cour',
  adresse       = E'69 boulevard joffre,\nToamasina 501, Madagascar',
  telephone_fac = '+261 34 12 456 13'
where nom = 'Côté cour';


-- Contrôle : deux comptes actifs, deux noms imprimés distincts, même
-- adresse, L2 à 800 Ar de part et d'autre.
select c.nom, c.actif, c.nom_facture, c.telephone_fac,
       c.conditionnement, c.delai_paiement_jours, c.coordonnees_paiement,
       t.prix as prix_l2
from   clients c
left   join tarifs_clients t on t.client_id = c.id and t.calibre = 'L2'
where  c.nom in ('La braise', 'Côté cour')
order  by c.nom;
