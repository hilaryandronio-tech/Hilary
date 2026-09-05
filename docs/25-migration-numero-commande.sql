-- =====================================================================
--  TAMA FERME — Numéroter les ventes comme le carnet
--
--  À exécuter dans Supabase > SQL Editor AVANT de déployer la version de
--  l'application qui accompagne ce fichier. Rejouable.
--
--  Les factures portent un « N° Commande » au format du carnet papier —
--  298-08-2026, soit le 298ᵉ bon du mois d'août 2026. L'application ne
--  l'attribuait qu'aux ventes venues de l'onglet Commandes ; une vente
--  saisie en caisse n'en avait aucun, et la ligne disparaissait de la
--  facture.
--
--  Le numéro est posé par la base, pas par l'application : une saisie faite
--  hors ligne arrive parfois des jours plus tard, et le téléphone ne peut
--  pas savoir combien de ventes le mois compte déjà. Le déclencheur le sait,
--  au moment où la ligne entre vraiment.
--
--  Limite connue : deux ventes enregistrées dans la même seconde peuvent
--  recevoir le même numéro. À trois postes de saisie et quelques ventes par
--  jour, le cas ne se présentera pas ; si un jour il se présente, il faudra
--  une séquence par mois plutôt qu'un comptage.
-- =====================================================================

alter table ventes add column if not exists numero_commande text;

create or replace function numeroter_vente() returns trigger
language plpgsql as $$
declare rang int;
begin
  if new.numero_commande is null then
    select count(*) + 1 into rang
    from   ventes
    where  date_trunc('month', date) = date_trunc('month', new.date);
    new.numero_commande := lpad(rang::text, 3, '0') || to_char(new.date, '-MM-YYYY');
  end if;
  return new;
end $$;

drop   trigger if exists numeroter_vente on ventes;
create trigger numeroter_vente before insert on ventes
  for each row execute function numeroter_vente();

-- Rattrapage des ventes déjà enregistrées, dans l'ordre où elles ont été
-- faites. Les numéros ne correspondront pas à ceux du carnet papier — le
-- carnet compte des commandes, l'application des livraisons — mais ils
-- seront cohérents entre eux et ne bougeront plus.
with rangs as (
  select id,
         lpad(row_number() over (partition by date_trunc('month', date)
                                 order by date, created_at)::text, 3, '0')
           || to_char(date, '-MM-YYYY') as numero
  from   ventes
)
update ventes v
set    numero_commande = r.numero
from   rangs r
where  r.id = v.id and v.numero_commande is null;

-- Contrôle : les dernières ventes et leur numéro.
select date, numero_commande, montant
from   ventes
order  by date desc, created_at desc
limit  6;
