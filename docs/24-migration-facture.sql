-- =====================================================================
--  TAMA FERME — Les mentions de facturation des clients
--
--  À exécuter dans Supabase > SQL Editor AVANT de déployer la version de
--  l'application qui accompagne ce fichier. Rejouable.
--
--  Relevé sur deux factures réelles : Leader Price du 2026-09-03 et Mercy
--  Ships du 2026-09-05. Elles diffèrent sur presque tout, d'où ces colonnes.
--
--  `conditionnement` est le point le moins évident. L'application compte en
--  œufs à l'unité — c'est ce que l'équipe ramasse et vend — mais la facture
--  s'écrit dans l'emballage du client : « Oeufs x12, 60 unités à 9 120 Ar »
--  chez Leader Price, « Eggs, 570 unités à 1 000 Ar » chez Mercy Ships. Le
--  nombre stocké ici est la taille du paquet, et la facture fait la
--  conversion : 12 chez l'un, 1 chez l'autre, 30 pour une alvéole.
--
--  `langue` : Mercy Ships est la seule facture en anglais. L'en-tête de la
--  ferme se traduit avec elle.
--
--  `coordonnees_paiement` : affichées chez Mercy Ships, absentes chez Leader
--  Price. C'est donc un choix par client, pas une règle générale.
--
--  Le « Code M » n'est PAS ici : 67218 figure à l'identique sur les deux
--  factures, c'est une référence de la ferme et non du client. Elle vit dans
--  src/data/ferme.js.
-- =====================================================================

alter table clients
  add column if not exists adresse       text,
  add column if not exists nif           text,
  add column if not exists stat          text,
  add column if not exists refs_legales  text,     -- CIF, R.C., tout le reste
  add column if not exists telephone_fac text,
  add column if not exists langue        text not null default 'fr'
    check (langue in ('fr', 'en')),
  add column if not exists coordonnees_paiement boolean not null default false,
  add column if not exists conditionnement smallint not null default 30
    check (conditionnement > 0);

update clients set
  adresse = E'PK 6, Route d\'Antsirabe\nAnkadimbahoaka\n101 Antananarivo',
  nif = '2000003904',
  stat = '46900 11 2004 0 10086',
  refs_legales = E'CIF: 0029045/DGI-F 30/05/1\nR.C. N 2004B00046',
  telephone_fac = '034 47 177 01 / 02',
  conditionnement = 12,
  langue = 'fr',
  coordonnees_paiement = false,
  delai_paiement_jours = 30
where nom = 'Leader Price';

update clients set
  adresse = E'Hôpital be Analankininina\nToamasina 501, Madagascar',
  telephone_fac = '+261 32 12 019 13',
  conditionnement = 1,
  langue = 'en',
  coordonnees_paiement = true,
  delai_paiement_jours = 10
where nom = 'Mercy Ships';

-- La direction corrige ces mentions ; elles ne se saisissent pas en caisse.
drop   policy if exists corriger_client on clients;
create policy corriger_client on clients for update
  using      (mon_role() = 'direction')
  with check (mon_role() = 'direction');

-- Contrôle : Leader Price en x12 à 30 jours, Mercy Ships à l'unité, en
-- anglais, à 10 jours ; tous les autres à 30 par défaut.
select nom, conditionnement, langue, delai_paiement_jours, coordonnees_paiement
from   clients
where  nom in ('Leader Price', 'Mercy Ships', 'Calypso', 'La Terrasse')
order  by nom;


-- =====================================================================
--  Prix facturé, distinct du prix encaissé
--
--  Mercy Ships paie 1 000 Ar l'œuf, dont 200 reviennent à l'intermédiaire
--  qui a trouvé le contrat. La ferme touche 800, et c'est 800 que la caisse
--  enregistre — la créance de Mercy Ships envers la ferme est bien de 800
--  par œuf, l'intermédiaire encaissant sa part de son côté. Mais la facture
--  remise au client doit afficher 1 000.
--
--  D'où cette colonne : elle ne sert qu'à l'impression. Laissée vide, la
--  facture reprend le prix de la vente, ce qui est le cas de tous les autres
--  clients.
-- =====================================================================

alter table tarifs_clients
  add column if not exists prix_facture integer check (prix_facture > 0);

insert into tarifs_clients (client_id, calibre, prix, prix_facture)
select c.id, 'L1', 800, 1000
from   clients c
where  c.nom = 'Mercy Ships'
on conflict (client_id, calibre) do update
  set prix = excluded.prix, prix_facture = excluded.prix_facture;

-- Contrôle : Mercy Ships en L1, 800 encaissés, 1 000 facturés.
select c.nom, t.calibre, t.prix, t.prix_facture
from   tarifs_clients t
join   clients c on c.id = t.client_id
where  c.nom = 'Mercy Ships';
