-- =====================================================================
--  TAMA FERME — Les œufs vendus jour par jour, calibre et prix
--
--  À exécuter dans Supabase > SQL Editor AVANT de déployer la version de
--  l'application qui accompagne ce fichier. Rejouable.
--
--  L'écran Caisse montre la journée en cours, l'écran Stock montre les
--  totaux collectés et vendus. Aucun des deux ne dit à quel prix les œufs
--  sont partis. C'était la question posée : voir, pour chaque jour, ce qui
--  est sorti, dans quel calibre, à quel prix.
--
--  Le prix fait partie de la clé de regroupement, et non d'une moyenne.
--  Un même calibre part le même jour à deux prix différents — un client à
--  tarif négocié et un client au prix de base — et une moyenne effacerait
--  précisément ce qu'on cherche à voir. Un jour peut donc porter deux
--  lignes du même calibre : ce n'est pas un doublon.
--
--  Les ventes saisies en montant global n'ont pas de ligne de calibre.
--  Elles sont absentes de la première vue, et comptées à part dans la
--  seconde : sans ça, la recette de la journée paraîtrait incomplète sans
--  qu'on sache pourquoi.
-- =====================================================================

create or replace view v_ventes_jour_calibre as
select v.date,
       l.calibre,
       cal.ordre,
       l.prix_unit,
       sum(l.oeufs)::bigint               as oeufs,
       sum(l.oeufs * l.prix_unit)::bigint as montant,
       count(distinct v.id)               as ventes
from   ventes v
join   vente_lignes l on l.vente_id = v.id
join   calibres cal   on cal.code = l.calibre
group  by v.date, l.calibre, cal.ordre, l.prix_unit;


-- Les encaissements sans détail par calibre — recette du jour, vente à
-- crédit saisie en ariary. Ces œufs-là sont sortis sans qu'on sache
-- lesquels.
create or replace view v_ventes_jour_sans_detail as
select v.date,
       count(*)::bigint          as ventes,
       sum(v.montant)::bigint    as montant
from   ventes v
where  not exists (select 1 from vente_lignes l where l.vente_id = v.id)
group  by v.date;


-- Contrôle : les dix derniers jours vendus, calibre par calibre. Le total
-- des œufs d'une journée doit égaler la colonne « vendus » de
-- v_stock_oeufs_jour à la même date.
select date, calibre, prix_unit, oeufs, montant
from   v_ventes_jour_calibre
where  date >= (select max(date) - 9 from v_ventes_jour_calibre)
order  by date desc, ordre;
