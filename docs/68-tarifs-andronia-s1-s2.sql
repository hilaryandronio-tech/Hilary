-- =====================================================================
--  TAMA FERME — La grille d'Andronia, S1 et S2
--
--  À exécuter dans Supabase > SQL Editor. Rejouable.
--
--  Deux lignes bougent par rapport à docs/67 : le S1 passe de 670 à 650,
--  le S2 de 680 à 670. Le reste ne change pas.
--
--  Le S1 rejoint ainsi le prix de base : c'était le seul calibre qu'elle
--  payait plus cher que la grille normale. Plus aucun ne l'est.
--
--  La grille entière est réécrite, et non les deux seules lignes : un
--  fichier qui ne porte que la correction oblige à en lire trois pour
--  savoir ce que le client paie.
--
--  Les ventes déjà enregistrées gardent leur prix figé — `prix_unit` est
--  écrit sur la ligne de vente au moment de la saisie, et une grille qui
--  change ne réécrit jamais le passé. Le contrôle en fin de fichier relit
--  ce qui lui a déjà été livré, au cas où la journée serait commencée.
-- =====================================================================

insert into tarifs_clients (client_id, calibre, prix)
select c.id, t.calibre, t.prix
from   clients c
cross  join (values ('S1',  650),
                    ('S2',  670),
                    ('M1',  690),
                    ('M2',  710),
                    ('L1',  720),
                    ('L2',  730),
                    ('XL1', 750),
                    ('XL2', 800)) as t(calibre, prix)
where  c.nom = 'Andronia'
on conflict (client_id, calibre) do update set prix = excluded.prix;


-- Contrôle 1 : sa grille en face du prix de base, avec l'écart. Plus aucun
-- calibre au-dessus.
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


-- Contrôle 2 : ce qui lui a déjà été livré, et à quel prix. Une ligne
-- saisie avant ce script porte l'ancien tarif ; c'est voulu, mais si la
-- livraison du jour est partie trop tôt, c'est ici qu'on le voit.
select v.date, v.numero_commande, l.calibre, l.oeufs, l.prix_unit,
       l.oeufs * l.prix_unit as montant
from   ventes v
join   clients c      on c.id = v.client_id
join   vente_lignes l on l.vente_id = v.id
where  c.nom = 'Andronia'
order  by v.date desc, l.calibre;
