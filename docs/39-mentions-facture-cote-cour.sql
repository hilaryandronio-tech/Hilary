-- =====================================================================
--  TAMA FERME — Les mentions de facturation de Côté cour
--
--  À exécuter dans Supabase > SQL Editor. Rejouable. Suppose docs/37
--  passé, qui rouvre le compte.
--
--  Le gérant donne pour Côté cour les mêmes mentions que La braise : même
--  nom imprimé, même adresse, même téléphone. Les deux établissements
--  sont séparés mais tenus par la même personne, à la même enseigne.
--
--  Les valeurs sont recopiées au caractère près de docs/24 — « Coté cour »
--  sans accent circonflexe, l'adresse sur deux lignes — pour que les deux
--  factures sortent identiques. Une différence d'un accent entre les deux
--  comptes se verrait sur les documents envoyés.
--
--  Conséquence à connaître : l'en-tête client de leurs factures sera le
--  même. Ce qui les distingue est le numéro de facture, le bon de commande
--  et les lignes. Si un jour il faut les séparer à l'œil, c'est
--  `nom_facture` qu'on changera.
-- =====================================================================

update clients set
  nom_facture   = 'La braise Coté cour',
  adresse       = E'69 boulevard joffre,\nToamasina 501, Madagascar',
  telephone_fac = '+261 34 12 456 13'
where nom = 'Côté cour';


-- Contrôle : deux comptes actifs, mentions identiques, L2 à 800 Ar.
select c.nom, c.actif, c.nom_facture, c.adresse, c.telephone_fac,
       c.conditionnement, c.delai_paiement_jours, c.coordonnees_paiement,
       t.prix as prix_l2
from   clients c
left   join tarifs_clients t on t.client_id = c.id and t.calibre = 'L2'
where  c.nom in ('La braise', 'Côté cour')
order  by c.nom;
