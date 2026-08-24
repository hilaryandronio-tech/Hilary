-- =====================================================================
--  TAMA FERME — Le point de vente crée ses clients
--
--  À exécuter dans Supabase > SQL Editor AVANT de déployer la version de
--  l'application qui accompagne ce fichier. Rejouable.
--
--  Jusqu'ici la liste des clients ne se remplissait que par script : un
--  nouveau client obligeait le responsable de vente à attendre. Il peut
--  désormais le créer depuis l'écran Clients.
--
--  Seule l'insertion est ouverte. Renommer ou désactiver un client touche à
--  tout son historique — le nom est la clé unique, et les ventes passées y
--  sont rattachées par identifiant. Ça reste une opération de direction.
--
--  Les tarifs négociés ne sont pas ouverts non plus : un prix hors grille
--  est une décision commerciale, pas une saisie de caisse. Un client créé
--  ici achète au prix de base, et son tarif se pose ensuite par script
--  (voir docs/19-tarifs-clients-negocies.sql).
--
--  Rappel du piège rencontré le 2026-08-07 : la RLS était active sur
--  `clients` sans aucune policy, et la table renvoyait zéro ligne sans
--  erreur — aucune vente client n'avait jamais pu être enregistrée. Le
--  contrôle en fin de script relit donc les policies existantes.
-- =====================================================================

drop   policy if exists creer_client on clients;
create policy creer_client on clients for insert
  with check (mon_role() in ('point_vente', 'direction'));

-- Contrôle : au moins `lire_clients` (select) et `creer_client` (insert).
select policyname, cmd
from   pg_policies
where  tablename = 'clients'
order  by cmd;
