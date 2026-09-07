-- =====================================================================
--  TAMA FERME — Le calibre de la livraison La braise du 20 août
--
--  À exécuter dans Supabase > SQL Editor. Rejouable.
--
--  La facture F-20260820-075241, bon 323-08-2026, porte 150 œufs à 800 Ar
--  — le tarif L2 négocié de La braise (docs/19). Le carnet avait noté du
--  M2, calibre sans tarif négocié : la vente était donc entrée au prix de
--  grille, 720 Ar, pour 108 000 Ar. Le gérant confirme que c'était du L2.
--
--  Corriger le calibre suffit : le prix et le montant suivent. La créance
--  passe de 108 000 à 120 000 Ar, ce que le client a réellement en main.
--
--  Le stock bouge aussi, et c'est voulu : 150 œufs quittent le M2 pour le
--  L2. La vue du stock comptait jusqu'ici une sortie sur le mauvais
--  calibre.
--
--  Rejouable : la première requête ne trouve plus de ligne M2 à la
--  seconde exécution, la seconde recalcule le même montant.
-- =====================================================================

begin;

update vente_lignes l
   set calibre = 'L2', prix_unit = 800
  from ventes v
 where v.id = l.vente_id
   and v.numero_commande = '323-08-2026'
   and l.calibre = 'M2';

-- Le montant de l'entête se refait depuis ses lignes, comme dans docs/18.
update ventes v
   set montant = s.total
  from (select vente_id, sum(oeufs * prix_unit) as total
        from   vente_lignes group by vente_id) s
 where s.vente_id = v.id
   and v.numero_commande = '323-08-2026';

commit;


-- Contrôle : L2, 150 œufs, 800 Ar, 120 000 Ar — la facture envoyée.
select v.date, v.numero_facture, l.calibre, l.oeufs, l.prix_unit, v.montant
from   ventes v
join   vente_lignes l on l.vente_id = v.id
where  v.numero_commande = '323-08-2026';

-- Contrôle : ce que La braise doit encore, toutes livraisons confondues.
select v.date, v.numero_facture, v.montant,
       coalesce((select sum(r.montant) from reglements r
                 where r.vente_id = v.id), 0) as regle
from   ventes v
join   clients c on c.id = v.client_id
where  c.nom = 'La braise' and v.credit
order  by v.date;
