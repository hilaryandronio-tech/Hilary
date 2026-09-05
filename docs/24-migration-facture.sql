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


-- =====================================================================
--  Deux modèles de facture, et les mentions propres à chaque client
--
--  Relevé sur quatre factures de plus : La Terrasse (31/08), Mada-Rest
--  (27/08), La braise Coté cour (19/08) et Mr Mamy (22/08).
--
--  Elles ne suivent pas le modèle de Leader Price et Mercy Ships : leur
--  tableau n'a que quatre colonnes — Catégorie, Quantité, Prix unitaire,
--  Montant — sans « Code M » ni ligne de total. D'où `modele`.
--
--  Mada-Rest porte en plus une date de ponte, une date de péremption à
--  vingt et un jours, le montant en toutes lettres et le RIB en pied de
--  page. La Terrasse n'affiche aucune condition de paiement.
--
--  `nom_facture` : le nom imprimé diffère parfois de celui de la base —
--  « Mada-Rest » pour MadaRest, « La braise Coté cour » pour La braise.
-- =====================================================================

alter table clients
  add column if not exists nom_facture   text,
  add column if not exists modele        text not null default 'simple'
    check (modele in ('simple', 'complet')),
  add column if not exists dates_oeufs   boolean not null default false,
  add column if not exists montant_lettres boolean not null default false,
  add column if not exists rib_pied      boolean not null default false,
  add column if not exists afficher_conditions boolean not null default true;

update clients set modele = 'complet' where nom in ('Leader Price', 'Mercy Ships');

update clients set
  adresse = E'38bis boulevard joffre,\nToamasina 501, Madagascar',
  telephone_fac = '+261 34 95 390 33',
  conditionnement = 1, afficher_conditions = false
where nom = 'La Terrasse';

update clients set
  nom_facture = 'Mada-Rest',
  adresse = E'Lot 722 P/lle 13/36\nToamasina 501, Madagascar',
  conditionnement = 1, delai_paiement_jours = 5,
  dates_oeufs = true, montant_lettres = true, rib_pied = true
where nom = 'MadaRest';

update clients set
  nom_facture = 'La braise Coté cour',
  adresse = E'69 boulevard joffre,\nToamasina 501, Madagascar',
  telephone_fac = '+261 34 12 456 13',
  conditionnement = 1, delai_paiement_jours = 30
where nom = 'La braise';

update clients set
  adresse = 'Fenerive-Est',
  telephone_fac = '+261 38 06 302 18',
  conditionnement = 1, delai_paiement_jours = 30
where nom = 'Mr Mamy';

-- « Côté cour » avait été créé comme client distinct le 2026-09-05 ; sa
-- facture du 19 août montre qu'il s'agit du même établissement que
-- « La braise ». On le désactive plutôt que de le supprimer : une vente a
-- pu lui être rattachée entre-temps, et la supprimer l'emporterait.
update clients set actif = false where nom = 'Côté cour';

-- Contrôle : à vérifier avant de désactiver Côté cour — s'il a des ventes,
-- il faut les basculer sur La braise.
select c.nom, count(v.id) as ventes
from   clients c left join ventes v on v.client_id = c.id
where  c.nom in ('Côté cour', 'La braise')
group  by c.nom;
