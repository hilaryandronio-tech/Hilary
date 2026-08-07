-- =====================================================================
--  TAMA FERME — Migration : encaissement partiel des créances
--
--  À exécuter dans Supabase > SQL Editor AVANT de déployer la version de
--  l'application qui accompagne ce fichier. Le script est rejouable.
--
--  Pourquoi : une créance ne se soldait qu'en une fois (`ventes.solde` +
--  `ventes.date_solde`). Un client qui règle 500 000 Ar sur 800 000 n'était
--  pas saisissable — soit on soldait tout et 300 000 Ar de créance
--  disparaissaient, soit on ne saisissait rien et l'encaissement n'entrait
--  jamais en recette.
--
--  Un règlement est un fait daté : il lui faut sa propre ligne, pas deux
--  colonnes sur la vente. `solde` et `date_solde` disparaissent donc au
--  profit de la table `reglements`, dont elles ne sont qu'un cas particulier
--  (un règlement unique couvrant la totalité).
-- =====================================================================


-- =====================================================================
--  1. La table des règlements
-- =====================================================================

create table if not exists reglements (
  id         uuid primary key default gen_random_uuid(),
  vente_id   uuid not null references ventes(id) on delete cascade,
  date       date not null default current_date,
  montant    integer not null check (montant > 0),
  auteur     uuid references profils(id),
  created_at timestamptz not null default now()
);

create index if not exists reglements_date  on reglements (date);
create index if not exists reglements_vente on reglements (vente_id);


-- =====================================================================
--  2. Reprise de l'existant
--  Chaque créance déjà soldée devient un règlement unique, du montant de
--  la vente, à sa date d'encaissement. Rien n'est perdu.
--  Le `not exists` rend l'insertion rejouable sans créer de doublon.
-- =====================================================================

do $$
begin
  if exists (select 1 from information_schema.columns
             where table_name = 'ventes' and column_name = 'solde') then
    insert into reglements (vente_id, date, montant)
    select v.id, v.date_solde, v.montant
    from   ventes v
    where  v.credit and v.solde and v.date_solde is not null
      and  not exists (select 1 from reglements r where r.vente_id = v.id);
  end if;
end $$;


-- =====================================================================
--  3. Sécurité — même périmètre que l'encaissement d'une créance
-- =====================================================================

alter table reglements enable row level security;

drop   policy if exists lire_reglements on reglements;
create policy lire_reglements on reglements for select
  using (auth.uid() is not null);

drop   policy if exists saisir_reglement on reglements;
create policy saisir_reglement on reglements for insert
  with check (mon_role() in ('point_vente','direction'));

-- La file d'attente envoie des upsert : Postgres exige une policy UPDATE
-- dès que le chemin « conflit » est emprunté (voir migration 04).
drop   policy if exists corriger_reglement on reglements;
create policy corriger_reglement on reglements for update
  using      (mon_role() in ('point_vente','direction'))
  with check (mon_role() in ('point_vente','direction'));

-- Annuler un règlement saisi par erreur
drop   policy if exists annuler_reglement on reglements;
create policy annuler_reglement on reglements for delete
  using (mon_role() in ('point_vente','direction'));


-- =====================================================================
--  4. Les vues
-- =====================================================================

-- Créances en cours : ce qui reste dû, et non plus le montant d'origine.
-- `drop` puis `create` — les colonnes changent d'ordre, ce que
-- `create or replace view` n'accepte pas.
drop view if exists v_creances;
create view v_creances as
select v.id,
       v.date,
       coalesce(c.nom, 'Point de vente')            as client,
       v.montant                                    as montant,
       coalesce(r.regle, 0)                         as regle,
       v.montant - coalesce(r.regle, 0)             as reste,
       current_date - v.date                        as anciennete_jours,
       case when current_date - v.date > 60 then 'critique'
            when current_date - v.date > 30 then 'a_relancer'
            else 'normal' end                       as statut
from   ventes v
left   join clients c on c.id = v.client_id
left   join (select vente_id, sum(montant) as regle
             from   reglements group by vente_id) r on r.vente_id = v.id
where  v.credit
  and  v.montant - coalesce(r.regle, 0) > 0
order  by v.date;


-- Trésorerie du jour : les ventes comptant, plus les règlements reçus ce
-- jour-là. Même colonne `encaisse`, alimentée autrement — les vues qui en
-- dépendent (v_taux_ponte, v_bilan_mensuel) ne bougent pas.
create or replace view v_journalier as
with jours as (
  select date from saisies_ferme
  union select date from pontes
  union select date from ventes
  union select date from charges
  union select date from reglements
),
cheptel as (
  select sum(vivant)                                  as total,
         sum(vivant) filter (where en_ponte)          as en_ponte
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
       coalesce((select sum(oeufs_casses + oeufs_sales)
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


-- =====================================================================
--  5. Retrait des anciennes colonnes
--  À exécuter une fois les étapes 1 à 4 passées sans erreur. Les données
--  qu'elles portaient sont désormais dans `reglements` (étape 2).
--  L'index partiel sur (credit, solde) disparaît avec la colonne.
-- =====================================================================

alter table ventes drop constraint if exists solde_coherent;
alter table ventes drop column     if exists solde;
alter table ventes drop column     if exists date_solde;
