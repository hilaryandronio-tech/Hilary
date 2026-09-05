-- =====================================================================
--  TAMA FERME — La provende d'août, telle que les feuilles du magasin
--
--  Trois journées de V2 (2, 17 et 28 août, 300 kg chacune) et une de V3
--  (15 août, 175 kg) n'avaient jamais été saisies : 1 075 kg distribués mais
--  absents des comptes, soit près de 2 970 000 Ar de charge manquante.
--
--  Partout ailleurs le total du jour était juste, seule la répartition entre
--  V1 et V2 différait — la base attribuait à V1 des kilos allés à V2. Sans
--  effet sur le coût, les deux bâtiments ayant le même prix, mais le
--  « grammes par poule » de chaque vague en était faussé, et c'est
--  précisément l'indicateur qui sert à repérer une vague qui mange mal.
--
--  Sources : feuilles « Provende TMF V1 et V2 » (colonnes G et I) et celle
--  de V3 (colonne « Poids/kilos »), 1er au 31 août 2026. La transcription de
--  V1/V2 a été contrôlée par la somme en sacs — 391,73, identique au total
--  que la feuille calcule elle-même ; celle de V3 par comparaison jour à
--  jour avec la base, qui ne laissait que deux écarts.
--
--  LE 14 AOÛT EST VOLONTAIREMENT ABSENT pour V1 et V2 : la feuille se
--  contredit sur cette ligne, G + I donnent 611,5 kg quand la colonne
--  « Aliment/Kilos » affiche 623, valeur reprise dans la base. À trancher
--  avec le chef de ferme avant d'y toucher.
--
--  La mortalité n'est pas modifiée. Prix d'août : 2 738 Ar/kg pour V1 et V2
--  (0210AX), 2 890 pour V3 (PN020F, en transition vers PN030F à partir du
--  28 août). Rejouable.
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
  ('2026-08-31', 'V2', 300, 2738),
  ('2026-08-01', 'V3', 167, 2890),
  ('2026-08-02', 'V3', 179, 2890),
  ('2026-08-03', 'V3', 152, 2890),
  ('2026-08-04', 'V3', 159, 2890),
  ('2026-08-05', 'V3', 150, 2890),
  ('2026-08-06', 'V3', 150, 2890),
  ('2026-08-07', 'V3', 160, 2890),
  ('2026-08-08', 'V3', 150, 2890),
  ('2026-08-09', 'V3', 160, 2890),
  ('2026-08-10', 'V3', 150, 2890),
  ('2026-08-11', 'V3', 179, 2890),
  ('2026-08-12', 'V3', 161, 2890),
  ('2026-08-13', 'V3', 175, 2890),
  ('2026-08-14', 'V3', 175, 2890),
  ('2026-08-15', 'V3', 175, 2890),
  ('2026-08-16', 'V3', 175, 2890),
  ('2026-08-17', 'V3', 175, 2890),
  ('2026-08-18', 'V3', 176, 2890),
  ('2026-08-19', 'V3', 179, 2890),
  ('2026-08-20', 'V3', 202, 2890),
  ('2026-08-21', 'V3', 202, 2890),
  ('2026-08-22', 'V3', 202, 2890),
  ('2026-08-23', 'V3', 202, 2890),
  ('2026-08-24', 'V3', 202, 2890),
  ('2026-08-25', 'V3', 202, 2890),
  ('2026-08-26', 'V3', 191, 2890),
  ('2026-08-27', 'V3', 212, 2890),
  ('2026-08-28', 'V3', 212, 2890),
  ('2026-08-29', 'V3', 212, 2890),
  ('2026-08-30', 'V3', 212, 2890),
  ('2026-08-31', 'V3', 212, 2890)
on conflict (date, lot_id) do update
  set provende_kg      = excluded.provende_kg,
      prix_provende_kg = excluded.prix_provende_kg;

-- Contrôle : V1 9743 kg sur 30 jours, V2 9232 sur 30,
-- V3 5610 sur 31. Le 14 août reste tel qu'il était pour V1 et V2.
select lot_id, sum(provende_kg) as kilos, count(*) as jours
from   saisies_ferme
where  date between '2026-08-01' and '2026-08-31'
group  by lot_id
order  by lot_id;
