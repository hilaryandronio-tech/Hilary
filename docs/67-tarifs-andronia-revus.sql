-- =====================================================================
--  TAMA FERME — La grille d'Andronia, revue
--
--  À exécuter dans Supabase > SQL Editor. Rejouable.
--
--  Deux lignes bougent par rapport à docs/66, posée la veille de sa
--  première livraison : le L1 passe de 730 à 720, le L2 de 740 à 730. Le
--  reste ne change pas.
--
--  La grille entière est réécrite, et non les deux seules lignes : un
--  fichier qui ne porte que la correction oblige à lire les deux pour
--  savoir ce que le client paie, et c'est ainsi qu'on finit par appliquer
--  un prix qui n'a jamais existé.
--
--  Les ventes déjà enregistrées gardent leur prix figé — `prix_unit` est
--  écrit sur la ligne de vente. Aucune livraison n'a encore eu lieu de
--  toute façon.
-- =====================================================================

insert into tarifs_clients (client_id, calibre, prix)
select c.id, t.calibre, t.prix
from   clients c
cross  join (values ('S1',  670),
                    ('S2',  680),
                    ('M1',  690),
                    ('M2',  710),
                    ('L1',  720),
                    ('L2',  730),
                    ('XL1', 750),
                    ('XL2', 800)) as t(calibre, prix)
where  c.nom = 'Andronia'
on conflict (client_id, calibre) do update set prix = excluded.prix;


-- Contrôle : sa grille en face du prix de base, avec l'écart. Le S1 reste
-- le seul calibre au-dessus du prix de base — c'est voulu.
select cal.ordre,
       t.calibre,
       t.prix       as andronia,
       cal.prix_base,
       t.prix - cal.prix_base as ecart
from   tarifs_clients t
join   clients  c   on c.id = t.client_id
join   calibres cal on cal.code = t.calibre
where  c.nom = 'Andronia'
order  by cal.ordre;
