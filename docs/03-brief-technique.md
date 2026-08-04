# Tama Ferme — Brief technique

Passation pour la construction de l'application de gestion des poules pondeuses.
Ce document décrit le contexte, les règles métier et les décisions déjà prises.

---

## 1. Le contexte

Tama Ferme est une ferme avicole à Toamasina, Madagascar : **9000 poules pondeuses,
dont 6000 en ponte**, réparties sur plusieurs bâtiments.

Aujourd'hui, trois personnes envoient chaque jour leurs chiffres par WhatsApp au
dirigeant, qui les ressaisit à la main dans Google Sheets :

| Qui | Ce qu'elle transmet |
|---|---|
| Responsable de vente | Recettes et charges du point de vente |
| Chefs de ferme | Provende consommée, mortalité, charges de la ferme |
| Magasinière | Fiche des pontes par calibre, avec les dégâts |

**Le problème à résoudre : supprimer la ressaisie.** Chacun saisit directement,
le dirigeant consulte. C'est la priorité numéro un, avant toute autre
fonctionnalité.

### Contraintes de terrain

- Téléphones Android d'entrée de gamme
- Saisie en extérieur, en plein soleil, souvent d'une seule main
- Réseau intermittent à la ferme → **le mode hors ligne n'est pas optionnel**
- Utilisateurs non techniques : la saisie doit tenir en 30 secondes

---

## 2. L'état actuel

Un prototype fonctionnel existe : `tama-app.jsx`, composant React autonome,
données persistées en local. Il valide l'ergonomie et les calculs, **il n'est pas
l'architecture cible** — c'est un fichier unique sans backend.

Ce qu'il contient déjà et qu'il faut conserver :

- Écran de connexion : profil + code à 4 chiffres
- Cinq écrans par rôle : Chef de ferme, Magasinière, Point de vente, Créances, Bilan, Direction
- **Pavé numérique intégré** — le clavier système est trop lent et masque l'écran
- **Calcul en direct pendant la saisie** : le taux de ponte et les grammes par
  poule s'affichent pendant qu'on tape, ce qui permet de repérer une erreur
  immédiatement plutôt que trois jours plus tard

### La cible

- **Frontend** : React + Vite, PWA installable (manifest fourni)
- **Backend** : Supabase — PostgreSQL, Auth, Row Level Security (schéma fourni)
- **Hors ligne** : file d'attente locale (IndexedDB), synchronisation au retour
  du réseau, dernier écrivain gagne
- **Hébergement** : Vercel, sous-domaine de tamaferme.com

---

## 3. Les règles métier

### Constante fondamentale

**1 alvéole = 30 œufs.** La collecte se compte en alvéoles, tout le reste en œufs.

### Calibres et prix de base

| Calibre | S1 | S2 | M1 | M2 | L1 | L2 | XL1 | XL2 |
|---|---|---|---|---|---|---|---|---|
| Ar/œuf | 600 | 620 | 650 | 660 | 670 | 680 | 700 | 750 |

### Tarifs négociés

Certains clients ont un prix supérieur sur un calibre précis. **Le tarif client
remplace le prix de base sur ce calibre uniquement** ; les autres calibres partent
au prix de base.

| Client | Calibre | Prix |
|---|---|---|
| Calypso | L2 | 800 |
| Leader Price | M1 | 760 |
| La Terrasse | L1 | 750 |
| Mercy Ships | L1 | 800 |

Le prix unitaire doit être **figé sur la ligne de vente** au moment de
l'enregistrement. Sans ça, un changement de tarif fausserait rétroactivement tout
l'historique.

### Formules

```
effectif vivant       = effectif initial − cumul mortalité
taux de ponte (%)     = œufs collectés ÷ poules en ponte × 100
provende par poule (g)= kg distribués × 1000 ÷ effectif vivant
valeur de collecte    = Σ (alvéoles × 30 × prix du calibre)
```

### Chiffre d'affaires et bénéfice — le point délicat

```
chiffre d'affaires = Σ ventes (encaissées ET à crédit)

charges totales    = charges saisies
                   + provende consommée × prix du kg
                   + amortissement des poulettes

amortissement      = coût poulette ÷ (durée de ponte × 7) × poules en ponte × jours

bénéfice           = chiffre d'affaires − charges totales
prix de revient    = charges totales ÷ œufs produits
```

**Les 16 postes de charges saisis ne représentent qu'environ 20 % du coût réel
d'un œuf.** La provende (60–70 %) et l'amortissement des poulettes sont les
deux postes dominants. Le prix du kg de provende et le coût d'une poulette sont
stockés dans la table `parametres` et doivent être renseignés par la direction :
tant qu'ils valent zéro, l'application affiche un avertissement, car le bénéfice
calculé serait faux.

