-- =====================================================================
--  TAMA FERME — Nouveaux tarifs négociés
--
--  La braise et Côté cour rejoignent Calypso et Masteva sur le L2 à 800 Ar.
--  MadaRest obtient le M2 à 700 Ar, soit sous le prix normal de 720 depuis
--  le 11 août — remise de grossiste, comme le L1 de Mr Mamy.
--
--  « La braise » et « MadaRest » font déjà partie des 58 clients du carnet
--  (docs/08-clients-fideles.sql) ; seul « Côté cour » est créé ici.
--
--  Attention à l'orthographe : `clients.nom` est la clé unique, et le join
--  ci-dessous est silencieux. Un nom mal écrit ne lève pas d'erreur, il pose
--  simplement zéro tarif — d'où le contrôle en fin de script, qui doit
--  compter quatre lignes. « La braise » prend un b minuscule en base.
--
--  Rejouable : réexécuter met à jour les prix sans créer de doublon. Les
--  ventes déjà passées ne bougent pas, `vente_lignes.prix_unit` fige le
--  prix au moment de la vente.
-- =====================================================================

insert into clients (nom, type, delai_paiement_jours)
values ('Côté cour', 'gros', 0)
on conflict (nom) do nothing;

insert into tarifs_clients (client_id, calibre, prix)
select c.id, v.calibre, v.prix
from   clients c
join  (values ('La braise',  'L2', 800),
              ('Côté cour',  'L2', 800),
              ('Masteva',    'L2', 800),
              ('MadaRest',   'M2', 700)) as v(nom, calibre, prix)
       on v.nom = c.nom
on conflict (client_id, calibre) do update set prix = excluded.prix;

-- Contrôle : quatre lignes attendues. Moins, c'est un nom mal orthographié.
select c.nom, t.calibre, t.prix
from   tarifs_clients t
join   clients c on c.id = t.client_id
where  c.nom in ('La braise', 'Côté cour', 'Masteva', 'MadaRest')
order  by c.nom;
