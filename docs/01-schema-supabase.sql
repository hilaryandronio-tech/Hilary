-- =====================================================================
--  TAMA FERME — Schéma de base de données (PostgreSQL / Supabase)
--  Gestion des poules pondeuses : production, ventes, recouvrement.
--
--  À exécuter dans Supabase > SQL Editor, dans l'ordre du fichier.
--  Convention : 1 alvéole = 30 œufs. Montants en ariary (entiers).
-- =====================================================================


-- =====================================================================
--  1. RÉFÉRENTIELS  (données stables, modifiées rarement)
-- =====================================================================

-- Calibres d'œufs et prix de vente de base
create table calibres (
  code        text primary key,          -- S1, S2, M1, M2, L1, L2, XL1, XL2, CASSE
  ordre       smallint not null,         -- ordre d'affichage
  prix_base   integer  not null          -- Ar par œuf
);

insert into calibres (code, ordre, prix_base) values
  ('S1',1,600), ('S2',2,620), ('M1',3,650), ('M2',4,660),
  ('L1',5,670), ('L2',6,680), ('XL1',7,700), ('XL2',8,750),
  -- pas un vrai calibre : les œufs cassés se vendent aussi, à part de la
  -- grille normale (jamais aux clients grossistes, ni en alvéoles)
  ('CASSE',9,500);


-- Bâtiments / lots de poules
create table lots (
  id                 text primary key,   -- B1, B2, B3
  nom                text not null,
  effectif_initial   integer not null check (effectif_initial > 0),
  date_mise_en_place date not null,
  en_ponte           boolean not null default false,
  actif              boolean not null default true
);


-- Clients
create table clients (
  id                   uuid primary key default gen_random_uuid(),
  nom                  text not null unique,
  type                 text not null default 'gros'
                       check (type in ('detail','gros','grande_surface','institution')),
  contact              text,
  delai_paiement_jours smallint not null default 0,
  actif                boolean not null default true
);

insert into clients (nom, type, delai_paiement_jours) values
  ('Calypso','gros',0),
  ('Leader Price','grande_surface',30),
  ('La Terrasse','gros',0),
  ('Mercy Ships','institution',30);


-- Tarifs négociés : remplacent le prix de base pour un client + un calibre
create table tarifs_clients (
  client_id uuid not null references clients(id) on delete cascade,
  calibre   text not null references calibres(code),
  prix      integer not null,
  primary key (client_id, calibre)
);

insert into tarifs_clients (client_id, calibre, prix)
select c.id, v.calibre, v.prix
from   clients c
join  (values ('Calypso','L2',800),
              ('Leader Price','M1',760),
              ('La Terrasse','L1',750),
              ('Mercy Ships','L1',800)) as v(nom, calibre, prix)
       on v.nom = c.nom;


-- Paramètres de coût — pilotent le calcul du prix de revient
create table parametres (
  cle       text primary key,
  valeur    numeric not null,
  unite     text,
  maj       timestamptz not null default now()
);

insert into parametres (cle, valeur, unite) values
  ('prix_provende_kg', 0, 'Ar/kg'),         -- À RENSEIGNER
  ('cout_poulette',    0, 'Ar/tête'),       -- À RENSEIGNER : achat + élevage
  ('duree_ponte_sem', 52, 'semaines'),
  ('objectif_taux_ponte', 90, '%'),
  ('seuil_relance_jours', 30, 'jours');


-- =====================================================================
--  2. UTILISATEURS ET RÔLES
--  Supabase gère l'authentification dans auth.users ; on y rattache
--  un profil applicatif qui porte le rôle.
-- =====================================================================

create type role_app as enum ('chef_ferme','magasiniere','point_vente','direction');

create table profils (
  id       uuid primary key references auth.users(id) on delete cascade,
  nom      text not null,
  role     role_app not null,
  lot_id   text references lots(id),      -- pour un chef affecté à un bâtiment
  actif    boolean not null default true
);

-- Raccourci utilisé par toutes les règles de sécurité
create or replace function mon_role() returns role_app
language sql stable security definer as $$
  select role from profils where id = auth.uid()
