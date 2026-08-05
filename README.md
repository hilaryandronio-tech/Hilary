# Tama Ferme

Gestion de la ferme avicole — saisie directe par l'équipe, remplaçant la
ressaisie manuelle depuis WhatsApp. Contexte complet : [docs/03-brief-technique.md](docs/03-brief-technique.md).

## Démarrer en local

1. `npm install`
2. Copier `.env.example` vers `.env.local` et renseigner l'URL et la clé anon
   d'un projet Supabase (Dashboard > Project Settings > API).
3. Dans Supabase > SQL Editor, exécuter [docs/01-schema-supabase.sql](docs/01-schema-supabase.sql).
4. Créer un utilisateur Supabase Auth par entrée de `src/data/team.js`
   (mêmes emails, code à 6 chiffres comme mot de passe), puis une ligne
   correspondante dans la table `profils` — voir la remarque dans
   [src/data/team.js](src/data/team.js).
5. `npm run dev`

## État du scaffold

- Routage par rôle, connexion Supabase Auth, pavé numérique, palette et
  typographie de la charte : en place.
- Les 6 écrans (Chef de ferme, Magasinière, Point de vente, Créances, Bilan,
  Direction) sont portés depuis le prototype et écrivent via la file
  d'attente hors ligne ([src/lib/offlineQueue.js](src/lib/offlineQueue.js)),
  pas directement contre Supabase.
- File d'attente hors ligne : écrit dans IndexedDB puis synchronise à la
  reconnexion, dans l'ordre. Pas encore de résolution de conflit au-delà de
  « dernier écrivain gagne ». Limite connue : seules les *écritures* sont mises
  en file — les référentiels (clients, tarifs) sont juste re-fetchés à chaque
  chargement d'écran, avec un repli statique s'ils échouent, mais ce repli n'a
  pas d'identifiant Supabase réel donc ces ventes-là ne peuvent pas être
  enregistrées avant la prochaine connexion (voir `src/data/constants.js`).
- PWA : manifest et icônes déjà fournis et branchés, service worker généré
  par `vite-plugin-pwa` au build.
- `npm run build` a été vérifié (vite build + service worker générés sans
  erreur) — pas encore testé en conditions réelles sur téléphone Android.

Le prototype d'origine reste dans [docs/tama-app.jsx](docs/tama-app.jsx) comme
référence.

## Déployer sur Vercel

Le dépôt git local est initialisé mais rien n'est encore commité ni poussé —
ça reste à faire volontairement, à valider avec toi avant tout push.

1. Créer un dépôt GitHub (privé de préférence, données de ferme) et l'ajouter
   en remote : `git remote add origin <url>`.
2. Premier commit et push (une fois que tu es prêt) :
   ```
   git add .
   git commit -m "Scaffold initial"
   git push -u origin master
   ```
3. Sur [vercel.com](https://vercel.com), importer le dépôt GitHub — le preset
   Vite est détecté automatiquement, `vercel.json` fournit déjà la commande de
   build et la réécriture SPA nécessaire pour que les routes comme `/ferme`
   fonctionnent en accès direct.
4. Dans Vercel > Project Settings > Environment Variables, renseigner
   `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` (mêmes valeurs que
   `.env.local`, pour l'environnement Production **et** Preview).
5. Dans Vercel > Project Settings > Domains, ajouter le sous-domaine choisi
   sous tamaferme.com (le brief ne précise pas lequel — à trancher) et suivre
   les instructions DNS.
