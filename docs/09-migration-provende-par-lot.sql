-- =====================================================================
--  TAMA FERME — Un prix de provende par bâtiment
--
--  À exécuter dans Supabase > SQL Editor AVANT de déployer la version de
--  l'application qui accompagne ce fichier. Le script est rejouable.
--
--  Le prix du kilo n'est pas le même pour toutes les vagues : la 3ème est
--  à 2 890 Ar (aliment PN020F, poulettes), les 1ère et 2ème à 2 718 Ar.
--  `parametres.prix_provende_kg` était unique et global — le coût de la
--  provende, donc le bénéfice et le prix de revient, étaient faux dès que
--  deux vagues d'âges différents cohabitaient.
--
--  Deux niveaux, comme pour les ventes :
--    - `lots.prix_provende_kg`          : le tarif courant du bâtiment ;
--    - `saisies_ferme.prix_provende_kg` : le prix figé au moment de la
--      saisie, sur le modèle de `vente_lignes.prix_unit`. Sans lui, une
--      hausse du fournisseur réécrirait rétroactivement le coût de tous
--      les mois passés.
--
--  `parametres.prix_provende_kg` reste en base mais n'est plus lu par le
--  calcul. Il sert de valeur par défaut pour un nouveau bâtiment.
-- =====================================================================

alter table lots
  add column if not exists prix_provende_kg integer not null default 2718
  check (prix_provende_kg >= 0);

alter table saisies_ferme
  add column if not exists prix_provende_kg integer
  check (prix_provende_kg is null or prix_provende_kg >= 0);

-- La 3ème vague — le bâtiment encore en poulettes — est à 2 890 Ar.
update lots set prix_provende_kg = 2890 where id = 'V3';
update lots set prix_provende_kg = 2718 where id in ('V1', 'V2');


-- =====================================================================
--  Les vues : le prix du bâtiment devient lisible, et le coût de la
--  provende est calculé ligne à ligne au lieu d'une multiplication
--  globale. Colonnes ajoutées en fin de liste, pour que
--  `create or replace` les accepte.
-- =====================================================================

create or replace view v_effectif as
select l.id                 as lot_id,
       l.nom,
       l.en_ponte,
       l.effectif_initial,
       l.effectif_initial - coalesce(sum(s.mortalite), 0) as vivant,
       floor((current_date - l.date_mise_en_place) / 7.0)::int as age_semaines,
       l.prix_provende_kg
from   lots l
left   join saisies_ferme s on s.lot_id = l.id
where  l.actif
group  by l.id;


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
       (select en_ponte from cheptel)                            as poules_en_ponte,
       -- Chaque saisie à son propre prix : celui figé le soir même, ou à
       -- défaut le tarif courant de son bâtiment pour les lignes anciennes.
       coalesce((select sum(s.provende_kg * coalesce(s.prix_provende_kg, l.prix_provende_kg))
                 from saisies_ferme s
                 join lots l on l.id = s.lot_id
                 where s.date = j.date), 0)::bigint              as cout_provende
from   jours j;
