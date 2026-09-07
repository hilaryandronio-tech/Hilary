-- =====================================================================
--  TAMA FERME — Côté cour redevient un client à part entière
--
--  À exécuter dans Supabase > SQL Editor. Rejouable.
--
--  docs/24 avait désactivé « Côté cour » : sa facture du 19 août le
--  nommait « La braise Coté cour », un seul établissement, un seul
--  compte. C'était vrai à cette date.
--
--  Les deux se sont séparés depuis. Même gérant, mais deux
--  établissements, donc deux comptes : chacun sa facture, chacune sa
--  créance. Un seul compte mêlerait des impayés qui ne se répondent pas.
--
--  Le tarif ne change pas — L2 à 800 Ar, le même que Masteva, La braise
--  et Calypso (docs/19). Il est réaffirmé ici pour que le compte rouvert
--  ne reparte pas au prix de grille.
--
--  Ce que ce fichier ne fait PAS : il ne touche ni aux ventes d'août, qui
--  restent sur La braise puisque c'est là qu'elles ont été facturées, ni
--  au `nom_facture` de La braise, qui porte encore « La braise Coté
--  cour ». Les factures d'août ont été envoyées sous ce nom, et
--  l'application les réimprime avec les mentions du jour : le changer
--  réécrirait le passé.
-- =====================================================================

update clients set
  actif = true,
  conditionnement = 1,
  delai_paiement_jours = 30,
  coordonnees_paiement = true
where nom = 'Côté cour';

insert into tarifs_clients (client_id, calibre, prix)
select c.id, 'L2', 800 from clients c where c.nom = 'Côté cour'
on conflict (client_id, calibre) do update set prix = excluded.prix;


-- Contrôle 1 : les quatre clients au même tarif, L2 à 800 Ar. Quatre
-- lignes attendues.
select c.nom, c.actif, t.calibre, t.prix
from   clients c
join   tarifs_clients t on t.client_id = c.id and t.calibre = 'L2'
where  c.nom in ('Calypso', 'Masteva', 'La braise', 'Côté cour')
order  by c.nom;

-- Contrôle 2 : Côté cour rouvert, et ce qu'il porte déjà comme ventes.
select c.nom, c.actif, c.nom_facture, c.adresse, c.telephone_fac,
       c.conditionnement, c.delai_paiement_jours,
       count(v.id) as ventes
from   clients c
left   join ventes v on v.client_id = c.id
where  c.nom in ('Côté cour', 'La braise')
group  by c.id, c.nom, c.actif, c.nom_facture, c.adresse,
          c.telephone_fac, c.conditionnement, c.delai_paiement_jours
order  by c.nom;
