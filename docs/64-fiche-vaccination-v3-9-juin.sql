-- =====================================================================
--  TAMA FERME — La fiche de vaccination du 9 juin 2026, 3ème vague
--
--  À exécuter dans Supabase > SQL Editor. Rejouable.
--
--  Le Shop a redonné la fiche de la V3 (« Fiche vaccination TAMA FERME
--  9 Juin 2026.xlsx » — MEF 2026-06-09, cheptel 3 300, lot 49). Ses dates
--  ne sont pas celles saisies par docs/10, qui venaient de la version
--  précédente : neuf lignes sur quinze ont bougé.
--
--  Ce que ça change de visible : l'anticoccidien des 12 semaines était
--  affiché « en retard » depuis le 6 septembre. Le Shop le place du 19 au
--  21 septembre — il n'est pas en retard, il est à venir.
--
--  Les dates réalisées ne sont pas touchées : les lignes sont corrigées
--  sur place, jamais supprimées puis réinsérées, et ce que le chef a coché
--  reste coché. Dix interventions le sont déjà, et leurs dates réelles
--  tombent sur celles de cette fiche-ci — c'est bien elle qui a été suivie
--  au poulailler pendant que l'application affichait les anciennes.
-- =====================================================================


-- =====================================================================
--  Lasota et IBH120 : une ligne devient deux
--
--  L'ancienne fiche les donnait ensemble, « 18 andro ». Celle-ci les
--  sépare — Lasota à 14 andro, IBH120 à 24 andro — mais fusionne leur
--  case de date sur les deux lignes : un seul passage, le 27 juin. C'est
--  le jour où le chef les a notés faits.
--
--  L'insertion d'abord, tant que l'ancienne ligne porte encore son nom :
--  elle reprend sa date réalisée, puisque les deux vaccins sont partis
--  dans le même geste.
-- =====================================================================

insert into interventions (lot_id, type, libelle, age, date_prevue, date_fin_prevue,
                           date_realisee, technicien)
select 'V3', 'vaccination', 'IBH120', '24 andro', date '2026-06-27', null,
       date_realisee, technicien
from   interventions
where  lot_id = 'V3' and libelle = 'Lasota + IBH120'
on conflict (lot_id, type, libelle, date_prevue) do nothing;

update interventions set
  libelle = 'Lasota', age = '14 andro',
  date_prevue = date '2026-06-27', date_fin_prevue = null
where lot_id = 'V3' and libelle = 'Lasota + IBH120';


-- =====================================================================
--  Les vaccinations, telles que la fiche les date
--
--  L'âge sert de repère : il est unique dans le calendrier de la vague, et
--  il ne bouge pas quand les dates bougent. Viser le libellé seul ferait
--  quatre anticoccidiens d'un coup.
-- =====================================================================

-- 30 andro · POX — une seule journée, le 17 juillet, là où l'ancienne
-- fiche ouvrait une fenêtre du 9 au 13.
update interventions set date_prevue = date '2026-07-17', date_fin_prevue = null
where lot_id = 'V3' and age = '30 andro';

-- 6 herinandro · IB-ND — « 28-29 juillet 2026 », écrit en toutes lettres.
update interventions set date_prevue = date '2026-07-28', date_fin_prevue = date '2026-07-29'
where lot_id = 'V3' and age = '6 herinandro';

-- 7 herinandro · Fowl Cholera
update interventions set date_prevue = date '2026-08-08', date_fin_prevue = null
where lot_id = 'V3' and age = '7 herinandro';

-- 11 herinandro · Fowl Cholera. La fiche réécrit simplement « Fowl
-- Cholera » ; on garde « — rappel », qui distingue les deux lignes dans
-- l'écran sans rien contredire.
update interventions set date_prevue = date '2026-09-08', date_fin_prevue = null
where lot_id = 'V3' and age = '11 herinandro';

-- 17 semaines · IB-ND-EDS — le 5 octobre seul, et non une semaine entière.
update interventions set date_prevue = date '2026-10-05', date_fin_prevue = null
where lot_id = 'V3' and age = '17 semaines';