$$;


-- =====================================================================
--  3. SAISIES QUOTIDIENNES
-- =====================================================================

-- --- Ferme : provende et mortalité, par bâtiment ---------------------
create table saisies_ferme (
  id           uuid primary key default gen_random_uuid(),
  date         date not null default current_date,
  lot_id       text not null references lots(id),
  provende_kg  numeric(8,2) not null default 0 check (provende_kg >= 0),
  mortalite    integer      not null default 0 check (mortalite >= 0),
  auteur       uuid references profils(id),
  created_at   timestamptz  not null default now(),
  unique (date, lot_id)                    -- empêche la double saisie
);


-- --- Charges ---------------------------------------------------------
create table charges (
  id         uuid primary key default gen_random_uuid(),
  date       date not null default current_date,
  categorie  text not null,
  montant    integer not null check (montant > 0),
  origine    text not null default 'ferme' check (origine in ('ferme','point_vente')),
  note       text,
  auteur     uuid references profils(id),
  created_at timestamptz not null default now()
);

-- Les 16 postes utilisés à la ferme, pour alimenter la liste de saisie
create table categories_charges (
  libelle text primary key,
  ordre   smallint not null,
  origine text not null default 'ferme'
);

insert into categories_charges (libelle, ordre) values
  ('Produit véto',1), ('Connexion',2), ('Sakafo',3), ('Nettoyage',4),
  ('Salaire',5), ('Curbu Hilary',6), ('Carburant',7), ('Voiture',8),
  ('Frais',9), ('Alvéoles',10), ('Papier film',11), ('Étiquette',12),
  ('Loyer',13), ('Dératisation',14), ('Remb. machine',15), ('Autres',16);


-- --- Ponte : en-tête + détail par calibre ----------------------------
create table pontes (
  id            uuid primary key default gen_random_uuid(),
  date          date not null default current_date,
  lot_id        text references lots(id),   -- null = collecte non ventilée
  oeufs_casses  integer not null default 0 check (oeufs_casses >= 0),
  oeufs_sales   integer not null default 0 check (oeufs_sales  >= 0),
  auteur        uuid references profils(id),
  created_at    timestamptz not null default now(),
  unique (date, lot_id)
);

create table ponte_lignes (
  ponte_id  uuid not null references pontes(id) on delete cascade,
  calibre   text not null references calibres(code),
  oeufs     integer not null check (oeufs >= 0), -- à l'unité : une collecte de 5 alvéoles vaut 150, une collecte au détail de 10 œufs vaut 10
  primary key (ponte_id, calibre)
);


-- --- Ventes : en-tête + détail par calibre ---------------------------
--  canal 'detail'  : caisse du point de vente — soit un montant global
--                    (recette du jour / à crédit), soit détaillée en lignes
--                    quand le client achète à l'unité (pas un multiple de 30)
--  canal 'client'  : commande livrée aux 4 clients grossistes, par alvéoles
--                    complètes, détaillée en lignes
create table ventes (
  id          uuid primary key default gen_random_uuid(),
  date        date not null default current_date,
  canal       text not null check (canal in ('detail','client')),
  client_id   uuid references clients(id),
  montant     integer not null check (montant >= 0),
  credit      boolean not null default false,
  solde       boolean not null default false,
  date_solde  date,
  auteur      uuid references profils(id),
  created_at  timestamptz not null default now(),
  -- une vente à crédit soldée doit porter sa date d'encaissement
  constraint solde_coherent check (solde = false or date_solde is not null),
  -- une commande client doit désigner un client
  constraint client_requis check (canal <> 'client' or client_id is not null)
);

create table vente_lignes (
  vente_id  uuid not null references ventes(id) on delete cascade,
  calibre   text not null references calibres(code),
  oeufs     integer not null check (oeufs > 0), -- à l'unité : une vente client de 3 alvéoles vaut 90, une vente détail de 10 œufs vaut 10
  prix_unit integer not null,               -- prix figé au moment de la vente
  primary key (vente_id, calibre)
);

