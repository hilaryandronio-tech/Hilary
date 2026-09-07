-- =====================================================================
--  TAMA FERME — Les six migrations en attente, en une seule passe
--
--  À exécuter dans Supabase > SQL Editor. Rejouable, et sans effet sur ce
--  qui a déjà été passé : chaque instruction reprise ici est idempotente.
--
--  Ce fichier n'apporte rien de neuf. Il rejoue docs/34 à docs/40 dans
--  l'ordre, pour n'avoir qu'un seul copier-coller à faire au lieu de six.
--  Les fichiers d'origine gardent les explications ; celui-ci ne garde
--  que les instructions.
--
--    34  la livraison Mercy Ships du 31 août, absente de la base
--    35  Mvola et compte bancaire sur toutes les factures
--    36  les délais négociés : Calypso, Masteva, Côté cour 30 j ;
--        MadaRest 10 j ; Leader Price 30 j
--    37  Côté cour rouvert, établissement séparé de La braise
--    38  le calibre de la vente du 20 août, M2 corrigé en L2
--    39  les mentions de facture de Côté cour
--    40  les mentions de facture de La braise
--
--  Le contrôle est en fin de fichier : dans l'éditeur Supabase, seul le
--  résultat de la dernière requête s'affiche.
-- =====================================================================


-- ---------------------------------------------------------------- 34 --
begin;

with carnet(jour, numero, client, calibre, oeufs, prix_grille, facture) as (values
  ('2026-08-31'::date,'495-08-2026','Mercy Ships','M2',600,720,'F-20260831-084102')
),
prepare as (
  select md5('vente-carnet-' || k.numero)::uuid as vente_id,
         k.jour, k.numero, k.facture, c.id as client_id, k.calibre, k.oeufs,
         coalesce(t.prix, k.prix_grille) as prix,
         true as credit
  from   carnet k
  join   clients c on c.nom = k.client
  left   join tarifs_clients t on t.client_id = c.id and t.calibre = k.calibre
),
entetes as (
  insert into ventes (id, date, canal, client_id, montant, credit,
                      numero_commande, numero_facture)
  select vente_id, jour, 'client', client_id, oeufs * prix, credit, numero, facture
  from   prepare
  on conflict (id) do update
    set montant = excluded.montant, credit = excluded.credit,
        numero_commande = excluded.numero_commande,
        numero_facture = excluded.numero_facture
  returning id
)
insert into vente_lignes (vente_id, calibre, oeufs, prix_unit)
select vente_id, calibre, oeufs, prix from prepare
on conflict (vente_id, calibre) do update
  set oeufs = excluded.oeufs, prix_unit = excluded.prix_unit;

commit;


-- ---------------------------------------------------------------- 35 --
alter table clients
  alter column coordonnees_paiement set default true;

update clients set coordonnees_paiement = true  where nom <> 'Leader Price';
update clients set coordonnees_paiement = false where nom  = 'Leader Price';


-- ---------------------------------------------------------------- 36 --
with voulu(nom, jours) as (values
  ('Calypso',      30),
  ('Masteva',      30),
  ('Côté cour',    30),
  ('MadaRest',     10),
  ('Leader Price', 30)
)
update clients c
   set delai_paiement_jours = v.jours
  from voulu v
 where c.nom = v.nom;


-- ---------------------------------------------------------------- 37 --
update clients set
  actif = true,
  conditionnement = 1,
  delai_paiement_jours = 30,
  coordonnees_paiement = true
where nom = 'Côté cour';

insert into tarifs_clients (client_id, calibre, prix)
select c.id, 'L2', 800 from clients c where c.nom = 'Côté cour'
on conflict (client_id, calibre) do update set prix = excluded.prix;


-- ---------------------------------------------------------------- 38 --
begin;

update vente_lignes l
   set calibre = 'L2', prix_unit = 800
  from ventes v
 where v.id = l.vente_id
   and v.numero_commande = '323-08-2026'
   and l.calibre = 'M2';

update ventes v
   set montant = s.total
  from (select vente_id, sum(oeufs * prix_unit) as total
        from   vente_lignes group by vente_id) s
 where s.vente_id = v.id
   and v.numero_commande = '323-08-2026';

commit;


-- ---------------------------------------------------------------- 39 --
update clients set
  nom_facture   = 'Coté cour',
  adresse       = E'69 boulevard joffre,\nToamasina 501, Madagascar',
  telephone_fac = '+261 34 12 456 13'
where nom = 'Côté cour';


-- ---------------------------------------------------------------- 40 --
update clients set
  nom_facture   = 'La braise',
  adresse       = E'Club Nautique et de Tennis\nBoulevard Ratsimilaho\nToamasina, Madagascar',
  telephone_fac = '+261372880784'
where nom = 'La braise';


-- =====================================================================
--  Contrôle unique. Sept lignes, toutes à « ok ».
-- =====================================================================

select * from (
  select 1 as n, 'Mercy Ships 31/08' as verifie,
         case when exists (select 1 from ventes
                           where numero_commande = '495-08-2026')
              then 'ok' else 'MANQUE' end as etat
  union all
  select 2, 'Semaine Mercy Ships 31/08-06/09 : 7 livraisons',
         case when (select count(distinct v.id) from ventes v
                    join clients c on c.id = v.client_id
                    where c.nom = 'Mercy Ships'
                      and v.date between '2026-08-31' and '2026-09-06') = 7
              then 'ok' else 'INCOMPLET' end
  union all
  select 3, 'Coordonnees de paiement : Leader Price seul exclu',
         case when (select count(*) from clients
                    where actif and not coordonnees_paiement) = 1
              then 'ok' else 'A REVOIR' end
  union all
  select 4, 'Delais : Calypso/Masteva/Cote cour 30 j, MadaRest 10 j',
         case when (select count(*) from clients
                    where (nom in ('Calypso','Masteva','Côté cour')
                           and delai_paiement_jours = 30)
                       or (nom = 'MadaRest' and delai_paiement_jours = 10)) = 4
              then 'ok' else 'A REVOIR' end
  union all
  select 5, 'Cote cour rouvert, tarif L2 a 800',
         case when exists (select 1 from clients c
                           join tarifs_clients t
                             on t.client_id = c.id and t.calibre = 'L2'
                           where c.nom = 'Côté cour' and c.actif and t.prix = 800)
              then 'ok' else 'A REVOIR' end
  union all
  select 6, 'Vente du 20/08 : L2 a 800, 120 000 Ar',
         case when exists (select 1 from ventes v
                           join vente_lignes l on l.vente_id = v.id
                           where v.numero_commande = '323-08-2026'
                             and l.calibre = 'L2' and l.prix_unit = 800
                             and v.montant = 120000)
              then 'ok' else 'A REVOIR' end
  union all
  select 7, 'Noms imprimes distincts',
         case when (select count(distinct nom_facture) from clients
                    where nom in ('La braise','Côté cour')) = 2
              then 'ok' else 'A REVOIR' end
) t order by n;
