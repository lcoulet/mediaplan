# MediPlan — Gestion des plannings de médiation du Muséum de Toulouse

## Présentation

MediPlan est une application web de gestion des plannings pour les offres de
médiation du Muséum de Toulouse. Elle permet de planifier les médiateurs,
gérer les réservations et d'importer/exporter les données au format Excel.

L'application est **frontend uniquement** (pas de backend). Les données sont
stockées dans le `localStorage` du navigateur. Une évolution future vers une
architecture avec serveur web est prévue.

## Fonctionnalités

- Gestion des médiateurs (ajout, modification, suppression)
- Création et édition de plannings
- Gestion des réservations
- Import/export de données au format Excel (.xlsx)
- Persistance des données via `localStorage`

## Stack technique

- HTML5 / CSS3 / JavaScript (ES modules)
- [SheetJS](https://sheetjs.com/) pour l'import/export Excel
- Pas de framework, pas de build tool — application vanilla
- Données en `localStorage`

## Structure du projet

```
mediaplan/
├── index.html              # Point d'entrée
├── css/
│   └── style.css           # Styles
├── js/
│   ├── app.js              # Logique principale
│   ├── store.js            # Gestion du localStorage
│   ├── models.js           # Modèles de données
│   └── excel.js            # Import/export Excel
├── docs/
│   └── specs.md            # Spécifications détaillées
├── LICENSE                 # Licence MIT
└── README.md               # Ce fichier
```

## Démarrage

Ouvrir `index.html` dans un navigateur. Aucune installation requise.

Pour servir en local (optionnel) :

```bash
python3 -m http.server 8000
```

Puis ouvrir `http://localhost:8000`.

## Licence

[MIT](LICENSE) — © 2026 Loic Coulet
