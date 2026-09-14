# Spécifications — MediPlan

## Contexte

Le Muséum de Toulouse propose des offres de médiation (visites guidées, ateliers,
événements, etc.) qui nécessitent de planifier les médiateurs intervenants.
MediPlan est l'outil de gestion de ces plannings.

## Périmètre actuel (v1)

### Objectif

Application web frontend-only, fonctionnant dans le navigateur, sans backend.
Les données sont persistées en `localStorage`. Import/export Excel pour
l'échange de données avec les outils existants (Secutix, fichiers de
coordination).

### Entités

#### Médiateur

- `id` : identifiant unique
- `nom` : nom de famille
- `prenom` : prénom
- `email` : adresse email (optionnel)
- `telephone` : numéro de téléphone (optionnel)
- `competences` : liste des offres de médiation maîtrisées
- `actif` : booléen (médiateur actif ou non)
- `notes` : notes libres (optionnel)

#### Offre de médiation

- `id` : identifiant unique
- `nom` : nom de l'offre (ex: "Visite guidée dinosauria")
- `description` : description (optionnel)
- `duree` : durée en minutes
- `capacite` : nombre maximum de participants
- `lieu` : lieu d'intervention (optionnel)

#### Planning

- `id` : identifiant unique
- `titre` : titre du planning (ex: "Planning septembre 2026")
- `dateDebut` : date de début de la période
- `dateFin` : date de fin de la période
- `statut` : `brouillon` | `publié` | `archivé`

#### Réservation / Créneau

- `id` : identifiant unique
- `planningId` : référence vers le planning
- `offreId` : référence vers l'offre de médiation
- `mediateurId` : référence vers le médiateur assigné
- `date` : date du créneau
- `heureDebut` : heure de début
- `heureFin` : heure de fin
- `nbParticipants` : nombre de participants (optionnel)
- `statut` : `planifie` | `confirme` | `annule` | `termine`
- `notes` : notes libres (optionnel)

### Fonctionnalités

#### Gestion des médiateurs
- Lister, ajouter, modifier, supprimer un médiateur
- Filtrer par compétence / statut actif
- Rechercher par nom

#### Gestion des offres de médiation
- Lister, ajouter, modifier, supprimer une offre
- Associer des offres à des médiateurs (compétences)

#### Gestion des plannings
- Créer un planning pour une période donnée
- Visualiser le planning sous forme de calendrier/grille
- Éditer les créneaux (drag & drop ou sélection)
- Assigner un médiateur à chaque créneau
- Changer le statut du planning

#### Import / Export Excel
- Exporter le planning au format .xlsx (un onglet par entité ou par semaine)
- Exporter la liste des médiateurs et leurs assignations
- Importer des données depuis les fichiers existants (Secutix, coordination)
- Format d'import configurable (mapping des colonnes)

#### Persistance
- Toutes les données en `localStorage`
- Export/import JSON complet (backup/restauration)

### Interface

- Design responsive (desktop prioritaire, tablette secondaire)
- Vue calendrier principale (semaine / mois)
- Vues annexes : liste des médiateurs, liste des offres
- Barre de navigation / menu principal
- Filtres : par médiateur, par offre, par date

### Contraintes techniques

- Pas de backend, pas de serveur de base de données
- Pas de build tool, JavaScript vanilla (ES modules)
- Compatibilité : navigateurs modernes (Chrome, Firefox, Edge, Safari)
- Données en `localStorage` (limite ~5-10 MB par origine)
- L'application doit fonctionner hors-ligne une fois chargée

## Évolution future (v2+)

- Migration vers une architecture avec serveur web (API REST)
- Base de données persistante (PostgreSQL ou similaire)
- Authentification des utilisateurs (rôles : admin, coordinateur, médiateur)
- Synchronisation multi-postes en temps réel
- Notifications (email, push) pour les assignations
- Gestion des congés et disponibilités des médiateurs
- Statistiques et tableaux de bord

## Sources de données externes

- **Secutix** : système de billetterie/réservation du Muséum — fichier Excel
  exporté, à importer dans MediPlan pour récupérer les réservations existantes.
- **Fichiers de coordination** : fichiers Excel internes de l'équipe de
  médiation, à importer pour initialiser les plannings et les médiateurs.

## Glossaire

- **Médiateur** : personnel intervenant lors des offres de médiation
  (visites, ateliers, etc.)
- **Offre de médiation** : activité proposée par le Muséum (visite guidée,
  atelier pédagogique, événement spécial, etc.)
- **Planning** : ensemble de créneaux sur une période donnée
- **Créneau / Réservation** : assignation d'un médiateur à une offre à une
  date et heure données
