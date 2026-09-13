-- =====================================================================
--  TAMA FERME — Andronia, l'annexe
--
--  À exécuter dans Supabase > SQL Editor. Rejouable.
--
--  Un point de vente annexe de la ferme, en face de Kibo Anjoma. Elle paie
--  comptant : aucun délai, rien à recouvrer.
--
--  Facturée à l'œuf, comme tout le monde sauf Leader Price (docs/62) —
--  l'alvéole de trente qu'elle emploie est un emballage prêté, pas une
--  unité de vente. Ce qu'il faut en suivre est traité à part.
-- =====================================================================

insert into clients (nom, type, delai_paiement_jours, actif,
                     adresse, telephone_fac, conditionnement)
values ('Andronia', 'gros', 0, true,
        'En face Kibo, Anjoma', '+261 34 55 725 17', 1)
on conflict (nom) do update set
  type                 = excluded.type,
  delai_paiement_jours = excluded.delai_paiement_jours,
  actif                = excluded.actif,
  adresse              = excluded.adresse,
  telephone_fac        = excluded.telephone_fac,
  conditionnement      = excluded.conditionnement;

-- Elle achète au prix de base de chaque calibre : aucun tarif négocié n'est
-- posé. S'il en faut un, il se pose ensuite (voir docs/19).


-- =====================================================================
--  Les alvéoles prêtées
--
--  Andronia emporte les œufs dans nos alvéoles de trente et les rapporte.
--  Ce n'est ni une vente ni un emballage facturé : c'est du matériel de la
--  ferme qui dort chez quelqu'un d'autre. Il coûte — « Alvéoles » est une
--  ligne de charges — et rien ne disait combien il en manquait.
--
--  Un mouvement par passage : ce qui part, ce qui revient. Le solde s'en
--  déduit, il ne se saisit pas — un compteur qu'on corrige à la main finit
--  toujours par mentir sur la façon dont il en est arrivé là.
--
--  Le drapeau sur la fiche client décide qui voit les champs à la caisse :
--  les cinquante-neuf autres clients repartent avec leurs propres alvéoles
--  et n'ont rien à compter.
-- =====================================================================

alter table clients
  add column if not exists alveoles_pretees boolean not null default false;

update clients set alveoles_pretees = true where nom = 'Andronia';

create table if not exists mouvements_alveoles (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references clients(id) on delete cascade,
  date       date not null,
  sorties    integer not null default 0 check (sorties >= 0),
  rendues    integer not null default 0 check (rendues >= 0),
  auteur     uuid references profils(id),
  created_at timestamptz not null default now(),
  -- Un mouvement vide n'est pas un mouvement.
  constraint mouvement_non_vide check (sorties > 0 or rendues > 0)
);

create index if not exists mouvements_alveoles_client
  on mouvements_alveoles (client_id, date desc);

alter table mouvements_alveoles enable row level security;

drop   policy if exists lire_alveoles on mouvements_alveoles;
create policy lire_alveoles on mouvements_alveoles for select
  using (auth.uid() is not null);

-- Le point de vente compte les alvéoles : c'est lui qui les voit passer.
drop   policy if exists noter_alveoles on mouvements_alveoles;
create policy noter_alveoles on mouvements_alveoles for insert
  with check (mon_role() in ('point_vente', 'direction'));

drop   policy if exists corriger_alveoles on mouvements_alveoles;
create policy corriger_alveoles on mouvements_alveoles for update
  using      (mon_role() in ('point_vente', 'direction'))
  with check (mon_role() in ('point_vente', 'direction'));

-- Effacer un mouvement réécrit le solde : ça reste à la direction.
drop   policy if exists annuler_alveoles on mouvements_alveoles;
create policy annuler_alveoles on mouvements_alveoles for delete
  using (mon_role() = 'direction');


-- =====================================================================
--  Le solde par client : sorties moins rendues.
-- =====================================================================

create or replace view v_alveoles_client as
select c.id                                                      as client_id,
       c.nom,
       coalesce(sum(m.sorties), 0)::bigint                        as sorties,
       coalesce(sum(m.rendues), 0)::bigint                        as rendues,
       coalesce(sum(m.sorties), 0)::bigint
         - coalesce(sum(m.rendues), 0)::bigint                    as chez_le_client,
       max(m.date)                                                as dernier_mouvement
from   clients c
left   join mouvements_alveoles m on m.client_id = c.id
where  c.alveoles_pretees
group  by c.id, c.nom;


-- =====================================================================
--  Contrôles
-- =====================================================================

-- La fiche, telle qu'elle sera lue par la caisse et la facture.
select nom, type, adresse, telephone_fac, conditionnement,
       delai_paiement_jours, alveoles_pretees, actif
from   clients
where  nom = 'Andronia';

-- Le compteur, vide tant que rien n'est sorti.
select * from v_alveoles_client;
