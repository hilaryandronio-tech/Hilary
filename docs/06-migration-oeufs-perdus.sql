-- =====================================================================
--  TAMA FERME — Migration : séparer la casse vendable du dégât perdu
--
--  À exécuter dans Supabase > SQL Editor AVANT de déployer la version de
--  l'application qui accompagne ce fichier. Le script est rejouable.
--
--  Trois sorts distincts, là où le schéma n'en connaissait que deux :
--    - cassés récupérables : se vendent à 500 Ar, hors grille des calibres,
--      comptés en production (ligne CASSE de `ponte_lignes`) ;
--    - sales : nettoyés puis vendus au prix de leur calibre, donc comptés
--      dans la grille normale — `oeufs_sales` n'est qu'un indicateur de
--      qualité du ramassage, sans valeur propre ;
--    - dégâts irrécupérables : perte sèche, ni vendus ni produits.
--
--  Seul le troisième manquait.
-- =====================================================================

alter table pontes
  add column if not exists oeufs_perdus integer not null default 0
  check (oeufs_perdus >= 0);


-- =====================================================================
--  `degats` additionnait les cassés et les sales — c'est-à-dire deux
--  catégories qui se vendent. La perte réelle, ce sont les irrécupérables.
--  Même liste de colonnes qu'avant : les vues qui dépendent de
--  v_journalier (v_taux_ponte, v_bilan_mensuel) ne bougent pas.
-- =====================================================================

create or replace view v_journalier as
with jours as (
  select date from saisies_ferme
  union select date from pontes
  union select date from ventes
  union select date from charges
  union select date from reglements
),
cheptel as (
  select sum(vivant) as total, sum(vivant) filter (where en_ponte) as en_ponte
  from   v_effectif
)
select j.date,
       coalesce((select sum(pl.oeufs)
                 from ponte_lignes pl join pontes p on p.id = pl.ponte_id
                 where p.date = j.date), 0)                      as oeufs,
       coalesce((select sum(pl.oeufs * c.prix_base)
                 from ponte_lignes pl
                 join pontes p   on p.id = pl.ponte_id
                 join calibres c on c.code = pl.calibre
                 where p.date = j.date), 0)                      as valeur_collecte,
       coalesce((select sum(oeufs_perdus)
                 from pontes where date = j.date), 0)            as degats,
       coalesce((select sum(provende_kg) from saisies_ferme where date = j.date), 0) as provende_kg,
       coalesce((select sum(mortalite)   from saisies_ferme where date = j.date), 0) as mortalite,
       coalesce((select sum(montant) from ventes
                 where date = j.date and not credit), 0)
       + coalesce((select sum(montant) from reglements
                 where date = j.date), 0)                        as encaisse,
       coalesce((select sum(montant) from ventes
                 where date = j.date and credit), 0)             as livre_credit,
       coalesce((select sum(montant) from charges where date = j.date), 0) as charges,
       (select en_ponte from cheptel)                            as poules_en_ponte
from   jours j;