-- =====================================================================
--  Les traitements
--
--  La fiche donne pour chacun une durée — trois jours l'anticoccidien, un
--  jour le vermifuge — puis une date de début et une de fin.
-- =====================================================================

-- 1 semaine · Débecquage — inchangé, le 19 juin.
update interventions set date_prevue = date '2026-06-19', date_fin_prevue = null
where lot_id = 'V3' and age = '1 semaine';

-- 4 semaines · Anticoccidien — du 6 au 11 juillet. Six jours, seule ligne
-- du tableau dont la colonne « durée » est restée vide : voir la note en
-- fin de fichier.
update interventions set date_prevue = date '2026-07-06', date_fin_prevue = date '2026-07-11'
where lot_id = 'V3' and age = '4 semaines';

-- 6 semaines · Anticoccidien — la fiche porte « 3 jours » mais aucune
-- date. La ligne existante est déjà cochée, faite le 15 juillet : on la
-- laisse telle quelle plutôt que d'inventer une fenêtre ou d'effacer un
-- traitement qui a bien eu lieu.

-- 8 semaines · Vermifuge — le 14 août, un jour.
update interventions set date_prevue = date '2026-08-14', date_fin_prevue = null
where lot_id = 'V3' and age = '8 semaines';

-- 9 semaines · Anticoccidien — du 26 au 28 août. L'ancienne fiche disait
-- du 9 au 11 août, et c'est au 9 août que la ligne est cochée : voir la
-- note en fin de fichier.
update interventions set date_prevue = date '2026-08-26', date_fin_prevue = date '2026-08-28'
where lot_id = 'V3' and age = '9 semaines';

-- 12 semaines · Anticoccidien — du 19 au 21 septembre. C'est la ligne qui
-- s'affichait « en retard » depuis le 6.
update interventions set date_prevue = date '2026-09-19', date_fin_prevue = date '2026-09-21'
where lot_id = 'V3' and age = '12 semaines';

-- 15 semaines · Vermifuge — le 28 septembre, et non le 20.
update interventions set date_prevue = date '2026-09-28', date_fin_prevue = null
where lot_id = 'V3' and age = '15 semaines';

-- 19 semaines · Vermifuge — inchangé, le 19 octobre.
update interventions set date_prevue = date '2026-10-19', date_fin_prevue = null
where lot_id = 'V3' and age = '19 semaines';


-- =====================================================================
--  Contrôle : le calendrier de la V3, dans l'ordre, avec ce qui est fait.
-- =====================================================================

select age, type, libelle, date_prevue, date_fin_prevue, date_realisee
from   interventions
where  lot_id = 'V3'
order  by date_prevue, libelle;

-- Contrôle : la fiche annonce 3 300 sujets et la mise en ferme au 9 juin.
-- Rien n'est modifié ici — l'effectif initial commande la mortalité et
-- l'âge affiché, il ne se corrige pas sans savoir ce qu'il vaut déjà.
select id, date_mise_en_place, effectif_initial, prix_provende_kg
from   lots where id = 'V3';


-- =====================================================================
--  Deux questions que la fiche laisse ouvertes
--
--  1. L'anticoccidien des 4 semaines couvre six jours (6 → 11 juillet)
--     et sa colonne « durée » est vide, quand tous les autres portent
--     « 3 jours ». Deux cures de trois jours à la suite, ou une erreur de
--     recopie ? Si le Shop dit une seule cure, resserrer la fenêtre :
--
--     update interventions set date_fin_prevue = date '2026-07-08'
--     where lot_id = 'V3' and age = '4 semaines';
--
--  2. L'anticoccidien des 9 semaines est coché au 9 août — la date de
--     l'ancienne fiche — alors que celle-ci le place du 26 au 28 août.
--     S'il a bien été donné le 9 août, la cure du 26 n'a pas eu lieu et
--     la ligne doit être rouverte pour qu'elle revienne à faire :
--
--     update interventions set date_realisee = null
--     where lot_id = 'V3' and age = '9 semaines';
-- =====================================================================
