-- =====================================================================
--  TAMA FERME — Les clients fidèles du carnet de commandes
--
--  Données seulement : aucun changement de schéma. La liste des clients
--  est lue en direct par l'application, ils apparaîtront dans la caisse
--  dès ce script exécuté.
--
--  Extraits des 988 commandes de « Production Tama Ferme - Commandes.csv »
--  (01/05/2026 → 07/08/2026). Aucun tarif négocié : ils achètent au prix
--  de base, qui s'applique automatiquement faute de ligne dans
--  `tarifs_clients`.
--
--  `type` et `delai_paiement_jours` ne sont lus nulle part dans
--  l'application — le comptant ou le crédit se décide vente par vente.
--
--  QUATRE FUSIONS D'ORTHOGRAPHE ont été appliquées, en gardant à chaque
--  fois la forme la plus fréquente dans le carnet. Sans elles, un même
--  client aurait deux fiches et un historique coupé en deux :
--    « Adan & Eve »          -> « Adam&Eve »            (1 vs 2 commandes)
--    « Bazary Kely »         -> « Bazary kely »         (2 vs 5)
--    « Maesteva »            -> « Masteva »             (1 vs 3)
--    « Pâtisserie Monique »  -> « Patisserie Monique »  (1 vs 7)
--
--  À VÉRIFIER : « Relax » (5 commandes) et « Plaque relax » (1) sont
--  peut-être le même client — je n'ai pas tranché. « Bazary be » et
--  « Bazary kely » sont bien deux marchés distincts et restent séparés.
--
--  Rejouable : `on conflict (nom) do nothing` protège les cinq clients
--  déjà en base et leurs tarifs négociés.
-- =====================================================================

insert into clients (nom, type, delai_paiement_jours) values
  ('ABC', 'gros', 0),
  ('ASGAR', 'gros', 0),
  ('Adam&Eve', 'gros', 0),
  ('Ambohijafy', 'gros', 0),
  ('Ambolomadinika', 'gros', 0),
  ('Angéline', 'gros', 0),
  ('B5', 'gros', 0),
  ('Bazary be', 'gros', 0),
  ('Bazary kely', 'gros', 0),
  ('Belle de jour', 'gros', 0),
  ('Bemenaka', 'gros', 0),
  ('Brickaville', 'gros', 0),
  ('CFC', 'gros', 0),
  ('Calypso', 'gros', 0),
  ('Chinoise', 'gros', 0),
  ('Damaskôsy', 'gros', 0),
  ('EPP Tsiry', 'gros', 0),
  ('Fabrice', 'gros', 0),
  ('Fasankarana', 'gros', 0),
  ('Fenerive-Est', 'gros', 0),
  ('Hasina', 'gros', 0),
  ('Jems', 'gros', 0),
  ('Jirama', 'gros', 0),
  ('La Paillote', 'gros', 0),
  ('La Terrasse', 'gros', 0),
  ('La braise', 'gros', 0),
  ('Lasopy', 'gros', 0),
  ('Leader Price', 'gros', 0),
  ('Linah', 'gros', 0),
  ('MadaRest', 'gros', 0),
  ('Madsteel', 'gros', 0),
  ('Major Shop', 'gros', 0),
  ('Mangarano', 'gros', 0),
  ('Masteva', 'gros', 0),
  ('Mercy Ships', 'gros', 0),
  ('Mme Angela', 'gros', 0),
  ('Mr Mamy', 'gros', 0),
  ('Mr Rado', 'gros', 0),
  ('Naivo', 'gros', 0),
  ('Nambinina', 'gros', 0),
  ('Otiv', 'gros', 0),
  ('Patisserie Monique', 'gros', 0),
  ('Patisserie Wong', 'gros', 0),
  ('Plaque relax', 'gros', 0),
  ('Pompier', 'gros', 0),
  ('Poulet Gasy', 'gros', 0),
  ('Rahery', 'gros', 0),
  ('Ralaimongo', 'gros', 0),
  ('Relax', 'gros', 0),
  ('SASA', 'gros', 0),
  ('Sainte Marie', 'gros', 0),
  ('Salazamay', 'gros', 0),
  ('Shaki', 'gros', 0),
  ('Soavita', 'gros', 0),
  ('Tanambao V', 'gros', 0),
  ('Valpinson', 'gros', 0),
  ('Wu shao Ying', 'gros', 0),
  ('Zoky Jo', 'gros', 0)
on conflict (nom) do nothing;
