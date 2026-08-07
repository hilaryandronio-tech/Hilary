# Dépose ici les exports Google Sheets

Un fichier `.csv` par onglet, avec le nom de l'onglet — par exemple :

```
ponte-2025.csv
ventes-2025.csv
charges-2025.csv
provende-mortalite-2025.csv
```

Depuis Google Sheets, pour chaque onglet :
**Fichier → Télécharger → Valeurs séparées par des virgules (.csv)**

L'export ne prend que l'onglet actif : il faut donc répéter l'opération
onglet par onglet.

Ne retouche rien avant de déposer — cellules fusionnées, lignes de totaux,
dates mal formées, trous : c'est justement ce que j'ai besoin de voir pour
écrire une transformation qui tienne. Un fichier « nettoyé à la main » cache
les cas particuliers qui feront échouer l'import à mi-parcours.
