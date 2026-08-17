-- =====================================================================
--  TAMA FERME — Adopter une fiche créée hors de l'application
--
--  À exécuter dans Supabase > SQL Editor AVANT de déployer la version de
--  l'application qui accompagne ce fichier. Rejouable.
--
--  L'application fabrique l'identifiant d'une fiche à partir de sa date et
--  de son bâtiment, ce qui lui permet de corriger une saisie en la
--  ressaisissant. Une ligne créée autrement — l'import des feuilles, une
--  correction en SQL — porte un identifiant tiré au sort. L'application ne
--  la reconnaît pas comme sienne, tente d'en créer une seconde, et bute sur
--  `unique (date, lot_id)` : « Cette saisie existe déjà pour cette date ».
--  Toute journée importée devenait ainsi incorrigible depuis le téléphone.
--
--  L'application va désormais viser (date, bâtiment) plutôt que
--  l'identifiant. Pour `pontes`, l'adoption réécrit l'identifiant de la
--  fiche existante ; ses lignes de calibre doivent suivre, d'où la cascade
--  sur mise à jour ajoutée ici.
-- =====================================================================

alter table ponte_lignes
  drop constraint if exists ponte_lignes_ponte_id_fkey;

alter table ponte_lignes
  add  constraint ponte_lignes_ponte_id_fkey
       foreign key (ponte_id) references pontes(id)
       on update cascade
       on delete cascade;
