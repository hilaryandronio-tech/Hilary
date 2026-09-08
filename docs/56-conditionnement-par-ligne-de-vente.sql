-- =====================================================================
--  TAMA FERME — Deux barquettes sur une même facture
--
--  À exécuter dans Supabase > SQL Editor AVANT de déployer la version de
--  l'application qui accompagne ce fichier. Rejouable.
--
--  Relevé sur la facture Leader Price du 6 août 2026, bon 092-08-2026 :
--
--    Oeufs x6   Code M 67217   50 barquettes   4 560 Ar   228 000
--    Oeufs x12  Code M 67218   80 barquettes   9 120 Ar   729 600
--                                              Total      957 600
--
--  Les deux lignes sont du M1 à 760 Ar l'œuf — le tarif négocié du client.
--  Elles ne diffèrent que par l'emballage. Or `vente_lignes` a pour clé
--  (vente_id, calibre) : une livraison ne peut porter qu'une ligne par
--  calibre, et la facture divisait le tout par le conditionnement unique
--  du client. Le total serait juste, la facture fausse.
--
--  Le conditionnement descend donc sur la ligne de vente, et entre dans
--  la clé. C'est aussi plus honnête pour le passé : jusqu'ici une facture
--  réimprimée reprenait le conditionnement du jour, pas celui de la
--  livraison. Désormais chaque ligne garde le sien.
--
--  `clients.conditionnements` liste les emballages qu'un client utilise
--  vraiment — Leader Price prend de la x6 et de la x12. La colonne
--  `conditionnement` au singulier reste, elle donne l'emballage par
--  défaut de tous les autres.
--
--  Le Code M n'est pas ici : 67217 et 67218 désignent l'emballage, pas le
--  client, et ce sont des références de la ferme. Ils vivent dans
--  src/data/ferme.js, à côté du 67218 qui y était déjà.
--
--  ATTENTION À L'ORDRE. Entre ce fichier et le déploiement, la version en
--  ligne de l'application écrit encore ses lignes de vente sur l'ancienne
--  clé et sera refusée. Passe le SQL, puis recharge l'application tout de
--  suite — Vercel reconstruit en deux minutes.
-- =====================================================================


-- 1. Les emballages qu'un client utilise, quand il en a plusieurs.
alter table clients
  add column if not exists conditionnements smallint[];

update clients set conditionnements = '{6,12}' where nom = 'Leader Price';


-- 2. Le conditionnement de chaque ligne de vente.
alter table vente_lignes
  add column if not exists conditionnement smallint not null default 1
    check (conditionnement > 0);


-- 3. Les lignes déjà en base prennent le conditionnement que la facture
--    leur appliquait jusqu'ici : celui du client pour une livraison, l'œuf
--    à l'unité pour le comptoir.
update vente_lignes l
   set conditionnement = coalesce(c.conditionnement, 30)
  from ventes v
  join clients c on c.id = v.client_id
 where v.id = l.vente_id
   and v.canal = 'client';

update vente_lignes l
   set conditionnement = 1
  from ventes v
 where v.id = l.vente_id
   and v.canal = 'detail';


-- 4. La clé primaire s'ouvre au conditionnement. Sans ça, deux barquettes
--    du même calibre restent impossibles.
alter table vente_lignes drop constraint if exists vente_lignes_pkey;
alter table vente_lignes
  add constraint vente_lignes_pkey primary key (vente_id, calibre, conditionnement);


-- =====================================================================
--  Contrôle 1 : Leader Price porte bien ses deux emballages.
-- =====================================================================

select nom, conditionnement as par_defaut, conditionnements as emballages
from   clients
where  conditionnements is not null or nom = 'Leader Price';


-- =====================================================================
--  Contrôle 2 : la clé primaire compte trois colonnes.
-- =====================================================================

select a.attname as colonne, k.ordinalite
from   pg_constraint c
join   lateral unnest(c.conkey) with ordinality as k(attnum, ordinalite) on true
join   pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum
where  c.conrelid = 'vente_lignes'::regclass and c.contype = 'p'
order  by k.ordinalite;


-- =====================================================================
--  Contrôle 3 : la répartition des conditionnements après reprise. Aucune
--  ligne ne doit être restée à un emballage qui ne correspond à rien.
-- =====================================================================

select v.canal, l.conditionnement, count(*) as lignes, sum(l.oeufs) as oeufs
from   vente_lignes l
join   ventes v on v.id = l.vente_id
group  by v.canal, l.conditionnement
order  by v.canal, l.conditionnement;