create index on saisies_ferme (date);
create index on charges (date);
create index on pontes (date);
create index on ventes (date);
create index on ventes (credit, solde) where credit and not solde;


-- =====================================================================
--  4. VUES DE CALCUL
--  Toute la logique métier vit ici : l'application ne recalcule rien.
-- =====================================================================

-- Effectif vivant par lot = initial moins le cumul de mortalité
create view v_effectif as
select l.id                 as lot_id,
       l.nom,
       l.en_ponte,
       l.effectif_initial,
       l.effectif_initial - coalesce(sum(s.mortalite), 0) as vivant,
       -- âge en semaines depuis la mise en place
       floor((current_date - l.date_mise_en_place) / 7.0)::int as age_semaines
from   lots l
left   join saisies_ferme s on s.lot_id = l.id
where  l.actif
group  by l.id;


-- Synthèse journalière : production, valeur, trésorerie
create view v_journalier as
with jours as (
  select date from saisies_ferme
  union select date from pontes
  union select date from ventes
  union select date from charges
),
cheptel as (
  select sum(vivant)                                  as total,
         sum(vivant) filter (where en_ponte)          as en_ponte
  from   v_effectif
)
select j.date,
       -- production
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
       -- élevage
       coalesce((select sum(provende_kg) from saisies_ferme where date = j.date), 0) as provende_kg,
       coalesce((select sum(mortalite)   from saisies_ferme where date = j.date), 0) as mortalite,
       -- argent
       coalesce((select sum(montant) from ventes
                 where date = j.date and not credit), 0)
       + coalesce((select sum(montant) from ventes
                 where date_solde = j.date), 0)                  as encaisse,
       coalesce((select sum(montant) from ventes
                 where date = j.date and credit), 0)             as livre_credit,
       coalesce((select sum(montant) from charges where date = j.date), 0) as charges,
       -- rendement
       (select en_ponte from cheptel)                            as poules_en_ponte
from   jours j;


-- Taux de ponte du jour, en pourcentage
create view v_taux_ponte as
select date,
       oeufs,
       poules_en_ponte,
       case when poules_en_ponte > 0
            then round(oeufs::numeric / poules_en_ponte * 100, 1)
            else 0 end as taux_ponte
from   v_journalier;


-- Créances en cours, avec ancienneté
create view v_creances as
select v.id,
       v.date,
       coalesce(c.nom, 'Point de vente')          as client,
       v.montant,
       current_date - v.date                      as anciennete_jours,
       case when current_date - v.date > 60 then 'critique'
            when current_date - v.date > 30 then 'a_relancer'
            else 'normal' end                     as statut
from   ventes v
left   join clients c on c.id = v.client_id
where  v.credit and not v.solde
order  by v.date;


-- Compte de résultat mensuel — le prix de revient inclut la provende
-- et l'amortissement des poulettes, sans quoi le bénéfice est faux.
create view v_bilan_mensuel as
with p as (
  select (select valeur from parametres where cle = 'prix_provende_kg') as prix_kg,
         (select valeur from parametres where cle = 'cout_poulette')    as cout_poulette,
         (select valeur from parametres where cle = 'duree_ponte_sem')  as duree_sem,
         (select sum(vivant) filter (where en_ponte) from v_effectif)   as en_ponte
),
m as (
  select date_trunc('month', date)::date as mois,
         sum(oeufs)                      as oeufs,
         sum(provende_kg)                as provende_kg,
         sum(charges)                    as charges_saisies,
         count(*)                        as jours
  from   v_journalier
  group  by 1
),
ca as (
  select date_trunc('month', date)::date as mois, sum(montant) as ca
  from   ventes group by 1
)
select m.mois,
       coalesce(ca.ca, 0)                                    as chiffre_affaires,
       m.oeufs,
       (m.provende_kg * p.prix_kg)::bigint                   as cout_provende,
       (p.cout_poulette / (p.duree_sem * 7) * p.en_ponte * m.jours)::bigint as amortissement,
       m.charges_saisies,
       (m.provende_kg * p.prix_kg
        + p.cout_poulette / (p.duree_sem * 7) * p.en_ponte * m.jours
        + m.charges_saisies)::bigint                         as charges_totales,
       (coalesce(ca.ca, 0)
        - (m.provende_kg * p.prix_kg
           + p.cout_poulette / (p.duree_sem * 7) * p.en_ponte * m.jours
           + m.charges_saisies))::bigint                     as benefice,
       case when m.oeufs > 0 then round(
         (m.provende_kg * p.prix_kg
          + p.cout_poulette / (p.duree_sem * 7) * p.en_ponte * m.jours
          + m.charges_saisies) / m.oeufs, 1) end             as prix_revient_oeuf
