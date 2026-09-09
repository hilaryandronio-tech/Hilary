-- =====================================================================
--  TAMA FERME — MadaRest : le M1 à 700 Ar, et trente jours
--
--  À exécuter dans Supabase > SQL Editor. Rejouable.
--
--  Deux corrections données par le gérant.
--
--  LE PRIX. Le M1 de MadaRest est négocié à 700 Ar. Aujourd'hui la grille
--  est justement à 700 pour ce calibre (docs/18), donc rien ne change au
--  passé : ses deux livraisons M1 d'août, 280 œufs, y sont déjà. Ce que le
--  tarif apporte, c'est la suite — le jour où la grille remonte, MadaRest
--  reste à 700 au lieu de suivre.
--
--  C'est la leçon de Mercy Ships et de Leader Price : un client sans tarif
--  négocié part au prix du jour, et l'écart ne se voit qu'à la facture,
--  des semaines plus tard.
--
--  LE DÉLAI. Trente jours. C'est la troisième valeur pour ce client :
--  docs/24 avait relevé cinq jours sur sa facture du 27 août, docs/36 en
--  avait posé dix sur indication du gérant le 7 septembre, et c'est
--  maintenant trente. La dernière fait foi.
--
--  Ce que ce fichier NE touche PAS : le tarif M2 à 700 Ar posé par
--  docs/19, et la livraison L1 du 17 août partie au prix de la grille,
--  740 Ar. Le gérant n'a parlé que du M1.
-- =====================================================================

insert into tarifs_clients (client_id, calibre, prix)
select c.id, 'M1', 700 from clients c where c.nom = 'MadaRest'
on conflict (client_id, calibre) do update set prix = excluded.prix;

update clients set delai_paiement_jours = 30 where nom = 'MadaRest';


-- Contrôle 1 : ses tarifs négociés, et son délai.
select c.nom, c.delai_paiement_jours, t.calibre, t.prix
from   clients c
left   join tarifs_clients t on t.client_id = c.id
where  c.nom = 'MadaRest'
order  by t.calibre;

-- Contrôle 2 : ce qu'il a reçu, au prix où c'est parti. Les M1 doivent
-- être à 700 ; la L1 du 17 août reste à 740, prix de la grille.
select v.date, v.numero_commande, l.calibre, l.oeufs, l.prix_unit, v.montant
from   ventes v
join   vente_lignes l on l.vente_id = v.id
join   clients c      on c.id = v.client_id
where  c.nom = 'MadaRest'
order  by v.date;
