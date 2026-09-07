-- =====================================================================
--  TAMA FERME — Les coordonnées de paiement sur toutes les factures
--
--  À exécuter dans Supabase > SQL Editor. Rejouable.
--
--  Jusqu'ici seule la facture de Mercy Ships portait le Mvola, le nom du
--  titulaire et le compte bancaire : docs/24 les avait relevés sur sa
--  facture réelle, et sur celle de Leader Price où ils ne figurent pas.
--
--  Mais Mercy Ships règle à trente jours par virement, et c'est justement
--  le client qui a le moins besoin qu'on lui rappelle où payer. Les
--  autres — La Terrasse, La braise, Rahery, tous les clients au comptant —
--  paient à la livraison, souvent par Mvola, et leur facture ne disait pas
--  sur quel numéro. On les leur donnait de vive voix.
--
--  Le défaut de la colonne passe donc à `true` : un client créé demain
--  depuis l'application les aura sans qu'on y pense. La colonne reste, et
--  reste un choix par client — c'est maintenant une exception à poser, non
--  une permission à donner.
--
--  Leader Price garde `false`. Sa facture a été relevée telle qu'elle est
--  envoyée, sans ces mentions : c'est une grande surface qui règle à
--  trente jours par virement, sur un compte que sa comptabilité connaît.
-- =====================================================================

alter table clients
  alter column coordonnees_paiement set default true;

update clients set coordonnees_paiement = true  where nom <> 'Leader Price';
update clients set coordonnees_paiement = false where nom  = 'Leader Price';


-- Contrôle : tout le monde à `true`, Leader Price seul à `false`.
select coordonnees_paiement,
       count(*)                        as clients,
       string_agg(nom, ', ' order by nom) filter (
         where not coordonnees_paiement)  as exceptions
from   clients
where  actif
group  by coordonnees_paiement
order  by coordonnees_paiement;
