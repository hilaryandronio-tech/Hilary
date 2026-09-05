-- =====================================================================
--  TAMA FERME — Le vrai numéro de facture
--
--  À exécuter dans Supabase > SQL Editor. Rejouable.
--
--  L'application fabriquait le numéro de facture à partir de l'heure
--  d'enregistrement en base — F-AAAAMMJJ-HHMMSS. C'est stable, mais ce
--  n'est pas le numéro que le client a reçu : les factures existantes ont
--  été produites par la feuille, à une autre heure.
--
--  Rééditer une facture depuis l'application donnait donc un numéro
--  différent de l'original, pour la même livraison. Deux numéros pour un
--  seul document, c'est ce qu'un comptable relève en premier.
--
--  La colonne stocke le numéro réel quand il est connu ; sinon la facture
--  continue de le dériver, comme avant.
-- =====================================================================

alter table ventes add column if not exists numero_facture text;

-- Contrôle : combien de ventes portent déjà leur numéro.
select count(*) filter (where numero_facture is not null) as avec_numero,
       count(*) as total
from   ventes;
