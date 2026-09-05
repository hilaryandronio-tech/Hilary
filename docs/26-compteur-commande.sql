-- =====================================================================
--  TAMA FERME — Le compteur de bons de commande
--
--  À exécuter dans Supabase > SQL Editor. Rejouable.
--
--  La migration 25 numérotait en comptant les ventes du mois. Deux défauts :
--  le compte repartait de 1 alors que le carnet papier en est à 075 pour
--  septembre 2026, et deux ventes enregistrées en même temps pouvaient
--  recevoir le même numéro.
--
--  Un compteur par mois règle les deux. Il s'amorce à la valeur du carnet, et
--  l'incrément verrouille sa ligne le temps de la transaction : deux saisies
--  simultanées se suivent au lieu de se marcher dessus.
--
--  La fonction est `security definer` : elle écrit dans un compteur auquel
--  personne d'autre n'a accès, et elle tourne au nom de son propriétaire pour
--  que la RLS du compteur ne bloque pas une saisie légitime.
-- =====================================================================

create table if not exists compteurs_commande (
  mois    date primary key,               -- premier jour du mois concerné
  dernier integer not null default 0 check (dernier >= 0)
);

alter table compteurs_commande enable row level security;
-- Aucune policy : seule la fonction ci-dessous y touche, et elle passe outre.

create or replace function numeroter_vente() returns trigger
language plpgsql security definer set search_path = public as $$
declare m date; rang int;
begin
  if new.numero_commande is null then
    m := date_trunc('month', new.date)::date;
    insert into compteurs_commande (mois) values (m) on conflict (mois) do nothing;
    -- `returning` sur un update verrouille la ligne : c'est ce qui garantit
    -- qu'aucun numéro n'est distribué deux fois.
    update compteurs_commande set dernier = dernier + 1
    where  mois = m
    returning dernier into rang;
    new.numero_commande := lpad(rang::text, 3, '0') || to_char(new.date, '-MM-YYYY');
  end if;
  return new;
end $$;

drop   trigger if exists numeroter_vente on ventes;
create trigger numeroter_vente before insert on ventes
  for each row execute function numeroter_vente();

-- Amorçage : le carnet en est à 075 pour septembre 2026, la prochaine vente
-- enregistrée portera donc 076-09-2026.
insert into compteurs_commande (mois, dernier) values ('2026-09-01', 75)
on conflict (mois) do update set dernier = greatest(compteurs_commande.dernier, 75);

-- Contrôle : le compteur du mois.
select mois, dernier,
       lpad((dernier + 1)::text, 3, '0') || to_char(mois, '-MM-YYYY') as prochain
from   compteurs_commande
order  by mois desc;
