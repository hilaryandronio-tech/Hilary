-- =====================================================================
--  TAMA FERME — Le comptage du magasin, point de départ du stock
--
--  À exécuter dans Supabase > SQL Editor AVANT de déployer la version de
--  l'application qui accompagne ce fichier. Rejouable.
--
--  « Collecté moins vendu » depuis la première fiche de ponte donnait un
--  stock négatif — 6 118 œufs manquants au 2026-09-05. La cause a été
--  cherchée et écartée une à une : la collecte est saisie tous les jours,
--  aucune vente au comptoir n'est sans détail, et un seul vrai doublon a
--  été trouvé (1 260 œufs). Il ne restait que l'évidence : le magasin
--  n'était pas vide le 1er août, et le compte partait de zéro.
--
--  Un comptage physique tranche la question une fois pour toutes. À partir
--  de sa date, le stock ne dépend plus que des mouvements postérieurs — ce
--  qui est entré, ce qui est sorti — et l'historique douteux d'avant cesse
--  de peser.
--
--  Plusieurs comptages peuvent se succéder : la vue prend toujours le plus
--  récent. Recompter le magasin remet donc les compteurs d'aplomb, sans
--  qu'il faille rien corriger en arrière.
-- =====================================================================

create table if not exists stock_oeufs_compte (
  date    date not null,
  calibre text not null references calibres(code),
  oeufs   integer not null check (oeufs >= 0),
  auteur  uuid references profils(id),
  saisi_a timestamptz not null default now(),
  primary key (date, calibre)
);

alter table stock_oeufs_compte enable row level security;

drop   policy if exists lire_comptage on stock_oeufs_compte;
create policy lire_comptage on stock_oeufs_compte for select
  using (auth.uid() is not null);

-- La magasinière compte le magasin, la direction corrige. Le point de vente
-- ne compte pas : il fait sortir les œufs, il ne les range pas.
drop   policy if exists compter_stock on stock_oeufs_compte;
create policy compter_stock on stock_oeufs_compte for insert
  with check (mon_role() in ('magasiniere', 'direction'));

drop   policy if exists corriger_comptage on stock_oeufs_compte;
create policy corriger_comptage on stock_oeufs_compte for update
  using      (mon_role() in ('magasiniere', 'direction'))
  with check (mon_role() in ('magasiniere', 'direction'));

-- =====================================================================
--  La vue repart du dernier comptage
--
--  Sans comptage, `depuis` tombe la veille de la première fiche de ponte :
--  la vue se comporte exactement comme avant, et rien ne casse.
-- =====================================================================

-- La vue gagne une colonne, `compte`, en troisième position :
-- `create or replace` refuse de renommer les colonnes d'une vue existante.
-- On la supprime d'abord — une vue ne contient pas de données, elle
-- recalcule à chaque lecture, il n'y a rien à perdre.
drop view if exists v_stock_oeufs;

create view v_stock_oeufs as
with reference as (
  select coalesce((select max(date) from stock_oeufs_compte),
                  (select min(date) - 1 from pontes)) as depuis
),
collecte as (
  select l.calibre, sum(l.oeufs)::bigint as oeufs
  from   ponte_lignes l join pontes p on p.id = l.ponte_id
  where  p.date > (select depuis from reference)
  group  by l.calibre
),
vendu as (
  select l.calibre, sum(l.oeufs)::bigint as oeufs
  from   vente_lignes l join ventes v on v.id = l.vente_id
  where  v.date > (select depuis from reference)
  group  by l.calibre
)
select c.code                                    as calibre,
       c.ordre,
       coalesce(s.oeufs, 0)::bigint              as compte,
       coalesce(co.oeufs, 0)                     as collectes,
       coalesce(ve.oeufs, 0)                     as vendus,
       coalesce(s.oeufs, 0) + coalesce(co.oeufs, 0) - coalesce(ve.oeufs, 0) as disponibles,
       (select depuis from reference)            as depuis,
       exists (select 1 from stock_oeufs_compte) as compte_pose
from   calibres c
left   join stock_oeufs_compte s
       on s.calibre = c.code and s.date = (select depuis from reference)
left   join collecte co on co.calibre = c.code
left   join vendu    ve on ve.calibre = c.code;

-- Contrôle : sans comptage, le stock est celui d'avant.
select calibre, compte, collectes, vendus, disponibles, depuis, compte_pose
from   v_stock_oeufs order by ordre;
