-- =====================================================================
--  TAMA FERME — Migration : file d'attente idempotente
--
--  À exécuter dans Supabase > SQL Editor AVANT de déployer la version de
--  l'application qui accompagne ce fichier.
--
--  Pourquoi : la file d'attente hors ligne n'envoie plus des `insert` mais
--  des `upsert`, c'est-à-dire des `INSERT ... ON CONFLICT DO UPDATE`. Cela
--  rend une écriture rejouable — un téléphone qui perd la réponse d'une
--  requête réussie la renvoie sans créer de doublon — et transforme une
--  ressaisie du même jour en correction plutôt qu'en violation de la
--  contrainte `unique (date, lot_id)`.
--
--  Or Postgres exige une policy UPDATE, en plus de la policy INSERT, dès que
--  le chemin « conflit » est emprunté. Sans les policies ci-dessous, toute
--  correction serait refusée avec « Droits insuffisants » (SQLSTATE 42501).
-- =====================================================================


-- Corriger la saisie du soir : même périmètre que la saisie initiale.
drop   policy if exists corriger_ferme on saisies_ferme;
create policy corriger_ferme on saisies_ferme for update
  using      (mon_role() in ('chef_ferme','direction'))
  with check (mon_role() in ('chef_ferme','direction'));

-- Corriger une fiche de ponte et son détail par calibre.
drop   policy if exists corriger_ponte on pontes;
create policy corriger_ponte on pontes for update
  using      (mon_role() in ('magasiniere','direction'))
  with check (mon_role() in ('magasiniere','direction'));

drop   policy if exists corriger_ponte_l on ponte_lignes;
create policy corriger_ponte_l on ponte_lignes for update
  using      (mon_role() in ('magasiniere','direction'))
  with check (mon_role() in ('magasiniere','direction'));

-- Corriger le détail d'une vente. L'en-tête `ventes` est déjà couvert par la
-- policy `solder_creance`, qui autorise déjà point_vente et direction en
-- update — inutile d'en ajouter une deuxième.
drop   policy if exists corriger_vente_l on vente_lignes;
create policy corriger_vente_l on vente_lignes for update
  using      (mon_role() in ('point_vente','direction'))
  with check (mon_role() in ('point_vente','direction'));

-- Corriger une charge saisie à la ferme ou au point de vente.
drop   policy if exists corriger_charge on charges;
create policy corriger_charge on charges for update
  using      (mon_role() in ('chef_ferme','point_vente','direction'))
  with check (mon_role() in ('chef_ferme','point_vente','direction'));


-- =====================================================================
--  Prix des œufs : rien à changer ici, et c'est voulu
--
--  La policy `ecrire_calibres` réserve la table `calibres` à la direction.
--  L'écran Point de vente s'aligne dessus : le bloc « Prix des œufs par
--  calibre » n'est modifiable que pour un compte Direction, et se rend en
--  lecture seule pour les autres (voir `peutModifierPrix` dans
--  src/screens/PointVente.jsx). Les deux barrières disent la même chose,
--  donc ce refus RLS n'est jamais atteignable depuis l'application.
--
--  Si un jour la vendeuse doit pouvoir suivre le prix du marché elle-même,
--  il faudra lever les deux ensemble — l'écran seul ne suffirait pas :
--    create policy prix_point_vente on calibres for update
--      using      (mon_role() in ('point_vente','direction'))
--      with check (mon_role() in ('point_vente','direction'));
-- =====================================================================


-- =====================================================================
--  Écriture sur `lots` — ajout du 2026-08-07
--
--  L'écran Bilan laisse la direction saisir l'effectif réellement compté
--  dans un bâtiment. La valeur est reportée dans `lots.effectif_initial`
--  de façon que `v_effectif.vivant` retombe sur le nombre saisi, mortalité
--  cumulée comprise. Il faut donc autoriser la direction à écrire sur
--  `lots`, qui n'était jusqu'ici accessible qu'en lecture.
-- =====================================================================

drop   policy if exists ecrire_lots on lots;
create policy ecrire_lots on lots for update
  using      (mon_role() = 'direction')
  with check (mon_role() = 'direction');
