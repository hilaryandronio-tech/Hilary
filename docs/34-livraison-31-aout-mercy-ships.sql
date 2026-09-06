-- =====================================================================
--  TAMA FERME — La livraison Mercy Ships du 31 août, absente de la base
--
--  À exécuter dans Supabase > SQL Editor. Rejouable.
--
--  La facture de la semaine du 31 août au 6 septembre ne comptait que six
--  jours. Le 31 août n'y était pas : le carnet porte pourtant le bon
--  495-08-2026, 600 œufs M2, facturé F-20260831-084102. La ligne existe
--  dans docs/30 mais n'a pas atteint la base — l'import n'est pas allé au
--  bout, ou la vente a été effacée depuis.
--
--  On ne rejoue pas docs/30 en entier : depuis le 5 septembre l'équipe
--  saisit dans l'application, et une réexécution complète réécrirait au
--  prix du carnet des ventes corrigées à la main entre-temps. Ce fichier
--  ne touche donc que la ligne manquante.
--
--  L'identifiant dérive du numéro de bon, comme dans docs/30 : si le grand
--  import est un jour rejoué, il retrouvera cette vente et la mettra à
--  jour au lieu d'en créer une seconde.
-- =====================================================================

begin;

with carnet(jour, numero, client, calibre, oeufs, prix_grille, facture) as (values
  ('2026-08-31'::date,'495-08-2026','Mercy Ships','M2',600,720,'F-20260831-084102')
),
prepare as (
  select md5('vente-carnet-' || k.numero)::uuid as vente_id,
         k.jour, k.numero, k.facture, c.id as client_id, k.calibre, k.oeufs,
         coalesce(t.prix, k.prix_grille) as prix,
         -- Mercy Ships est réglé à trente jours : la vente est à crédit,
         -- comme toutes les siennes dans docs/30.
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


-- Contrôle : la semaine complète. Doit renvoyer 7 livraisons, 4 005 œufs,
-- 4 005 000 Ar — les 3 405 000 constatés plus les 600 œufs du 31 août.
select count(distinct v.id)                                  as livraisons,
       sum(l.oeufs)                                          as oeufs,
       sum(l.oeufs * coalesce(tc.prix_facture, l.prix_unit)) as total_facture_ar
from   ventes v
join   vente_lignes l on l.vente_id = v.id
join   clients c      on c.id = v.client_id
left   join tarifs_clients tc
       on tc.client_id = c.id and tc.calibre = l.calibre
where  c.nom = 'Mercy Ships'
  and  v.date between date '2026-08-31' and date '2026-09-06';
