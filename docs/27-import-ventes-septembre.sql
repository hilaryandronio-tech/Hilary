-- =====================================================================
--  TAMA FERME — Les livraisons du 1er au 5 septembre 2026
--
--  Relevé sur le registre de commandes, transcrit depuis deux captures
--  d'écran. 49 lignes sur les 75 que compte le mois : le registre affiché
--  était filtré, les numéros manquants (010, 014, 016, 018…) n'y figuraient
--  pas. Il manquera donc des livraisons — à compléter si la feuille
--  complète ressort.
--
--  Prix : le tarif négocié du client quand il existe, sinon le prix de base
--  du calibre. C'est exactement ce que la caisse aurait appliqué.
--
--  Crédit : le registre ne dit pas qui a payé comptant. On considère à
--  crédit les clients qui ont un délai de paiement — Leader Price, Mercy
--  Ships, Mada-Rest, La braise, Mr Mamy — et payées comptant toutes les
--  autres. À corriger client par client si c'est faux : une vente marquée
--  payée à tort disparaît des créances.
--
--  Le numéro du carnet est posé explicitement, donc le compteur du mois
--  n'est pas touché : la prochaine vente saisie portera toujours 076.
--
--  Rejouable : l'identifiant de chaque vente est calculé à partir de son
--  numéro de bon, si bien qu'une seconde exécution ne crée pas de doublon.
-- =====================================================================

begin;

with carnet(jour, numero, client, calibre, oeufs) as (values
  ('2026-09-01'::date, '001-09-2026', 'Mercy Ships', 'M2', 540),
  ('2026-09-01'::date, '002-09-2026', 'Fasankarana', 'S1', 6),
  ('2026-09-01'::date, '003-09-2026', 'Angéline', 'S2', 302),
  ('2026-09-01'::date, '004-09-2026', 'CFC', 'M1', 958),
  ('2026-09-01'::date, '005-09-2026', 'Otiv', 'M2', 632),
  ('2026-09-01'::date, '006-09-2026', 'La Paillote', 'L1', 400),
  ('2026-09-01'::date, '007-09-2026', 'Rahery', 'L1', 633),
  ('2026-09-01'::date, '008-09-2026', 'Naivo', 'L2', 705),
  ('2026-09-01'::date, '009-09-2026', 'Major Shop', 'XL1', 285),
  ('2026-09-01'::date, '011-09-2026', 'Pompier', 'XL1', 200),
  ('2026-09-01'::date, '012-09-2026', 'EPP Tsiry', 'XL2', 96),
  ('2026-09-01'::date, '013-09-2026', 'Chinoise', 'CASSE', 49),
  ('2026-09-02'::date, '015-09-2026', 'Mercy Ships', 'M2', 600),
  ('2026-09-02'::date, '017-09-2026', 'Fasankarana', 'S1', 6),
  ('2026-09-02'::date, '020-09-2026', 'Fasankarana', 'S2', 57),
  ('2026-09-02'::date, '021-09-2026', 'Angéline', 'S2', 250),
  ('2026-09-02'::date, '023-09-2026', 'CFC', 'M1', 950),
  ('2026-09-02'::date, '026-09-2026', 'Otiv', 'M2', 620),
  ('2026-09-02'::date, '029-09-2026', 'Rahery', 'L1', 980),
  ('2026-09-02'::date, '031-09-2026', 'Naivo', 'L2', 734),
  ('2026-09-02'::date, '032-09-2026', 'Pompier', 'XL1', 200),
  ('2026-09-02'::date, '033-09-2026', 'Major Shop', 'XL1', 236),
  ('2026-09-02'::date, '035-09-2026', 'EPP Tsiry', 'XL2', 83),
  ('2026-09-02'::date, '037-09-2026', 'Chinoise', 'CASSE', 43),
  ('2026-09-03'::date, '038-09-2026', 'Mercy Ships', 'M2', 570),
  ('2026-09-03'::date, '040-09-2026', 'Leader Price', 'M1', 720),
  ('2026-09-03'::date, '042-09-2026', 'Linah', 'S1', 4),
  ('2026-09-03'::date, '044-09-2026', 'Linah', 'S2', 85),
  ('2026-09-03'::date, '045-09-2026', 'Nambinina', 'S2', 200),
  ('2026-09-03'::date, '047-09-2026', 'Otiv', 'M2', 631),
  ('2026-09-03'::date, '050-09-2026', 'Rahery', 'L1', 1053),
  ('2026-09-03'::date, '052-09-2026', 'Naivo', 'L2', 696),
  ('2026-09-03'::date, '054-09-2026', 'Major Shop', 'XL1', 254),
  ('2026-09-03'::date, '056-09-2026', 'Pompier', 'XL1', 200),
  ('2026-09-03'::date, '057-09-2026', 'EPP Tsiry', 'XL2', 117),
  ('2026-09-03'::date, '058-09-2026', 'Chinoise', 'CASSE', 55),
  ('2026-09-04'::date, '059-09-2026', 'Mercy Ships', 'M2', 570),
  ('2026-09-04'::date, '060-09-2026', 'Calypso', 'L2', 600),
  ('2026-09-04'::date, '061-09-2026', 'Nambinina', 'S2', 243),
  ('2026-09-04'::date, '063-09-2026', 'Damaskôsy', 'M1', 431),
  ('2026-09-04'::date, '065-09-2026', 'Otiv', 'M2', 546),
  ('2026-09-04'::date, '067-09-2026', 'Rahery', 'L1', 1078),
  ('2026-09-04'::date, '069-09-2026', 'Naivo', 'L2', 184),
  ('2026-09-04'::date, '070-09-2026', 'Pompier', 'XL1', 268),
  ('2026-09-04'::date, '071-09-2026', 'Major Shop', 'XL1', 300),
  ('2026-09-04'::date, '072-09-2026', 'EPP Tsiry', 'XL2', 164),
  ('2026-09-04'::date, '073-09-2026', 'Lasopy', 'CASSE', 61),
  ('2026-09-05'::date, '074-09-2026', 'Mercy Ships', 'M2', 570),
  ('2026-09-05'::date, '075-09-2026', 'La Terrasse', 'M2', 150)
),
prepare as (
  select md5('vente-carnet-' || k.numero)::uuid as vente_id,
         k.jour, k.numero, c.id as client_id,
         k.calibre, k.oeufs,
         coalesce(t.prix, cal.prix_base) as prix,
         c.delai_paiement_jours > 0 as credit
  from   carnet k
  join   clients c  on c.nom = k.client
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

-- Contrôle : les totaux par jour. Attendus, en œufs —
--   01/09 : 4806 · 02/09 : 4759 · 03/09 : 4585 · 04/09 : 4445 · 05/09 : 720
--   02/09 : 4759
--   03/09 : 4585
--   04/09 : 4445
--   05/09 : 720
select date, count(*) as livraisons, sum(montant) as ariary
from   ventes
where  date between '2026-09-01' and '2026-09-05' and canal = 'client'
group  by date order by date;

-- Un client du carnet absent de la base n'aurait rien inséré, en silence.
-- Cette requête doit renvoyer 49.
select count(*) from ventes where numero_commande like '%-09-2026' and canal = 'client';
