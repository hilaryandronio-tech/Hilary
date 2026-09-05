-- =====================================================================
--  TAMA FERME — Les œufs disponibles
--
--  À exécuter dans Supabase > SQL Editor AVANT de déployer la version de
--  l'application qui accompagne ce fichier. Rejouable.
--
--  Disponible = collecté − vendu, calibre par calibre.
--
--  Les pertes ne se soustraient pas : `pontes.oeufs_perdus` compte des œufs
--  qui n'ont jamais été portés dans `ponte_lignes`. Les retirer une seconde
--  fois creuserait un trou dans le stock. Les sales non plus : ils sont
--  nettoyés puis vendus dans leur calibre, `oeufs_sales` n'étant qu'un
--  indicateur de qualité du ramassage. Les cassés, eux, ont leur propre
--  ligne et se vendent, donc ils comptent des deux côtés.
--
--  LIMITE À CONNAÎTRE. Une vente au comptoir saisie en montant global — la
--  « recette du jour » — ne porte aucune ligne par calibre. Les œufs qu'elle
--  a fait sortir ne sont donc pas déduits, et le stock affiché est d'autant
--  trop élevé. La vue le dit : `ventes_sans_detail` compte ces saisies.
-- =====================================================================

create or replace view v_stock_oeufs as
with collecte as (
  select l.calibre, sum(l.oeufs)::bigint as oeufs, min(p.date) as depuis
  from   ponte_lignes l join pontes p on p.id = l.ponte_id
  group  by l.calibre
),
vendu as (
  select l.calibre, sum(l.oeufs)::bigint as oeufs
  from   vente_lignes l join ventes v on v.id = l.vente_id
  group  by l.calibre
)
select c.code                                             as calibre,
       c.ordre,
       coalesce(co.oeufs, 0)                              as collectes,
       coalesce(ve.oeufs, 0)                              as vendus,
       coalesce(co.oeufs, 0) - coalesce(ve.oeufs, 0)      as disponibles,
       co.depuis
from   calibres c
left   join collecte co on co.calibre = c.code
left   join vendu    ve on ve.calibre = c.code;

-- Ce que la vue ne peut pas voir : les ventes sans détail par calibre.
create or replace view v_stock_oeufs_reserve as
select count(*)::int as ventes_sans_detail,
       coalesce(sum(v.montant), 0)::bigint as ariary
from   ventes v
where  not exists (select 1 from vente_lignes l where l.vente_id = v.id);

-- Contrôle : le stock par calibre, et le total.
select calibre, collectes, vendus, disponibles
from   v_stock_oeufs order by ordre;

select sum(disponibles) as oeufs_disponibles from v_stock_oeufs;
select * from v_stock_oeufs_reserve;
