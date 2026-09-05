-- =====================================================================
--  TAMA FERME — Le mouvement des œufs, jour par jour
--
--  À exécuter dans Supabase > SQL Editor AVANT de déployer la version de
--  l'application qui accompagne ce fichier. Rejouable.
--
--  La carte du stock ne donnait qu'un cumul par calibre : on voyait le
--  solde sans voir comment il s'était fait. Cette vue rend le détail —
--  ce qui est entré, ce qui est sorti, et le reste, à chaque date.
--
--  Le solde court à partir du dernier comptage physique, comme
--  `v_stock_oeufs` : c'est la même référence, les deux vues racontent la
--  même histoire, l'une par calibre et l'autre par jour.
--
--  Une date apparaît dès qu'elle porte une collecte ou une vente. Un jour
--  sans mouvement d'aucune sorte n'a pas de ligne — il n'y a rien à en
--  dire, et une suite de lignes vides masquerait les journées qui comptent.
-- =====================================================================

create or replace view v_stock_oeufs_jour as
with reference as (
  select coalesce((select max(date) from stock_oeufs_compte),
                  (select min(date) - 1 from pontes)) as depuis
),
depart as (
  select coalesce(sum(oeufs), 0)::bigint as oeufs
  from   stock_oeufs_compte
  where  date = (select depuis from reference)
),
collecte as (
  select p.date, sum(l.oeufs)::bigint as oeufs
  from   ponte_lignes l join pontes p on p.id = l.ponte_id
  where  p.date > (select depuis from reference)
  group  by p.date
),
vendu as (
  select v.date, sum(l.oeufs)::bigint as oeufs
  from   vente_lignes l join ventes v on v.id = l.vente_id
  where  v.date > (select depuis from reference)
  group  by v.date
),
jours as (
  select date from collecte
  union
  select date from vendu
)
select j.date,
       coalesce(c.oeufs, 0) as collectes,
       coalesce(v.oeufs, 0) as vendus,
       coalesce(c.oeufs, 0) - coalesce(v.oeufs, 0) as mouvement,
       (select oeufs from depart)
         + sum(coalesce(c.oeufs, 0) - coalesce(v.oeufs, 0)) over (order by j.date)
                            as disponibles
from   jours j
left   join collecte c on c.date = j.date
left   join vendu    v on v.date = j.date;

-- Contrôle : les dix derniers jours, le plus récent en premier. La dernière
-- valeur de `disponibles` doit égaler le total de v_stock_oeufs.
select date, collectes, vendus, mouvement, disponibles
from   v_stock_oeufs_jour order by date desc limit 10;
