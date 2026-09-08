-- =====================================================================
--  TAMA FERME — Chez Leader Price, tout est du M1
--
--  À exécuter dans Supabase > SQL Editor. Rejouable.
--
--  Le gérant confirme : Leader Price paie 760 Ar le M1, et ses barquettes
--  de six comme de douze ne contiennent que du M1. Le tarif négocié n'a
--  donc rien à couvrir de plus — c'est le calibre relevé au carnet qui est
--  en cause.
--
--  Une seule ligne : les 220 œufs du 18 août, bon 275-08-2026, notés M2.
--  docs/58 leur avait déjà remis le prix de 760 Ar sans toucher au
--  calibre, faute de preuve. La preuve est arrivée.
--
--  Le montant ne bouge pas — les deux calibres sont désormais au même
--  prix. Ce qui bouge, c'est le stock : 220 œufs quittent la sortie M2
--  pour la sortie M1, et l'écran Ventes par jour les montrera sur la bonne
--  ligne.
--
--  Le garde-fou `not exists` évite la collision si la même vente portait
--  déjà du M1 dans le même emballage : depuis docs/56 la clé primaire est
--  (vente_id, calibre, conditionnement), et deux lignes identiques s'y
--  refuseraient. Aucun cas aujourd'hui, mais le fichier est rejouable.
-- =====================================================================

begin;

update vente_lignes l
   set calibre = 'M1'
  from ventes v
  join clients c on c.id = v.client_id
 where v.id = l.vente_id
   and c.nom = 'Leader Price'
   and l.calibre <> 'M1'
   and not exists (
     select 1 from vente_lignes m
     where m.vente_id = l.vente_id
       and m.calibre = 'M1'
       and m.conditionnement = l.conditionnement
   );

update ventes v
   set montant = s.total
  from (select vente_id, sum(oeufs * prix_unit) as total
        from   vente_lignes group by vente_id) s
 where s.vente_id = v.id
   and v.client_id = (select id from clients where nom = 'Leader Price');

commit;


-- Contrôle : une seule ligne, M1 à 760 Ar, sur toutes les livraisons
-- Leader Price. 4 800 œufs, 3 648 000 Ar.
select l.calibre, l.prix_unit,
       count(distinct v.id) as livraisons,
       sum(l.oeufs)         as oeufs,
       sum(l.oeufs * l.prix_unit) as encaissable
from   ventes v
join   vente_lignes l on l.vente_id = v.id
join   clients c      on c.id = v.client_id
where  c.nom = 'Leader Price'
group  by l.calibre, l.prix_unit
order  by l.calibre, l.prix_unit;