from   m
left   join ca on ca.mois = m.mois
cross  join p
order  by m.mois desc;


-- =====================================================================
--  5. SÉCURITÉ (Row Level Security)
--  Chacun n'écrit que sur son périmètre ; la direction voit tout.
-- =====================================================================

alter table saisies_ferme enable row level security;
alter table pontes        enable row level security;
alter table ponte_lignes  enable row level security;
alter table ventes        enable row level security;
alter table vente_lignes  enable row level security;
alter table charges       enable row level security;
alter table profils       enable row level security;

-- Lecture : tout utilisateur connecté et actif
create policy lecture_saisies on saisies_ferme for select using (auth.uid() is not null);
create policy lecture_pontes  on pontes        for select using (auth.uid() is not null);
create policy lecture_pl      on ponte_lignes  for select using (auth.uid() is not null);
create policy lecture_ventes  on ventes        for select using (auth.uid() is not null);
create policy lecture_vl      on vente_lignes  for select using (auth.uid() is not null);
create policy lecture_charges on charges       for select using (auth.uid() is not null);

-- Écriture : réservée au rôle concerné
create policy saisie_ferme on saisies_ferme for insert
  with check (mon_role() in ('chef_ferme','direction'));

create policy saisie_ponte on pontes for insert
  with check (mon_role() in ('magasiniere','direction'));
create policy saisie_ponte_l on ponte_lignes for insert
  with check (mon_role() in ('magasiniere','direction'));

create policy saisie_vente on ventes for insert
  with check (mon_role() in ('point_vente','direction'));
create policy saisie_vente_l on vente_lignes for insert
  with check (mon_role() in ('point_vente','direction'));

create policy saisie_charge on charges for insert
  with check (mon_role() in ('chef_ferme','point_vente','direction'));

-- Encaissement d'une créance : point de vente et direction
create policy solder_creance on ventes for update
  using  (mon_role() in ('point_vente','direction'))
  with check (mon_role() in ('point_vente','direction'));

-- Chacun lit son propre profil ; la direction lit tous les profils
create policy mon_profil on profils for select
  using (id = auth.uid() or mon_role() = 'direction');

-- Les référentiels et paramètres ne sont modifiables que par la direction
alter table parametres     enable row level security;
alter table tarifs_clients enable row level security;
alter table calibres       enable row level security;
create policy lire_param on parametres for select using (auth.uid() is not null);
create policy ecrire_param on parametres for all
  using (mon_role() = 'direction') with check (mon_role() = 'direction');
create policy lire_tarifs on tarifs_clients for select using (auth.uid() is not null);
create policy ecrire_tarifs on tarifs_clients for all
  using (mon_role() = 'direction') with check (mon_role() = 'direction');
create policy lire_calibres on calibres for select using (auth.uid() is not null);
create policy ecrire_calibres on calibres for all
  using (mon_role() = 'direction') with check (mon_role() = 'direction');


-- =====================================================================
--  6. DONNÉES DE DÉPART — à remplacer par la structure réelle
-- =====================================================================

insert into lots (id, nom, effectif_initial, date_mise_en_place, en_ponte) values
  ('V1','Bâtiment 1', 3000, current_date - 294, true),
  ('V2','Bâtiment 2', 3000, current_date - 217, true),
  ('V3','Bâtiment 3', 3000, current_date -  84, false);

-- Rappel : renseigner prix_provende_kg et cout_poulette dans parametres,
-- sinon le bénéfice et le prix de revient sont faux.
