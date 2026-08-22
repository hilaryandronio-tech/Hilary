-- =====================================================================
--  TAMA FERME — Tarif négocié de Mr Mamy
--
--  Données seulement : aucun changement de schéma, aucune policy. La caisse
--  lit les tarifs en direct, le nouveau prix s'applique dès ce script
--  exécuté, sans redéploiement.
--
--  L1 à 730 Ar, contre 670 Ar au prix de base — c'est une majoration, pas
--  une remise, comme pour Mercy Ships. Les autres calibres restent au prix
--  de base : un tarif négocié ne vaut que pour le couple client + calibre
--  qu'il désigne.
--
--  Mr Mamy existe déjà, créé par docs/08-clients-fideles.sql avec les 58
--  clients du carnet ; l'insert ci-dessous ne fait que le retrouver.
--
--  Les ventes déjà passées ne bougent pas : `vente_lignes.prix_unit` fige
--  le prix au moment de la vente.
--
--  Rejouable : réexécuter le script met à jour le prix sans doublon.
-- =====================================================================

insert into tarifs_clients (client_id, calibre, prix)
select c.id, 'L1', 730
from   clients c
where  c.nom = 'Mr Mamy'
on conflict (client_id, calibre) do update set prix = excluded.prix;

-- Contrôle : doit renvoyer une ligne, « Mr Mamy | L1 | 730 ».
select c.nom, t.calibre, t.prix
from   tarifs_clients t
join   clients c on c.id = t.client_id
where  c.nom = 'Mr Mamy';
