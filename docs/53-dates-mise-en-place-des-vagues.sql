-- =====================================================================
--  TAMA FERME — Les vraies dates de mise en place des trois vagues
--
--  À exécuter dans Supabase > SQL Editor. Rejouable.
--
--  docs/01 avait posé ces dates en relatif — `current_date - 294`, `- 217`,
--  `- 84` — comme valeurs de démarrage, le jour où le schéma a été créé.
--  Elles n'ont jamais été remplacées. L'âge affiché était donc calculé
--  depuis une date arbitraire, et il vieillissait au rythme du calendrier
--  sans jamais être juste.
--
--  Les dates réelles, données par le gérant :
--
--    V1  19 février 2025
--    V2  30 avril 2025
--    V3  10 juin 2026
--
--  Ce que ça change, au 7 septembre 2026 : V1 passe de 46 à 80 semaines,
--  V2 de 35 à 70. V3 ne bouge pas — ses 12 semaines tombaient juste par
--  hasard, la valeur de démarrage était proche.
--
--  Rien d'autre ne dépend de cette colonne : ni la production, ni les
--  ventes, ni les créances. Seul l'âge affiché à l'écran Ferme, et le
--  jugement qu'on porte dessus.
-- =====================================================================

update lots set date_mise_en_place = date '2025-02-19' where id = 'V1';
update lots set date_mise_en_place = date '2025-04-30' where id = 'V2';
update lots set date_mise_en_place = date '2026-06-10' where id = 'V3';


-- Contrôle : les trois vagues, leur date et leur âge. Au 7 septembre 2026,
-- 80, 70 et 12 semaines.
select l.id,
       l.nom,
       l.date_mise_en_place,
       current_date - l.date_mise_en_place            as jours,
       floor((current_date - l.date_mise_en_place) / 7.0)::int as semaines,
       l.en_ponte
from   lots l
where  l.actif
order  by l.id;
