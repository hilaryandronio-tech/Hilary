-- =====================================================================
--  TAMA FERME — Suivi d'élevage : vaccinations et traitements
--
--  À exécuter dans Supabase > SQL Editor AVANT de déployer la version de
--  l'application qui accompagne ce fichier. Le script est rejouable.
--
--  Repris de la fiche Farmshop / Shop ALEXIA de la 3ème vague : mise en
--  ferme le 2026-06-09, 3 300 sujets. Les dates y sont posées par le
--  fournisseur, elles ne se recalculent pas depuis l'âge — 17 semaines
--  après le 9 juin tombe le 6 octobre, la fiche dit du 29 septembre au
--  5 octobre. On saisit donc ses dates telles quelles.
--
--  Chaque geste a une fenêtre, pas une date unique : l'anticoccidien
--  s'étale sur trois jours, le vermifuge sur un.
--
--  V1 et V2 ont terminé leur programme et n'en reçoivent aucun.
-- =====================================================================

create table if not exists interventions (
  id              uuid primary key default gen_random_uuid(),
  lot_id          text not null references lots(id) on delete cascade,
  type            text not null check (type in ('vaccination', 'traitement')),
  libelle         text not null,
  age             text,            -- tel qu'écrit sur la fiche : « 18 andro », « 6 herinandro »
  date_prevue     date not null,   -- début de la fenêtre
  date_fin_prevue date,            -- fin de la fenêtre ; null si un seul jour
  date_realisee   date,            -- null tant que ce n'est pas fait
  produit         text,
  dosage          text,
  technicien      text,
  notes           text,
  auteur          uuid references profils(id),
  created_at      timestamptz not null default now(),
  unique (lot_id, type, libelle, date_prevue)
);

create index if not exists interventions_lot on interventions (lot_id);
create index if not exists interventions_a_faire on interventions (date_prevue)
  where date_realisee is null;


-- =====================================================================
--  Sécurité — le chef de ferme note, la direction voit et corrige.
-- =====================================================================

alter table interventions enable row level security;

drop   policy if exists lire_interventions on interventions;
create policy lire_interventions on interventions for select
  using (auth.uid() is not null);

drop   policy if exists saisir_intervention on interventions;
create policy saisir_intervention on interventions for insert
  with check (mon_role() in ('chef_ferme', 'direction'));

drop   policy if exists corriger_intervention on interventions;
create policy corriger_intervention on interventions for update
  using      (mon_role() in ('chef_ferme', 'direction'))
  with check (mon_role() in ('chef_ferme', 'direction'));

drop   policy if exists annuler_intervention on interventions;
create policy annuler_intervention on interventions for delete
  using (mon_role() in ('chef_ferme', 'direction'));


-- =====================================================================
--  La mise en ferme de la 3ème vague, sans laquelle l'âge en semaines
--  affiché par v_effectif est faux.
-- =====================================================================

update lots set date_mise_en_place = date '2026-06-09' where id = 'V3';


-- =====================================================================
--  Le calendrier de la 3ème vague, fiche Farmshop
-- =====================================================================

insert into interventions (lot_id, type, libelle, age, date_prevue, date_fin_prevue, technicien) values
  ('V3', 'vaccination', 'Lasota + IBH120', '18 andro',      date '2026-06-26', null,              'Shop Alexia'),
  ('V3', 'vaccination', 'POX',             '30 andro',      date '2026-07-09', date '2026-07-13', 'Shop Alexia'),
  ('V3', 'vaccination', 'IB-ND',           '6 herinandro',  date '2026-07-16', date '2026-07-21', 'Shop Alexia'),
  ('V3', 'vaccination', 'Fowl Cholera',    '7 herinandro',  date '2026-07-24', date '2026-07-29', 'Shop Alexia'),
  ('V3', 'vaccination', 'Fowl Cholera — rappel', '11 herinandro', date '2026-08-24', date '2026-08-30', 'Shop Alexia'),
  ('V3', 'vaccination', 'IB-ND-EDS',       '17 semaines',   date '2026-09-29', date '2026-10-05', 'Shop Alexia')
on conflict (lot_id, type, libelle, date_prevue) do nothing;

insert into interventions (lot_id, type, libelle, age, date_prevue, date_fin_prevue) values
  ('V3', 'traitement', 'Débecquage',    '1 semaine',   date '2026-06-19', null),
  ('V3', 'traitement', 'Anticoccidien', '4 semaines',  date '2026-07-05', date '2026-07-07'),
  ('V3', 'traitement', 'Anticoccidien', '6 semaines',  date '2026-07-15', date '2026-07-17'),
  ('V3', 'traitement', 'Vermifuge',     '8 semaines',  date '2026-08-09', null),
  ('V3', 'traitement', 'Anticoccidien', '9 semaines',  date '2026-08-09', date '2026-08-11'),
  ('V3', 'traitement', 'Anticoccidien', '12 semaines', date '2026-09-04', date '2026-09-06'),
  ('V3', 'traitement', 'Vermifuge',     '15 semaines', date '2026-09-20', null),
  ('V3', 'traitement', 'Vermifuge',     '19 semaines', date '2026-10-19', null)
on conflict (lot_id, type, libelle, date_prevue) do nothing;


-- =====================================================================
--  Les consignes permanentes du Shop (FANAMARIHANA de la fiche) ne sont
--  pas stockées ici : `parametres.valeur` est de type numeric, il porte
--  des prix. Elles vivent dans la constante CONSIGNES de
--  src/screens/Suivi.jsx, qui les affiche sous le calendrier :
--    - vitamine avant, pendant et après une vaccination et le débecquage ;
--    - débecquage à 7-10 jours, ou vers 10 semaines ;
--    - poules en ponte : vermifuge tous les 2 mois.
-- =====================================================================