### Recouvrement

Une vente est marquée **payée** ou **à crédit** à l'enregistrement.

- Une vente à crédit alimente les créances, **pas** la recette
- L'encaissement ultérieur porte la date du paiement, pas celle de la livraison —
  la trésorerie est datée du règlement, la production de la collecte
- Ancienneté : normal ≤ 30 j, à relancer 31–60 j, critique > 60 j

**Non implémenté** : l'encaissement partiel. À prévoir si le besoin se confirme.

### Postes de charges de la ferme

Produit véto · Connexion · Sakafo · Nettoyage · Salaire · Curbu Hilary ·
Carburant · Voiture · Frais · Alvéoles · Papier film · Étiquette · Loyer ·
Dératisation · Remb. machine · Autres

Les charges **ne sont pas rattachées à un bâtiment** — un loyer ou un salaire ne
se ventile pas par bâtiment. Seules la provende et la mortalité le sont.

---

## 4. Rôles et périmètres

| Rôle | Écrit | Lit |
|---|---|---|
| `chef_ferme` | Provende, mortalité, charges ferme | Ses bâtiments |
| `magasiniere` | Fiche de ponte, dégâts | Sa collecte |
| `point_vente` | Ventes, encaissements, charges du point de vente | Créances |
| `direction` | Tout, plus les paramètres et tarifs | Tout |

Chacun arrive directement sur son écran après connexion. Le chef de ferme n'a pas
accès à la caisse ; la magasinière n'a pas accès au bilan.

---

## 5. Identité visuelle

### Palette (charte Tama Ferme)

| Rôle | Hex | Usage |
|---|---|---|
| Marron foncé | `#36251E` | En-tête, texte, boutons de validation |
| Jaune | `#FAA429` | **Seule couleur d'action** : bouton principal, onglet actif |
| Marron clair | `#AF481F` | Alertes : mortalité, dégâts, crédit, retard, perte |
| Blanc de marque | `#EFFCF3` | Fond des cartes |
| Fond de page | `#E4EFE7` | Dérivé, pour détacher les cartes du fond |

### Typographie

- **IBM Plex Sans Condensed** — titres
- **IBM Plex Sans** — texte courant
- **IBM Plex Mono** — **tous les chiffres**, en `font-variant-numeric: tabular-nums`

Les chiffres en chasse fixe alignent les colonnes et rendent une erreur de saisie
visible à l'œil nu. Ne pas remplacer par une police proportionnelle.

### Règles d'interface

- Cibles tactiles de 44 px minimum
- Actions en bas d'écran — le pouce n'atteint pas le haut
- Chaque état signalé par la position ou le texte **en plus** de la couleur : un
  écran usé et sale ne restitue pas les nuances
- Animations réduites au minimum : sur un appareil lent, elles ressemblent à un bug

### Ressources fournies

`icone-marron-512.png` · `icone-blanc-512.png` · `icone-maskable-512.png` ·
`splash-1080x1920.png`

L'icône maskable est indispensable : Android recadre les icônes en cercle ou en
goutte selon le fabricant, et rognerait le logo sans cette version.

Le mot-symbole dessiné n'est lisible qu'en grand — il est réservé à l'écran de
connexion et au splash. Ailleurs, on utilise le pictogramme seul avec le nom
composé en IBM Plex Sans Condensed.

---

## 6. Ce qui reste à décider

- **Structure réelle des bâtiments** : le schéma part sur 3 lots de 3000, à corriger
- **Prix du kg de provende** et **coût d'une poulette** : indispensables au bénéfice
- **Prix des œufs sales et fêlés** : comptés à zéro aujourd'hui ; les cassés partent à 500 Ar
- **Autres clients** que les quatre listés : prix de base ou tarifs à négocier ?
- **Dettes fournisseurs** : à construire en miroir des créances, avec une ligne
  « trésorerie nette prévisionnelle = créances − dettes » au tableau de bord
- **Encaissement partiel** des créances
- **Migration** de l'historique Google Sheets existant

---

## 7. Ordre de construction suggéré

1. Projet Vite + React, base Supabase, exécution du schéma SQL
2. Authentification et routage par rôle
3. Portage des écrans du prototype vers l'API
4. Couche hors ligne (IndexedDB + file de synchronisation)
5. PWA : manifest, service worker, icônes
6. Déploiement Vercel et tests sur les téléphones réels de l'équipe
7. Import de l'historique Google Sheets

**Le point de vigilance** : la couche hors ligne. Si elle arrive en dernier, il
faut réécrire toute la logique de données. Mieux vaut concevoir dès l'étape 3 les
écritures comme des opérations mises en file, et non comme des appels réseau
directs.
