-- =====================================================================
--  TAMA FERME — Leader Price paie 760 Ar l'œuf
--
--  À exécuter dans Supabase > SQL Editor. Rejouable.
--
--  La facture du 18 août, F-20260818-072628, porte 1 260 œufs à 760 Ar,
--  soit 957 600 Ar. La base n'en réclamait que 948 800 : le carnet avait
--  découpé cette livraison en deux bons, 1 040 œufs en M1 et 220 en M2, et
--  seul le M1 porte un tarif négocié. Les 220 œufs sont donc partis au
--  prix de la grille, 720 Ar.
--
--  Le gérant tranche : chez Leader Price le prix est de 760 Ar. Une seule
--  ligne bouge, et l'écart est exactement celui de la facture — 220 × 40 =
--  8 800 Ar.
--
--  Ce que ce fichier NE fait PAS : il ne touche pas au calibre. L'équipe a
--  relevé du M2 sur ce bon ; la facture, elle, ne mentionne aucun calibre
--  et ne peut pas trancher. Corriger un calibre relevé sur le terrain
--  demanderait mieux qu'une déduction.
--
--  Il ne fusionne pas non plus les deux bons. La facture n'en fait qu'une
--  et le carnet deux : c'est une divergence de forme, pas de montant, et
--  une fois les prix alignés les deux disent 957 600 Ar pour la journée.
-- =====================================================================

begin;

update vente_lignes l
   set prix_unit = 760
  from ventes v
  join clients c on c.id = v.client_id
 where v.id = l.vente_id
   and c.nom = 'Leader Price'
   and l.prix_unit <> 760;

update ventes v
   set montant = s.total
  from (select vente_id, sum(oeufs * prix_unit) as total
        from   vente_lignes group by vente_id) s
 where s.vente_id = v.id
   and v.client_id = (select id from clients where nom = 'Leader Price');

commit;


-- Contrôle 1 : une seule ligne, à 760 Ar.
select l.prix_unit, count(distinct v.id) as livraisons, sum(l.oeufs) as oeufs,
       sum(l.oeufs * l.prix_unit) as encaisse
from   ventes v
join   vente_lignes l on l.vente_id = v.id
join   clients c      on c.id = v.client_id
where  c.nom = 'Leader Price'
group  by l.prix_unit
order  by l.prix_unit;

-- Contrôle 2 : la journée du 18 août doit faire 957 600 Ar, comme la
-- facture envoyée.
select v.date, sum(v.montant) as journee
from   ventes v
join   clients c on c.id = v.client_id
where  c.nom = 'Leader Price' and v.date = date '2026-08-18'
group  by v.date;
