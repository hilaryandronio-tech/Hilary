-- =====================================================================
--  TAMA FERME — Livraisons de provende et stock restant
--
--  À exécuter dans Supabase > SQL Editor AVANT de déployer la version de
--  l'application qui accompagne ce fichier. Le script est rejouable.
--
--  La feuille « Provende » note l'arrivée en sacs sur la ligne du jour,
--  puis en déduit le reste : stock de la veille + arrivage − distribué.
--  Vérifié sur août 2026 — 204 kg en stock, 40 sacs reçus le 3, 152 kg
--  distribués, et le 4 démarre à 2 052 kg. Un sac fait 50 kg (167 kg pour
--  3,34 sacs).
--
--  L'application enregistre déjà le distribué chaque soir
--  (`saisies_ferme.provende_kg`). Il ne manquait que les entrées.
-- =====================================================================

create table if not exists livraisons_provende (
  id         uuid primary key default gen_random_uuid(),
  lot_id     text not null references lots(id) on delete cascade,
  date       date not null,
  sacs       numeric(8,2) not null check (sacs > 0),
  poids_sac  integer not null default 50 check (poids_sac > 0),
  aliment    text,
  auteur     uuid references profils(id),
  created_at timestamptz not null default now()
);

create index if not exists livraisons_lot  on livraisons_provende (lot_id);
create index if not exists livraisons_date on livraisons_provende (date);


-- =====================================================================
--  Sécurité — le chef de ferme réceptionne, la direction voit et corrige.
-- =====================================================================

alter table livraisons_provende enable row level security;

drop   policy if exists lire_livraisons on livraisons_provende;
create policy lire_livraisons on livraisons_provende for select
  using (auth.uid() is not null);

drop   policy if exists saisir_livraison on livraisons_provende;
create policy saisir_livraison on livraisons_provende for insert
  with check (mon_role() in ('chef_ferme', 'direction'));

drop   policy if exists corriger_livraison on livraisons_provende;
create policy corriger_livraison on livraisons_provende for update
  using      (mon_role() in ('chef_ferme', 'direction'))
  with check (mon_role() in ('chef_ferme', 'direction'));

drop   policy if exists annuler_livraison on livraisons_provende;
create policy annuler_livraison on livraisons_provende for delete
  using (mon_role() in ('chef_ferme', 'direction'));


-- =====================================================================
--  Le stock par bâtiment, et de quoi dire s'il faut recommander.
--  La consommation moyenne se prend sur les sept derniers jours servis :
--  une moyenne sur tous les jours, trous compris, sous-estimerait la
--  vitesse à laquelle le stock descend.
-- =====================================================================

create or replace view v_stock_provende as
select l.id                                              as lot_id,
       l.nom,
       coalesce(liv.kg, 0)                               as recu_kg,
       coalesce(dis.kg, 0)                               as distribue_kg,
       coalesce(liv.kg, 0) - coalesce(dis.kg, 0)         as stock_kg,
       coalesce(conso.moyenne, 0)                        as conso_jour_kg,
       liv.derniere_livraison
from   lots l
left   join (select lot_id,
                    sum(sacs * poids_sac) as kg,
                    max(date)             as derniere_livraison
             from   livraisons_provende group by lot_id) liv on liv.lot_id = l.id
left   join (select lot_id, sum(provende_kg) as kg
             from   saisies_ferme group by lot_id) dis on dis.lot_id = l.id
left   join (select lot_id, avg(provende_kg) as moyenne
             from   saisies_ferme
             where  provende_kg > 0
               and  date > current_date - 7
             group  by lot_id) conso on conso.lot_id = l.id
where  l.actif;


-- =====================================================================
--  Stock de départ
--
--  Le stock se calcule depuis les livraisons enregistrées : tant qu'il
--  n'y en a aucune, il ressort négatif du montant déjà distribué. Saisis
--  ce qui restait en magasin au démarrage comme une livraison à cette
--  date-là, puis relance la vue. Exemple, 550 kg soit 11 sacs sur V3 au
--  1er août — à adapter à tes chiffres réels avant de décommenter :
--
--  insert into livraisons_provende (lot_id, date, sacs, aliment)
--  values ('V3', date '2026-08-01', 11, 'PN020F');
-- =====================================================================
