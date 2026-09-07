-- =====================================================================
--  TAMA FERME — L'âge compté en semaine en cours, et non en semaines
--  révolues
--
--  À exécuter dans Supabase > SQL Editor. Rejouable.
--
--  La vue arrondissait vers le bas : V1, placée le 19 février 2025, a
--  565 jours au 7 septembre 2026, soit 80 semaines pleines et 5 jours.
--  L'écran affichait donc 80. Le gérant compte 81, et c'est la convention
--  du métier : on nomme la semaine en cours, pas celle qu'on vient de
--  finir. Les guides d'élevage indexent leurs tables de la même façon —
--  « semaine 81 » couvre les jours 561 à 567.
--
--  Un `ceil` au lieu d'un `floor`, donc. Au 7 septembre 2026 :
--
--    V1  565 jours  →  81 semaines   (au lieu de 80)
--    V2  495 jours  →  71 semaines   (au lieu de 70)
--    V3   89 jours  →  13 semaines   (au lieu de 12)
--
--  Rien ne calcule sur cette colonne : ni la production, ni la provende,
--  ni l'amortissement des poulettes, qui a son propre paramètre
--  `duree_ponte_sem`. Elle ne sert qu'à être lue.
--
--  Le reste de la vue est recopié tel quel de docs/09 — `create or
--  replace` exige les mêmes colonnes, dans le même ordre.
-- =====================================================================

create or replace view v_effectif as
select l.id                 as lot_id,
       l.nom,
       l.en_ponte,
       l.effectif_initial,
       l.effectif_initial - coalesce(sum(s.mortalite), 0) as vivant,
       -- Semaine en cours : le jour de la mise en place, la vague est à
       -- zéro ; elle passe en semaine 1 dès le lendemain, et en semaine 81
       -- au 561e jour.
       ceil((current_date - l.date_mise_en_place) / 7.0)::int as age_semaines,
       l.prix_provende_kg
from   lots l
left   join saisies_ferme s on s.lot_id = l.id
where  l.actif
group  by l.id;


-- Contrôle : 81, 71 et 13 semaines au 7 septembre 2026.
select lot_id, nom, en_ponte, vivant, age_semaines
from   v_effectif
order  by lot_id;
