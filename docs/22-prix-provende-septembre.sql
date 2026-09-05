-- =====================================================================
--  TAMA FERME — Prix de la provende, à jour au 1er septembre 2026
--
--  V1 et V2, aliment 0210AX : 2 738 Ar/kg jusqu'au 31 août, 2 806 Ar/kg
--  depuis le 1er septembre.
--  V3, aliment PN030F (poulettes) : 2 890 Ar/kg, inchangé. Noté PN020F dans
--  les documents précédents — c'est bien PN030F.
--
--  L'ordre compte. `v_journalier.cout_provende` lit
--  `coalesce(saisies_ferme.prix_provende_kg, lots.prix_provende_kg)` : une
--  saisie sans prix suit le prix courant de son bâtiment. Poser 2 806 sur
--  `lots` sans avoir figé l'historique revaloriserait donc tout le mois
--  d'août au nouveau tarif — le coût de la provende grimperait d'un coup et
--  le bénéfice s'effondrerait rétroactivement. On fige d'abord, on met le
--  prix courant ensuite, le tout dans une transaction.
--
--  Rejouable. Attention en revanche si le prix change à nouveau : il faudra
--  ajouter une borne de date, pas réécrire celles-ci.
-- =====================================================================

begin;

-- 1. Prix figé des saisies déjà enregistrées
update saisies_ferme set prix_provende_kg = 2738
where  lot_id in ('V1', 'V2') and date <= '2026-08-31';

update saisies_ferme set prix_provende_kg = 2806
where  lot_id in ('V1', 'V2') and date >= '2026-09-01';

update saisies_ferme set prix_provende_kg = 2890
where  lot_id = 'V3';

-- 2. Prix courant, celui qu'appliqueront les prochaines saisies
update lots set prix_provende_kg = 2806 where id in ('V1', 'V2');
update lots set prix_provende_kg = 2890 where id = 'V3';

commit;

-- Contrôle : deux lignes pour V1, deux pour V2 (2738 jusqu'au 31/08, 2806
-- ensuite), une seule pour V3 à 2890.
select lot_id, prix_provende_kg, count(*) as jours, min(date) as du, max(date) as au
from   saisies_ferme
where  provende_kg > 0
group  by lot_id, prix_provende_kg
order  by lot_id, du;
