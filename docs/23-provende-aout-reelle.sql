-- =====================================================================
--  TAMA FERME — Réalignement de la provende d'août sur la feuille du magasin
--
--  La base portait des rations théoriques rondes — 300 kg pour V2 presque
--  tous les jours — là où la feuille « Provende TMF V1 et V2 » porte les
--  relevés réels, qui varient de 294 à 345 kg. La saisie du soir avait été
--  faite de mémoire plutôt que d'après la feuille. Sur le mois, la provende
--  distribuée était sous-comptée, donc le coût de production sous-évalué et
--  le stock restant surévalué.
--
--  Source : colonnes G (V1/kilos) et I (V2/kilos) de la feuille, 1er au
--  31 août 2026. Contrôle de transcription : la somme donne 391,73 sacs de
--  50 kg, exactement le total que la feuille affiche en bas de sa colonne
--  « Aliment/sacs ». Le total en kilos de la feuille (19 598) porte lui une
--  erreur de formule de 11,5 kg au 14 août — il n'a pas été suivi.
--
--  Quatre de ces journées n'existaient pas en base, ou valaient zéro : le
--  2, le 17 et le 28 août pour V2. L'upsert les crée ou les corrige comme
--  les autres.
--
--  La mortalité n'est pas touchée : seul le poids de provende et son prix
--  sont réécrits. Le prix d'août est 2 738 Ar/kg (0210AX), celui d'avant le
--  1er septembre — voir docs/22-prix-provende-septembre.sql.
--
--  Rejouable.
-- =====================================================================

insert into saisies_ferme (date, lot_id, provende_kg, prix_provende_kg)
values
  ('2026-08-01', 'V1', 340, 2738),
  ('2026-08-02', 'V1', 325, 2738),
  ('2026-08-03', 'V1', 340, 2738),
  ('2026-08-04', 'V1', 310, 2738),
  ('2026-08-05', 'V1', 347, 2738),
  ('2026-08-06', 'V1', 340, 2738),
  ('2026-08-07', 'V1', 345, 2738),
  ('2026-08-08', 'V1', 340, 2738),
  ('2026-08-09', 'V1', 348, 2738),
  ('2026-08-10', 'V1', 340, 2738),
  ('2026-08-11', 'V1', 312, 2738),
  ('2026-08-12', 'V1', 340, 2738),
  ('2026-08-13', 'V1', 340, 2738),
  ('2026-08-14', 'V1', 311.5, 2738),
  ('2026-08-15', 'V1', 315, 2738),
  ('2026-08-16', 'V1', 311, 2738),
  ('2026-08-17', 'V1', 321, 2738),
  ('2026-08-18', 'V1', 340, 2738),
  ('2026-08-19', 'V1', 348, 2738),
  ('2026-08-20', 'V1', 310, 2738),
  ('2026-08-21', 'V1', 326, 2738),
  ('2026-08-22', 'V1', 318, 2738),
  ('2026-08-23', 'V1', 300, 2738),
  ('2026-08-24', 'V1', 305, 2738),
  ('2026-08-25', 'V1', 315, 2738),
  ('2026-08-26', 'V1', 320, 2738),
  ('2026-08-27', 'V1', 322, 2738),
  ('2026-08-28', 'V1', 300, 2738),
  ('2026-08-29', 'V1', 300, 2738),
  ('2026-08-30', 'V1', 311, 2738),
  ('2026-08-31', 'V1', 314, 2738),
  ('2026-08-01', 'V2', 310, 2738),
  ('2026-08-02', 'V2', 300, 2738),
  ('2026-08-03', 'V2', 310, 2738),
  ('2026-08-04', 'V2', 300, 2738),
  ('2026-08-05', 'V2', 308, 2738),
  ('2026-08-06', 'V2', 300, 2738),
  ('2026-08-07', 'V2', 309, 2738),
  ('2026-08-08', 'V2', 310, 2738),
  ('2026-08-09', 'V2', 314, 2738),
  ('2026-08-10', 'V2', 310, 2738),
  ('2026-08-11', 'V2', 300, 2738),
  ('2026-08-12', 'V2', 310, 2738),
  ('2026-08-13', 'V2', 310, 2738),
  ('2026-08-14', 'V2', 300, 2738),
  ('2026-08-15', 'V2', 312, 2738),
  ('2026-08-16', 'V2', 307, 2738),
  ('2026-08-17', 'V2', 311, 2738),
  ('2026-08-18', 'V2', 310, 2738),
  ('2026-08-19', 'V2', 319, 2738),
  ('2026-08-20', 'V2', 323, 2738),
  ('2026-08-21', 'V2', 326, 2738),
  ('2026-08-22', 'V2', 300, 2738),
  ('2026-08-23', 'V2', 345, 2738),
  ('2026-08-24', 'V2', 300, 2738),
  ('2026-08-25', 'V2', 300, 2738),
  ('2026-08-26', 'V2', 294, 2738),
  ('2026-08-27', 'V2', 294, 2738),
  ('2026-08-28', 'V2', 300, 2738),
  ('2026-08-29', 'V2', 300, 2738),
  ('2026-08-30', 'V2', 300, 2738),
  ('2026-08-31', 'V2', 300, 2738)
on conflict (date, lot_id) do update
  set provende_kg      = excluded.provende_kg,
      prix_provende_kg = excluded.prix_provende_kg;

-- Contrôle : 10 054,5 kg pour V1, 9 532 kg pour V2, 19 586,5 au total.
select lot_id, sum(provende_kg) as kilos, count(*) as jours
from   saisies_ferme
where  date between '2026-08-01' and '2026-08-31' and lot_id in ('V1', 'V2')
group  by lot_id
order  by lot_id;
