-- =====================================================================
--  TAMA FERME — Les trois dernières livraisons du carnet absentes
--
--  À exécuter dans Supabase > SQL Editor. Rejouable.
--
--  docs/50 a cherché par identifiant d'import, et non plus par numéro de
--  bon, et n'a trouvé que quatre lignes du carnet sans vente. Vérification
--  faite client par client et date par date, trois manquent vraiment :
--
--    Linah        1er août  S1     3 œufs   — le carnet a 005 et 006, la
--                                             base n'a que 006
--    Fasankarana  3 août    S1     9 œufs   — le carnet a 022 et 023, la
--                                             base n'a que 023
--    Mercy Ships  31 août   M2   600 œufs   — rien ce jour-là
--
--  La quatrième n'en est pas une : la vente Sainte Marie du 1er août
--  existe, sous le bon 017-08-2026 et pour 1 070 œufs M1, là où le carnet
--  l'inscrit sous 008-08-2026 pour 1 071. Même livraison, un œuf d'écart,
--  et un numéro de bon qui appartient dans le carnet à Chinoise. On n'y
--  touche pas : la réinsérer ferait un doublon de 749 000 Ar.
--
--  Celle de Mercy Ships est la plus lourde, et la plus tenace : c'est par
--  elle que tout a commencé, sa facture de semaine ne comptait que six
--  jours. docs/34 puis docs/48 auraient dû la remettre. Je ne sais pas
--  pourquoi ni l'un ni l'autre ne l'a fait — le contrôle ci-dessous dira
--  au moins si celui-ci y parvient.
-- =====================================================================

begin;

with carnet(jour, numero, client, calibre, oeufs, prix_grille, facture) as (values
  ('2026-08-01'::date,'005-08-2026','Linah','S1',3,650,'F-20260802-133216'),
  ('2026-08-03'::date,'022-08-2026','Fasankarana','S1',9,650,'F-20260804-064657'),
  ('2026-08-31'::date,'495-08-2026','Mercy Ships','M2',600,720,'F-20260831-084102')
),
prepare as (
  select md5('vente-carnet-' || k.numero)::uuid as vente_id,
         k.jour, k.numero, k.facture, c.id as client_id, k.calibre, k.oeufs,
         coalesce(t.prix, k.prix_grille) as prix,
         c.nom in ('Leader Price','Mercy Ships','Calypso','Masteva',
                   'La braise','MadaRest','Mr Mamy') as credit
  from   carnet k
  join   clients c on c.nom = k.client
  left   join tarifs_clients t on t.client_id = c.id and t.calibre = k.calibre
),
entetes as (
  insert into ventes (id, date, canal, client_id, montant, credit,
                      numero_commande, numero_facture)
  select vente_id, jour, 'client', client_id, oeufs * prix, credit, numero, facture
  from   prepare
  on conflict (id) do nothing
  returning id
)
insert into vente_lignes (vente_id, calibre, oeufs, prix_unit)
select vente_id, calibre, oeufs, prix from prepare
on conflict (vente_id, calibre) do nothing;

commit;


-- =====================================================================
--  Contrôle 1 : les trois doivent être « ok ». Un « MANQUE » veut dire
--  que l'insertion a de nouveau été sautée, et il faudra chercher
--  pourquoi du côté du nom du client — la jointure est muette.
-- =====================================================================

select k.numero as bon, k.client,
       case when exists (select 1 from ventes v
                         where  v.id = md5('vente-carnet-' || k.numero)::uuid)
            then 'ok' else 'MANQUE' end as etat
from  (values ('005-08-2026','Linah'),
              ('022-08-2026','Fasankarana'),
              ('495-08-2026','Mercy Ships')) as k(numero, client);


-- =====================================================================
--  Contrôle 2 : la semaine de Mercy Ships, du 31 août au 6 septembre.
--  Sept livraisons, 4 005 œufs — c'est la facture par laquelle tout a
--  commencé.
-- =====================================================================

select count(distinct v.id) as livraisons,
       sum(l.oeufs)         as oeufs
from   ventes v
join   vente_lignes l on l.vente_id = v.id
join   clients c      on c.id = v.client_id
where  c.nom = 'Mercy Ships'
  and  v.date between date '2026-08-31' and date '2026-09-06';
