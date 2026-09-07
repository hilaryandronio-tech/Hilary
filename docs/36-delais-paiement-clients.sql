-- =====================================================================
--  TAMA FERME — Les délais de paiement négociés, client par client
--
--  À exécuter dans Supabase > SQL Editor. Rejouable.
--
--  Cinq clients règlent à terme et non à la livraison. Leur facture doit
--  l'annoncer : « Condition de paiement: 30 jours à date de facture »
--  plutôt que « Payé comptant ». Calypso, Masteva et Côté cour passaient
--  au comptant faute d'avoir été renseignés.
--
--  MadaRest est un cas à part : docs/24 lui avait posé cinq jours, relevés
--  sur sa facture du 27 août. Le gérant donne dix. C'est lui qui tranche,
--  la facture d'août portait l'ancien délai.
--
--  Leader Price est déjà à trente depuis docs/24 ; la ligne le confirme
--  sans le changer.
--
--  Ce champ ne fait qu'écrire une mention sur la facture. Il ne met pas la
--  vente à crédit — c'est la caisse qui le décide, livraison par livraison,
--  et le recouvrement continue de se lire dans l'écran Créances.
-- =====================================================================

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


-- Contrôle : les cinq doivent être « ok ». Un « CLIENT INTROUVABLE » veut
-- dire que le nom en base s'écrit autrement — la requête suivante le
-- cherchera.
select v.nom, v.jours as voulu, c.delai_paiement_jours as en_base,
       case when c.id is null then 'CLIENT INTROUVABLE' else 'ok' end as etat
from  (values ('Calypso',30),('Masteva',30),('Côté cour',30),
              ('MadaRest',10),('Leader Price',30)) as v(nom, jours)
left  join clients c on c.nom = v.nom
order by etat desc, v.nom;

-- À lancer seulement si « Côté cour » est introuvable : retrouver son
-- orthographe exacte en base avant de corriger la ligne ci-dessus.
select nom, actif, delai_paiement_jours
from   clients
where  nom ilike '%cour%' or nom ilike '%cot%' or nom ilike '%côt%'
order  by nom;
