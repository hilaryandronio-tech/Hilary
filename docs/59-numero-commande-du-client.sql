-- =====================================================================
--  TAMA FERME — Le numéro de commande du client sur la facture
--
--  À exécuter dans Supabase > SQL Editor AVANT de déployer la version de
--  l'application qui accompagne ce fichier. Rejouable.
--
--  La facture Leader Price du 18 août porte deux numéros de commande : le
--  nôtre, 274-08-2026, sous nos coordonnées, et le sien, BDC210121, sous
--  les siennes. C'est la référence de son bon de commande interne ; sans
--  elle, sa comptabilité ne rapproche pas la facture de l'achat.
--
--  `ventes.numero_commande_client` la porte, livraison par livraison :
--  chaque commande de Leader Price a la sienne, elle ne se déduit de rien.
--
--  `clients.commande_client` dit qui en fournit une. Seul Leader Price
--  aujourd'hui. Le champ n'apparaît en caisse que pour ces clients-là :
--  soixante autres n'ont pas à voir une case qu'ils ne rempliront jamais.
-- =====================================================================

alter table ventes
  add column if not exists numero_commande_client text;

alter table clients
  add column if not exists commande_client boolean not null default false;

update clients set commande_client = true where nom = 'Leader Price';


-- Contrôle : qui fournit un numéro de commande.
select nom, commande_client
from   clients
where  commande_client
order  by nom;
