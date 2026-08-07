-- =====================================================================
--  TAMA FERME — Ajout du client Masteva
--
--  Données seulement : aucun changement de schéma, aucune policy. La liste
--  des clients est lue en direct par l'application, Masteva apparaîtra dans
--  la caisse dès ce script exécuté, sans redéploiement.
--
--  Tarif : L2 à 800 Ar, comme Calypso. Les autres calibres partent au prix
--  de base, comme pour tous les clients négociés.
--
--  `type` et `delai_paiement_jours` sont purement indicatifs : rien dans
--  l'application ne les lit, le comptant ou le crédit se décide vente par
--  vente à la caisse. À corriger sans risque si Masteva règle à échéance.
--
--  Rejouable : réexécuter le script met à jour les prix sans créer de
--  doublon.
-- =====================================================================

insert into clients (nom, type, delai_paiement_jours)
values ('Masteva', 'gros', 0)
on conflict (nom) do nothing;

insert into tarifs_clients (client_id, calibre, prix)
select c.id, 'L2', 800
from   clients c
where  c.nom = 'Masteva'
on conflict (client_id, calibre) do update set prix = excluded.prix;

-- Rattrapage : une première version de ce script posait aussi un tarif L1.
-- Le retirer ne touche pas aux ventes déjà passées — `vente_lignes.prix_unit`
-- fige le prix au moment de la vente.
delete from tarifs_clients
where  calibre = 'L1'
  and  client_id = (select id from clients where nom = 'Masteva');
