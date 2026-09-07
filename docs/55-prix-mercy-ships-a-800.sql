-- =====================================================================
--  TAMA FERME — Mercy Ships est à 800 Ar depuis le début
--
--  À exécuter dans Supabase > SQL Editor. Rejouable.
--
--  LIRE AVANT DE LANCER. Ce fichier relève d'environ 1,56 million
--  d'ariary le chiffre d'affaires d'août et de septembre. Il repose sur
--  une seule affirmation du gérant : le prix Mercy Ships est de 800 Ar
--  l'œuf depuis le début, et les 200 Ar de commission de l'intermédiaire
--  s'ajoutent par-dessus — d'où les 1 000 Ar portés sur la facture.
--
--  C'est exactement le modèle déjà posé par docs/24, et la base le
--  confirme : `tarifs_clients` porte pour Mercy Ships en M2 un prix de
--  800 encaissé et un prix_facture de 1 000. La facture est donc déjà
--  juste. C'est la caisse qui ne l'est pas.
--
--  Pourquoi : le carnet a été importé le 5 septembre (docs/30) avec le
--  prix de la grille du jour — 700 Ar avant le 11 août, 720 après — parce
--  que le tarif négocié M2 n'existait pas encore en base à ce moment-là.
--  L'import prend le tarif du client s'il en trouve un, sinon la grille.
--  Il n'en a pas trouvé.
--
--  Trente-cinq livraisons sont donc sous-évaluées. Seule celle du 31 août,
--  réinsérée après coup par docs/52, est déjà à 800.
--
--  Ce que ça déplace : les créances Mercy Ships et le chiffre d'affaires
--  d'août montent d'autant. Les mois sont déjà arrêtés — c'est une
--  correction de fond, pas un ajustement cosmétique.
-- =====================================================================


-- ---------------------------------------------------------------------
--  À lancer d'abord, seul : l'état avant correction.
-- ---------------------------------------------------------------------

select l.prix_unit,
       count(distinct v.id) as livraisons,
       sum(l.oeufs)         as oeufs,
       sum(l.oeufs * l.prix_unit)       as encaissable_actuel,
       sum(l.oeufs * 800)               as encaissable_a_800,
       sum(l.oeufs * 800 - l.oeufs * l.prix_unit) as ecart
from   ventes v
join   vente_lignes l on l.vente_id = v.id
join   clients c      on c.id = v.client_id
where  c.nom = 'Mercy Ships' and l.calibre = 'M2'
group  by l.prix_unit
order  by l.prix_unit;


-- ---------------------------------------------------------------------
--  La correction.
-- ---------------------------------------------------------------------

begin;

update vente_lignes l
   set prix_unit = 800
  from ventes v
  join clients c on c.id = v.client_id
 where v.id = l.vente_id
   and c.nom = 'Mercy Ships'
   and l.calibre = 'M2'
   and l.prix_unit <> 800;

-- Le montant de l'entête se refait depuis ses lignes, comme dans docs/18.
update ventes v
   set montant = s.total
  from (select vente_id, sum(oeufs * prix_unit) as total
        from   vente_lignes group by vente_id) s
 where s.vente_id = v.id
   and v.client_id = (select id from clients where nom = 'Mercy Ships');

commit;


-- ---------------------------------------------------------------------
--  Contrôle : une seule ligne, à 800 Ar, sur toute la période.
-- ---------------------------------------------------------------------

select l.prix_unit,
       count(distinct v.id) as livraisons,
       sum(l.oeufs)         as oeufs,
       sum(l.oeufs * l.prix_unit) as encaisse,
       min(v.date)          as du,
       max(v.date)          as au
from   ventes v
join   vente_lignes l on l.vente_id = v.id
join   clients c      on c.id = v.client_id
where  c.nom = 'Mercy Ships' and l.calibre = 'M2'
group  by l.prix_unit
order  by l.prix_unit;
