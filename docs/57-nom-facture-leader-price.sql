-- =====================================================================
--  TAMA FERME — Le nom imprimé de Leader Price
--
--  À exécuter dans Supabase > SQL Editor. Rejouable.
--
--  Relevé sur la facture du 18 août 2026, F-20260818-072628 : le client
--  n'est pas « Leader Price » mais « DISTRIBUTION LEADER PRICE S.A.R.L
--  ENTREPOT - Gestion des articles ». C'est l'entité qui reçoit la
--  facture, entrepôt et service compris.
--
--  docs/24 avait relevé son adresse, son NIF, son STAT, ses références
--  légales et son téléphone — tout cela est juste. Seul le nom manquait,
--  et l'application retombait sur celui de la base, qui sert à la
--  sélection en caisse et doit rester court.
--
--  C'est précisément à quoi sert `nom_facture` : l'écart entre le nom
--  qu'on saisit et celui qu'on imprime.
-- =====================================================================

update clients
   set nom_facture = 'DISTRIBUTION LEADER PRICE S.A.R.L ENTREPOT - Gestion des articles'
 where nom = 'Leader Price';


-- Contrôle : le nom court sert à la caisse, le long à la facture.
select nom, nom_facture, conditionnement, conditionnements, delai_paiement_jours
from   clients
where  nom = 'Leader Price';
