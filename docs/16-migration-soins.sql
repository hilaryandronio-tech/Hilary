-- =====================================================================
--  TAMA FERME — Soins et compléments du jour
--
--  À exécuter dans Supabase > SQL Editor AVANT de déployer la version de
--  l'application qui accompagne ce fichier. Rejouable.
--
--  Distinct du calendrier de `interventions`, qui porte ce que le Shop a
--  planifié — vaccins et traitements datés à l'avance. Ici, ce que le chef
--  de ferme donne au quotidien : l'eau bue, le coquillage, et les produits
--  administrés selon les besoins.
--
--  Une ligne par (bâtiment, jour, poste), pour qu'une ressaisie corrige au
--  lieu de dupliquer — même principe que les fiches de ponte.
-- =====================================================================

create table if not exists soins (
  id        uuid primary key default gen_random_uuid(),
  lot_id    text not null references lots(id) on delete cascade,
  date      date not null,
  poste     text not null
            check (poste in ('eau', 'coquillage', 'vitamine', 'vermifuge', 'antibiotique')),
  -- Litres pour l'eau, kilos pour le coquillage ; null pour un produit
  -- simplement donné, dont seule l'administration compte.
  quantite  numeric(10,2) check (quantite is null or quantite >= 0),
  produit   text,
  auteur    uuid references profils(id),
  created_at timestamptz not null default now(),
  unique (lot_id, date, poste)
);

create index if not exists soins_date on soins (date);
create index if not exists soins_lot  on soins (lot_id, date);


-- =====================================================================
--  Sécurité — le chef de ferme administre, la direction voit et corrige.
--  Les upsert de la file d'attente exigent la policy UPDATE même sans
--  conflit apparent (voir migration 04).
-- =====================================================================

alter table soins enable row level security;

drop   policy if exists lire_soins on soins;
create policy lire_soins on soins for select
  using (auth.uid() is not null);

drop   policy if exists saisir_soin on soins;
create policy saisir_soin on soins for insert
  with check (mon_role() in ('chef_ferme', 'direction'));

drop   policy if exists corriger_soin on soins;
create policy corriger_soin on soins for update
  using      (mon_role() in ('chef_ferme', 'direction'))
  with check (mon_role() in ('chef_ferme', 'direction'));

drop   policy if exists annuler_soin on soins;
create policy annuler_soin on soins for delete
  using (mon_role() in ('chef_ferme', 'direction'));
