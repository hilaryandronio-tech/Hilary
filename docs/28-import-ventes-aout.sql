-- =====================================================================
--  TAMA FERME — Les livraisons du 24 au 31 août 2026
--
--  Même principe que docs/27 : relevé sur le registre de commandes,
--  transcrit depuis trois captures. 97 lignes. Les numéros absents du
--  registre affiché (379, 383, 387, 389…) n'y étaient pas non plus.
--
--  Prix : la grille en vigueur depuis le 11 août, celle que porte encore
--  la table `calibres` — le tarif n'a pas changé jusqu'au 1er septembre.
--  Le tarif négocié du client l'emporte quand il existe.
--
--  « Metisse Chinois » ne figurait pas dans la liste des clients : il est
--  créé ici. Le « MadaReste » du registre est le « MadaRest » de la base.
--
--  Rejouable : l'identifiant de chaque vente dérive de son numéro de bon.
-- =====================================================================

insert into clients (nom, type, delai_paiement_jours)
values ('Metisse Chinois', 'gros', 0)
on conflict (nom) do nothing;

begin;

with carnet(jour, numero, client, calibre, oeufs) as (values
  ('2026-08-24'::date, '377-08-2026', 'La Terrasse', 'M2', 150),
  ('2026-08-24'::date, '378-08-2026', 'Mercy Ships', 'M2', 590),
  ('2026-08-24'::date, '380-08-2026', 'Mr Mamy', 'L1', 1300),
  ('2026-08-24'::date, '381-08-2026', 'Fasankarana', 'S1', 6),
  ('2026-08-24'::date, '382-08-2026', 'Fasankarana', 'S2', 115),
  ('2026-08-24'::date, '384-08-2026', 'Nambinina', 'S2', 600),
  ('2026-08-24'::date, '385-08-2026', 'CFC', 'M1', 1300),
  ('2026-08-24'::date, '386-08-2026', 'Damaskôsy', 'M1', 823),
  ('2026-08-24'::date, '388-08-2026', 'Rahery', 'M2', 1123),
  ('2026-08-24'::date, '391-08-2026', 'Otiv', 'L1', 760),
  ('2026-08-24'::date, '392-08-2026', 'Nambinina', 'L2', 800),
  ('2026-08-24'::date, '393-08-2026', 'Major Shop', 'XL1', 356),
  ('2026-08-24'::date, '394-08-2026', 'Pompier', 'XL1', 300),
  ('2026-08-24'::date, '396-08-2026', 'EPP Tsiry', 'XL2', 196),
  ('2026-08-24'::date, '397-08-2026', 'Chinoise', 'CASSE', 110),
  ('2026-08-25'::date, '398-08-2026', 'Calypso', 'L2', 600),
  ('2026-08-25'::date, '401-08-2026', 'MadaRest', 'M1', 130),
  ('2026-08-25'::date, '403-08-2026', 'Mercy Ships', 'M2', 540),
  ('2026-08-25'::date, '405-08-2026', 'Linah', 'S1', 4),
  ('2026-08-25'::date, '406-08-2026', 'Linah', 'S2', 32),
  ('2026-08-25'::date, '407-08-2026', 'Nambinina', 'S2', 300),
  ('2026-08-25'::date, '408-08-2026', 'CFC', 'M1', 900),
  ('2026-08-25'::date, '409-08-2026', 'Metisse Chinois', 'M2', 701),
  ('2026-08-25'::date, '412-08-2026', 'Fasankarana', 'M1', 36),
  ('2026-08-25'::date, '414-08-2026', 'Rahery', 'L1', 1047),
  ('2026-08-25'::date, '415-08-2026', 'Naivo', 'L2', 552),
  ('2026-08-25'::date, '417-08-2026', 'Major Shop', 'XL1', 221),
  ('2026-08-25'::date, '418-08-2026', 'Pompier', 'XL1', 200),
  ('2026-08-25'::date, '419-08-2026', 'EPP Tsiry', 'XL2', 95),
  ('2026-08-25'::date, '421-08-2026', 'Lasopy', 'CASSE', 52),
  ('2026-08-26'::date, '422-08-2026', 'Mercy Ships', 'M2', 600),
  ('2026-08-26'::date, '423-08-2026', 'Fasankarana', 'S1', 3),
  ('2026-08-26'::date, '424-08-2026', 'Fasankarana', 'S2', 21),
  ('2026-08-26'::date, '425-08-2026', 'Nambinina', 'S2', 300),
  ('2026-08-26'::date, '428-08-2026', 'CFC', 'M1', 1067),
  ('2026-08-26'::date, '429-08-2026', 'Otiv', 'M2', 652),
  ('2026-08-26'::date, '431-08-2026', 'Rahery', 'L1', 1041),
  ('2026-08-26'::date, '433-08-2026', 'Naivo', 'L2', 655),
  ('2026-08-26'::date, '435-08-2026', 'Major Shop', 'XL1', 205),
  ('2026-08-26'::date, '436-08-2026', 'Pompier', 'XL1', 200),
  ('2026-08-26'::date, '437-08-2026', 'EPP Tsiry', 'XL2', 83),
  ('2026-08-26'::date, '438-08-2026', 'Chinoise', 'CASSE', 44),
  ('2026-08-27'::date, '439-08-2026', 'Mercy Ships', 'M2', 600),
  ('2026-08-27'::date, '442-08-2026', 'MadaRest', 'M1', 150),
  ('2026-08-27'::date, '444-08-2026', 'Linah', 'S1', 3),
  ('2026-08-27'::date, '446-08-2026', 'Linah', 'S2', 44),
  ('2026-08-27'::date, '447-08-2026', 'Nambinina', 'S2', 300),
  ('2026-08-27'::date, '448-08-2026', 'CFC', 'M1', 934),
  ('2026-08-27'::date, '449-08-2026', 'Otiv', 'M2', 551),
  ('2026-08-27'::date, '450-08-2026', 'Rahery', 'L1', 996),
  ('2026-08-27'::date, '452-08-2026', 'Naivo', 'L2', 636),
  ('2026-08-27'::date, '453-08-2026', 'Major Shop', 'XL1', 211),
  ('2026-08-27'::date, '454-08-2026', 'Pompier', 'XL1', 200),
  ('2026-08-27'::date, '456-08-2026', 'EPP Tsiry', 'XL2', 108),
  ('2026-08-27'::date, '459-08-2026', 'Chinoise', 'CASSE', 44),
  ('2026-08-28'::date, '461-08-2026', 'Mercy Ships', 'M2', 450),
  ('2026-08-28'::date, '462-08-2026', 'Fasankarana', 'S1', 6),
  ('2026-08-28'::date, '465-08-2026', 'Fasankarana', 'S2', 104),
  ('2026-08-28'::date, '466-08-2026', 'Nambinina', 'S2', 300),
  ('2026-08-28'::date, '467-08-2026', 'CFC', 'M1', 1134),
  ('2026-08-28'::date, '468-08-2026', 'Otiv', 'M2', 687),
  ('2026-08-28'::date, '471-08-2026', 'Rahery', 'L1', 921),
  ('2026-08-28'::date, '472-08-2026', 'Naivo', 'L2', 652),
  ('2026-08-28'::date, '473-08-2026', 'Pompier', 'XL1', 200),
  ('2026-08-28'::date, '474-08-2026', 'Major Shop', 'XL1', 204),
  ('2026-08-28'::date, '475-08-2026', 'EPP Tsiry', 'XL2', 81),
  ('2026-08-28'::date, '476-08-2026', 'Chinoise', 'CASSE', 66),
  ('2026-08-29'::date, '477-08-2026', 'Mercy Ships', 'M2', 560),
  ('2026-08-29'::date, '478-08-2026', 'La Terrasse', 'M2', 150),
  ('2026-08-29'::date, '479-08-2026', 'Calypso', 'L2', 600),
  ('2026-08-29'::date, '482-08-2026', 'Linah', 'S1', 9),
  ('2026-08-29'::date, '483-08-2026', 'Linah', 'M1', 109),
  ('2026-08-29'::date, '484-08-2026', 'Nambinina', 'S2', 409),
  ('2026-08-29'::date, '486-08-2026', 'CFC', 'M1', 1022),
  ('2026-08-29'::date, '487-08-2026', 'Valpinson', 'M2', 55),
  ('2026-08-29'::date, '488-08-2026', 'Rahery', 'L1', 957),
  ('2026-08-29'::date, '490-08-2026', 'Naivo', 'L2', 26),
  ('2026-08-29'::date, '491-08-2026', 'Pompier', 'XL1', 229),
  ('2026-08-29'::date, '492-08-2026', 'EPP Tsiry', 'XL2', 82),
  ('2026-08-29'::date, '493-08-2026', 'Lasopy', 'CASSE', 48),
  ('2026-08-30'::date, '480-08-2026', 'Mercy Ships', 'M2', 410),
  ('2026-08-31'::date, '494-08-2026', 'La Terrasse', 'M2', 150),
  ('2026-08-31'::date, '495-08-2026', 'Mercy Ships', 'M2', 600),
  ('2026-08-31'::date, '496-08-2026', 'Fasankarana', 'S1', 10),
  ('2026-08-31'::date, '498-08-2026', 'Fasankarana', 'S2', 161),
  ('2026-08-31'::date, '500-08-2026', 'Nambinina', 'S2', 500),
  ('2026-08-31'::date, '501-08-2026', 'Mr Mamy', 'M1', 1300),
  ('2026-08-31'::date, '503-08-2026', 'Ambohijafy', 'M1', 618),
  ('2026-08-31'::date, '504-08-2026', 'CFC', 'M2', 1502),
  ('2026-08-31'::date, '507-08-2026', 'Rahery', 'L1', 1300),
  ('2026-08-31'::date, '508-08-2026', 'Damaskôsy', 'L1', 729),
  ('2026-08-31'::date, '511-08-2026', 'Naivo', 'L2', 1029),
  ('2026-08-31'::date, '512-08-2026', 'Patisserie Monique', 'L2', 400),
  ('2026-08-31'::date, '513-08-2026', 'Major Shop', 'XL1', 507),
  ('2026-08-31'::date, '514-08-2026', 'Pompier', 'XL1', 400),
  ('2026-08-31'::date, '515-08-2026', 'EPP Tsiry', 'XL2', 226),
  ('2026-08-31'::date, '516-08-2026', 'Chinoise', 'CASSE', 81)
),
prepare as (
  select md5('vente-carnet-' || k.numero)::uuid as vente_id,
         k.jour, k.numero, c.id as client_id, k.calibre, k.oeufs,
         coalesce(t.prix, cal.prix_base) as prix,
         c.nom in ('Leader Price', 'Mercy Ships', 'Calypso', 'Masteva',
                   'La braise', 'MadaRest', 'Mr Mamy') as credit
  from   carnet k
  join   clients c    on c.nom = k.client
  join   calibres cal on cal.code = k.calibre
  left   join tarifs_clients t on t.client_id = c.id and t.calibre = k.calibre
),
entetes as (
  insert into ventes (id, date, canal, client_id, montant, credit, numero_commande)
  select vente_id, jour, 'client', client_id, oeufs * prix, credit, numero
  from   prepare
  on conflict (id) do update
    set montant = excluded.montant, credit = excluded.credit,
        numero_commande = excluded.numero_commande
  returning id
)
insert into vente_lignes (vente_id, calibre, oeufs, prix_unit)
select vente_id, calibre, oeufs, prix from prepare
on conflict (vente_id, calibre) do update
  set oeufs = excluded.oeufs, prix_unit = excluded.prix_unit;

commit;

-- Contrôle. Œufs attendus par jour :
--   24/08 : 8529
--   25/08 : 5410
--   26/08 : 4871
--   27/08 : 4777
--   28/08 : 4805
--   29/08 : 4256
--   30/08 : 410
--   31/08 : 9513
select date, count(*) as livraisons, sum(montant) as ariary
from   ventes
where  date between '2026-08-24' and '2026-08-31' and canal = 'client'
group  by date order by date;

-- Doit renvoyer 97. Moins signifie qu'un nom de client n'a pas correspondu.
select count(*) from ventes
where  numero_commande like '%-08-2026' and date >= '2026-08-24';
