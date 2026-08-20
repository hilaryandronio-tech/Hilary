-- =====================================================================
--  TAMA FERME — Corriger le stock de provende après un comptage
--
--  À exécuter dans Supabase > SQL Editor AVANT de déployer la version de
--  l'application qui accompagne ce fichier. Rejouable.
--
--  Le reste en magasin est calculé — entré moins distribué — et non saisi.
--  Il dérive donc de la réalité : un sac non noté, une distribution
--  oubliée, et l'écart s'installe sans que rien ne le rattrape.
--
--  Le chef de ferme doit pouvoir compter les sacs et caler l'application
--  sur ce qu'il voit. Une correction est une entrée de stock comme une
--  autre, au signe près : elle peut être négative quand le magasin
--  contient moins que prévu. D'où la levée du `sacs > 0`, et un `motif`
--  pour distinguer une correction d'une vraie livraison.
-- =====================================================================

alter table livraisons_provende
  drop constraint if exists livraisons_provende_sacs_check;

alter table livraisons_provende
  add  constraint livraisons_provende_sacs_check check (sacs <> 0);

alter table livraisons_provende
  add column if not exists motif text;


-- =====================================================================
--  « Dernière livraison » ne doit compter que les vraies livraisons :
--  une correction de comptage n'est pas un arrivage, et l'afficher comme
--  tel ferait croire à un réapprovisionnement qui n'a pas eu lieu.
-- =====================================================================

create or replace view v_stock_provende as
select l.id                                       as lot_id,
       l.nom,
       coalesce(liv.kg, 0)                        as recu_kg,
       coalesce(dis.kg, 0)                        as distribue_kg,
       coalesce(liv.kg, 0) - coalesce(dis.kg, 0)  as stock_kg,
       coalesce(conso.moyenne, 0)                 as conso_jour_kg,
       liv.derniere_livraison
from   lots l
left   join (select lot_id,
                    sum(sacs * poids_sac)                          as kg,
                    max(date) filter (where motif is null)         as derniere_livraison
             from   livraisons_provende group by lot_id) liv on liv.lot_id = l.id
left   join (select lot_id, sum(provende_kg) as kg
             from   saisies_ferme group by lot_id) dis on dis.lot_id = l.id
left   join (select lot_id, avg(provende_kg) as moyenne
             from   saisies_ferme
             where  provende_kg > 0
               and  date > current_date - 7
             group  by lot_id) conso on conso.lot_id = l.id
where  l.actif;
