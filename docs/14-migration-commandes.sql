-- =====================================================================
--  TAMA FERME — Agenda des commandes
--
--  À exécuter dans Supabase > SQL Editor AVANT de déployer la version de
--  l'application qui accompagne ce fichier. Rejouable.
--
--  Les commandes arrivent par Facebook et WhatsApp, pour une livraison à
--  venir. C'est une notion que l'application n'avait pas : `ventes`
--  enregistre ce qui est déjà sorti, jamais ce qui est promis.
--
--  Une commande n'est donc pas une vente, et ne compte ni au chiffre
--  d'affaires ni au stock tant qu'elle n'est pas livrée. Le jour de la
--  livraison, l'application crée la vente correspondante et la rattache à
--  la commande : une seule saisie, une seule source de vérité pour le CA.
-- =====================================================================

create table if not exists commandes (
  id             uuid primary key default gen_random_uuid(),
  numero         text,                    -- la référence donnée au client, libre
  client_id      uuid references clients(id) on delete restrict,
  canal_prise    text not null default 'autre'
                 check (canal_prise in ('facebook', 'whatsapp', 'telephone', 'sur_place', 'autre')),
  date_prise     date not null default current_date,
  date_livraison date not null,
  statut         text not null default 'en_attente'
                 check (statut in ('en_attente', 'livree', 'annulee')),
  -- La vente créée au moment de la livraison. `set null` et non `cascade` :
  -- supprimer une vente ne doit pas effacer la commande qui l'a produite.
  vente_id       uuid references ventes(id) on delete set null,
  note           text,
  auteur         uuid references profils(id),
  created_at     timestamptz not null default now()
);

create index if not exists commandes_livraison on commandes (date_livraison)
  where statut = 'en_attente';
create index if not exists commandes_client on commandes (client_id);

create table if not exists commande_lignes (
  commande_id uuid not null references commandes(id) on delete cascade,
  calibre     text not null references calibres(code),
  oeufs       integer not null check (oeufs > 0),
  primary key (commande_id, calibre)
);


-- =====================================================================
--  Sécurité — le point de vente prend les commandes, la direction voit
--  et corrige. Les upsert de la file d'attente exigent la policy UPDATE
--  même sans conflit apparent (voir migration 04).
-- =====================================================================

alter table commandes       enable row level security;
alter table commande_lignes enable row level security;

drop   policy if exists lire_commandes on commandes;
create policy lire_commandes on commandes for select
  using (auth.uid() is not null);

drop   policy if exists saisir_commande on commandes;
create policy saisir_commande on commandes for insert
  with check (mon_role() in ('point_vente', 'direction'));

drop   policy if exists corriger_commande on commandes;
create policy corriger_commande on commandes for update
  using      (mon_role() in ('point_vente', 'direction'))
  with check (mon_role() in ('point_vente', 'direction'));

drop   policy if exists annuler_commande on commandes;
create policy annuler_commande on commandes for delete
  using (mon_role() in ('point_vente', 'direction'));

drop   policy if exists lire_commande_lignes on commande_lignes;
create policy lire_commande_lignes on commande_lignes for select
  using (auth.uid() is not null);

drop   policy if exists saisir_commande_ligne on commande_lignes;
create policy saisir_commande_ligne on commande_lignes for insert
  with check (mon_role() in ('point_vente', 'direction'));

drop   policy if exists corriger_commande_ligne on commande_lignes;
create policy corriger_commande_ligne on commande_lignes for update
  using      (mon_role() in ('point_vente', 'direction'))
  with check (mon_role() in ('point_vente', 'direction'));

drop   policy if exists annuler_commande_ligne on commande_lignes;
create policy annuler_commande_ligne on commande_lignes for delete
  using (mon_role() in ('point_vente', 'direction'));
