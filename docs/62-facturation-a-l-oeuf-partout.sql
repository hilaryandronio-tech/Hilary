-- =====================================================================
--  TAMA FERME — Tout se facture à l'œuf, sauf Leader Price
--
--  À exécuter dans Supabase > SQL Editor. Rejouable.
--
--  Les six factures relevées jusqu'ici — La Terrasse, Mada-Rest, La braise
--  Coté cour, Mr Mamy, Mercy Ships, Hôtel Calypso — comptent toutes à
--  l'unité : « Oeufs · 600 · 800Ar ». Seul Leader Price compte en
--  barquettes, x6 et x12. Le gérant tranche : c'est la règle pour tous.
--
--  L'alvéole de trente n'a jamais été un choix. C'était la valeur par
--  défaut de la colonne, posée par docs/24 faute de mieux, et les
--  cinquante-cinq clients dont on n'avait pas vu la facture l'avaient
--  héritée. Leurs factures écrivaient « Oeufs x30 · 160 · 22 800 Ar » là
--  où elles doivent écrire « Oeufs · 4 800 · 760 Ar ». Même total, autre
--  document.
--
--  DEUX CHANGEMENTS, et le second est le plus important.
--
--  Le premier vaut pour l'avenir : la fiche du client. Le second reprend
--  les livraisons déjà enregistrées, qui portent l'alvéole sur leur ligne
--  depuis docs/56. Sans lui, toute facture réimprimée sortirait encore en
--  alvéoles — et c'est précisément ce qu'on veut corriger.
--
--  Le garde-fou `not exists` protège la clé primaire (vente_id, calibre,
--  conditionnement) : deux lignes du même calibre ne peuvent pas se
--  retrouver au même conditionnement. Aucun cas aujourd'hui — toutes les
--  lignes d'une même vente partagent son emballage — mais le fichier doit
--  rester rejouable.
-- =====================================================================

begin;

-- 1. Les fiches clients. Leader Price garde ses douze et ses barquettes.
update clients
   set conditionnement = 1
 where nom <> 'Leader Price'
   and conditionnement <> 1;

-- 2. Les livraisons déjà enregistrées.
update vente_lignes l
   set conditionnement = 1
  from ventes v
  left join clients c on c.id = v.client_id
 where v.id = l.vente_id
   and l.conditionnement <> 1
   and coalesce(c.nom, '') <> 'Leader Price'
   and not exists (
     select 1 from vente_lignes m
     where m.vente_id = l.vente_id
       and m.calibre = l.calibre
       and m.conditionnement = 1
   );

commit;


-- =====================================================================
--  Contrôle 1 : plus aucun client à l'alvéole. Seul Leader Price doit
--  apparaître, à 12.
-- =====================================================================

select nom, conditionnement, conditionnements
from   clients
where  conditionnement <> 1
order  by nom;


-- =====================================================================
--  Contrôle 2 : les lignes de vente. Tout à 1, sauf les six lignes de
--  Leader Price à 12.
-- =====================================================================

select coalesce(c.nom, 'Comptoir') as client,
       l.conditionnement,
       count(*)     as lignes,
       sum(l.oeufs) as oeufs
from   vente_lignes l
join   ventes v on v.id = l.vente_id
left   join clients c on c.id = v.client_id
where  l.conditionnement <> 1
group  by c.nom, l.conditionnement
order  by c.nom;
