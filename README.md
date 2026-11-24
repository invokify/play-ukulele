# Ukulélé Studio

Application web pour apprendre le ukulélé à partir de tablatures.

- **Coller une tablature** et lui donner un titre pour créer une chanson (sauvegardée dans le navigateur).
- **Visualiser** les cordes jouées sur un manche animé (cordes qui vibrent, cases à presser, aperçu de la note suivante) et suivre le curseur dans la tablature.
- **Écouter** chaque note et chaque accord (synthèse de corde pincée, accords grattés de G vers A), avec le nom de l'accord reconnu (C, Am, F, G7…).
- **Régler la vitesse** : tempo en BPM, vitesse d'entraînement (25 → 150 %), métronome, boucle sur une partie (`[Intro]`, `[Refrain]`…), lecture pas à pas.

## Lancer

Aucune dépendance. Servez simplement le dossier :

```bash
npm start          # ou : python3 -m http.server 8000
```

puis ouvrez <http://localhost:8000>. Le site est entièrement statique : il peut être publié tel quel sur GitHub Pages.

## Format de tablature

```
[Intro]
A|------0----0----0---
E|----0----0----0-----
C|--------------------
G|--5----5----5-----5-
```

- 4 lignes par système, étiquetées `A|`, `E|`, `C|`, `G|` (ordre libre) ; sans étiquette, l'ordre A, E, C, G de haut en bas est supposé.
- Des lignes sans étiquette juste après un système (tablature coupée par le copier-coller) sont jouées à la suite.
- Frettes de 0 à 24 (deux chiffres acceptés), barres de mesure `|`, symboles `h p / \ ~ b` tolérés.
- Les titres entre crochets deviennent des parties sélectionnables ; le reste du texte (paroles, noms d'accords) est ignoré.
- **Tirets par temps** : chaque caractère de tablature est un pas de temps ; ce réglage indique combien de caractères valent un temps (4 par défaut).

## Raccourcis

`Espace` lecture/pause · `←` / `→` note précédente/suivante · clic sur une colonne de la tablature ou sur le manche pour l'écouter.

## Tests

```bash
npm test
```
