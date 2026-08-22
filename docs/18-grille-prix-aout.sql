-- =====================================================================
--  TAMA FERME — Grille de prix d'août, et rattrapage des ventes saisies
--
--  La période de test est terminée. Deux grilles se succèdent :
--    du 1er au 10 août   S1 650  S2 670  M1 690  M2 700
--                        L1 720  L2 720  XL1 750  XL2 800  CASSE 600
--    du 11 août à ce jour S1 650  S2 680  M1 700  M2 720
--                        L1 740  L2 740  XL1 760  XL2 800  CASSE 600
--  Les cassés sont à 600 Ar sur toute la période, d'où le même chiffre
--  dans les deux grilles.
--
--  Pourquoi un rattrapage : `vente_lignes.prix_unit` fige le prix au moment
--  de la vente, et `ventes.montant` en découle. Changer `calibres.prix_base`
--  ne corrige donc que l'avenir — les ventes d'août garderaient les prix de
--  test. Les deux premiers UPDATE réécrivent ces prix figés, le troisième
--  recalcule les montants, le quatrième pose la grille courante.
--
--  Les tarifs négociés l'emportent sur la grille : la consigne vise « les
--  clients normaux ». Calypso, Leader Price, La Terrasse, Mercy Ships,
--  Masteva et Mr Mamy gardent leur prix contractuel — le L1 de Mr Mamy à
--  730 Ar passe ainsi sous le prix normal de 740, c'est voulu, c'est sa
--  remise de grossiste.
--
--  Deux limites à connaître :
--   - une recette saisie en montant global n'a pas de lignes par calibre,
--     donc rien à recalculer ; elle reste telle quelle.
--   - `v_journalier.valeur_collecte` n'est pas figée, elle multiplie les
--     œufs collectés par le prix courant. Toute l'histoire, juin et juillet
--     compris, est donc revalorisée à la grille d'août. Il faudrait une
--     table de prix datés pour que chaque mois garde la sienne.
--
--  Tout est dans une transaction : si une instruction échoue, rien ne passe.
-- =====================================================================

begin;

-- 1. Prix figés des ventes du 1er au 10 août
update vente_lignes vl
set    prix_unit = coalesce(
         (select t.prix from tarifs_clients t
          where t.client_id = v.client_id and t.calibre = vl.calibre),
         g.prix)
from   ventes v,
       (values ('S1',650),('S2',670),('M1',690),('M2',700),
               ('L1',720),('L2',720),('XL1',750),('XL2',800),('CASSE',600)) as g(code, prix)
where  v.id = vl.vente_id
  and  g.code = vl.calibre
  and  v.date between '2026-08-01' and '2026-08-10';

-- 2. Prix figés des ventes du 11 août à aujourd'hui
update vente_lignes vl
set    prix_unit = coalesce(
         (select t.prix from tarifs_clients t
          where t.client_id = v.client_id and t.calibre = vl.calibre),
         g.prix)
from   ventes v,
       (values ('S1',650),('S2',680),('M1',700),('M2',720),
               ('L1',740),('L2',740),('XL1',760),('XL2',800),('CASSE',600)) as g(code, prix)
where  v.id = vl.vente_id
  and  g.code = vl.calibre
  and  v.date >= '2026-08-11';

-- 3. Montants des ventes, refaits depuis leurs lignes. Les ventes sans
--    lignes — recettes globales — n'ont pas de ligne dans la sous-requête
--    et ne sont pas touchées.
update ventes v
set    montant = s.total
from  (select vente_id, sum(oeufs * prix_unit) as total
       from   vente_lignes group by vente_id) s
where  s.vente_id = v.id
  and  v.date >= '2026-08-01';

-- 4. Grille courante, celle que la caisse lira désormais
update calibres
set    prix_base = g.prix
from  (values ('S1',650),('S2',680),('M1',700),('M2',720),
              ('L1',740),('L2',740),('XL1',760),('XL2',800),('CASSE',600)) as g(code, prix)
where  calibres.code = g.code;

commit;

-- Contrôle : la grille courante.
select code, ordre, prix_base from calibres order by ordre;
