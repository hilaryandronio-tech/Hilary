-- =====================================================================
--  TAMA FERME — Le délai de paiement de Mr Mamy
--
--  À exécuter dans Supabase > SQL Editor. Rejouable.
--
--  docs/24 lui avait posé trente jours, relevés sur sa facture du 22 août.
--  Le gérant donne cinq. C'est lui qui tranche : la facture d'août portait
--  l'ancien délai, comme pour MadaRest (docs/36).
--
--  Sa facture annoncera « Condition de paiement: 05 jours à date de
--  facture » — le libellé français aligne le nombre sur deux chiffres.
-- =====================================================================

update clients set delai_paiement_jours = 5 where nom = 'Mr Mamy';


-- Contrôle : les délais négociés, tous clients confondus. Ce qui n'est pas
-- listé règle au comptant.
select nom, delai_paiement_jours as jours
from   clients
where  actif and delai_paiement_jours > 0
order  by delai_paiement_jours, nom;
