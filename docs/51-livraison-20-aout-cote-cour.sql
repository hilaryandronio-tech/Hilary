-- =====================================================================
--  TAMA FERME — La livraison du 20 août qui revient à Côté cour
--
--  À exécuter dans Supabase > SQL Editor. Rejouable.
--
--  Deux livraisons le 20 août, 150 œufs L2 à 800 Ar chacune, toutes deux
--  au compte de La braise. Le gérant confirme qu'il y en a bien eu deux :
--  une pour chaque établissement.
--
--  Celle du carnet, bon 323-08-2026, est celle de Côté cour — sa facture
--  F-20260820-075241 porte le 69 boulevard joffre et le +261 34 12 456 13,
--  c'est-à-dire ses coordonnées et non celles du Club Nautique. L'autre,
--  bon 205-08-2026, reste à La braise.
--
--  Les deux étaient un seul client jusqu'à leur séparation : le carnet a
--  donc tout inscrit sous « La braise », faute d'autre compte. C'est ce
--  que cette ligne répare.
--
--  Ce que ça déplace : 120 000 Ar de créance impayée passent de La braise
--  à Côté cour. Le prix ne bouge pas — les deux ont le L2 négocié à
--  800 Ar (docs/19), et `vente_lignes.prix_unit` est de toute façon figé.
--
--  La vente est désignée par son identifiant d'import, pas par son numéro
--  de bon. Les numéros ne sont pas uniques — le 205-08-2026 de La braise
--  appartient dans le carnet à Naivo (docs/50) — et viser par le numéro
--  est ce qui a fait manquer des lignes hier.
-- =====================================================================

update ventes
   set client_id = (select id from clients where nom = 'Côté cour')
 where id = md5('vente-carnet-323-08-2026')::uuid;


-- Contrôle : août, les deux comptes côte à côte. Une livraison chez Côté
-- cour le 20, trois chez La braise — le 4, le 19 et le 20.
select c.nom, v.date, v.numero_commande, v.numero_facture, v.montant, v.credit
from   ventes v
join   clients c on c.id = v.client_id
where  c.nom in ('La braise', 'Côté cour')
  and  v.date between '2026-08-01' and '2026-08-31'
order  by c.nom, v.date;
