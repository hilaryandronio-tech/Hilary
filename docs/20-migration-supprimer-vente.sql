-- =====================================================================
--  TAMA FERME — Supprimer une vente depuis la caisse
--
--  À exécuter dans Supabase > SQL Editor AVANT de déployer la version de
--  l'application qui accompagne ce fichier. Rejouable.
--
--  Chaque enregistrement en caisse crée une vente ; il n'en corrige jamais
--  une existante. Une erreur de calibre obligeait donc à passer par le SQL,
--  et la vente fautive restait dans les totaux entre-temps. Ce n'est pas
--  tenable pour l'équipe.
--
--  Le garde-fou est dans la policy, pas seulement dans l'écran : une vente
--  sur laquelle un encaissement a été saisi ne peut pas être supprimée. La
--  suppression cascade sur `reglements`, et effacer une vente réglée
--  effacerait la trace de l'argent reçu. La direction garde la main par le
--  SQL si un tel cas doit vraiment disparaître.
--
--  Rien à ajouter sur `vente_lignes` : la cascade est exécutée par le moteur
--  au titre de la clé étrangère, elle n'est pas soumise à la RLS de la table
--  fille. La policy ci-dessous est là par symétrie, pour le jour où une
--  ligne serait supprimée seule.
-- =====================================================================

drop   policy if exists supprimer_vente on ventes;
create policy supprimer_vente on ventes for delete
  using (mon_role() in ('point_vente', 'direction')
         and not exists (select 1 from reglements r where r.vente_id = ventes.id));

drop   policy if exists supprimer_vente_l on vente_lignes;
create policy supprimer_vente_l on vente_lignes for delete
  using (mon_role() in ('point_vente', 'direction'));

-- Contrôle : deux lignes attendues.
select tablename, policyname, cmd
from   pg_policies
where  policyname in ('supprimer_vente', 'supprimer_vente_l');
