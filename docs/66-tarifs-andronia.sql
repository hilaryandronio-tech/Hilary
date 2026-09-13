-- =====================================================================
--  TAMA FERME — La grille négociée d'Andronia
--
--  À exécuter dans Supabase > SQL Editor. Rejouable.
--
--  Un tarif négocié remplace le prix de base, calibre par calibre, pour ce
--  client seul (voir docs/19). La caisse l'applique dès la sélection du
--  client, et la facture le reprend.
--
--  Les cassés ne sont pas dans la grille : ils restent au prix de base.
-- =====================================================================

insert into tarifs_clients (client_id, calibre, prix)
select c.id, t.calibre, t.prix
from   clients c
cross  join (values ('S1',  670),
                    ('S2',  680),
                    ('M1',  690),
                    ('M2',  710),
                    ('L1',  730),
                    ('L2',  740),
                    ('XL1', 750),   -- « XL » sur le message : c'est le seul XL simple
                    ('XL2', 800)) as t(calibre, prix)
where  c.nom = 'Andronia'
on conflict (client_id, calibre) do update set prix = excluded.prix;


-- =====================================================================
--  Contrôle : sa grille en face du prix de base, avec l'écart.
--
--  Sept calibres sur huit sont au prix de base ou en dessous. Le S1 est
--  au-dessus : 670 contre 650. Ce n'est pas une remise uniforme, et ça
--  mérite d'être relu avant la première livraison.
-- =====================================================================

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
