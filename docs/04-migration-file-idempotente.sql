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
create policy corriger_ferme on saisies_ferme for update
  using      (mon_role() in ('chef_ferme','direction'))
  with check (mon_role() in ('chef_ferme','direction'));

-- Corriger une fiche de ponte et son détail par calibre.
create policy corriger_ponte on pontes for update
  using      (mon_role() in ('magasiniere','direction'))
  with check (mon_role() in ('magasiniere','direction'));

create policy corriger_ponte_l on ponte_lignes for update
  using      (mon_role() in ('magasiniere','direction'))
  with check (mon_role() in ('magasiniere','direction'));

-- Corriger le détail d'une vente. L'en-tête `ventes` est déjà couvert par la
-- policy `solder_creance`, qui autorise déjà point_vente et direction en
-- update — inutile d'en ajouter une deuxième.
create policy corriger_vente_l on vente_lignes for update
  using      (mon_role() in ('point_vente','direction'))
  with check (mon_role() in ('point_vente','direction'));

-- Corriger une charge saisie à la ferme ou au point de vente.
create policy corriger_charge on charges for update
  using      (mon_role() in ('chef_ferme','point_vente','direction'))
  with check (mon_role() in ('chef_ferme','point_vente','direction'));


-- =====================================================================
--  Point à trancher, non appliqué ici
--
--  L'écran Point de vente laisse modifier le prix de base d'un calibre, mais
--  la policy `ecrire_calibres` réserve la table `calibres` à la direction.
--  Aujourd'hui cette modification échoue en silence : le prix change à
--  l'écran, rien n'est enregistré. Avec la nouvelle file, l'échec devient
--  visible dans l'en-tête — mais il faut choisir :
--
--    a) autoriser le point de vente à changer les prix de base :
--         create policy prix_point_vente on calibres for update
--           using      (mon_role() in ('point_vente','direction'))
--           with check (mon_role() in ('point_vente','direction'));
--
--    b) ou masquer l'édition des prix pour les rôles autres que direction,
--       côté application.
-- =====================================================================
