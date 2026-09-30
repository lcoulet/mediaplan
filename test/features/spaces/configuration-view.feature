# language: fr
# Capability: Vue Configuration — remplace l'entrée « Import / Export » de
# la navigation et regroupe Espaces, Données et Demi-journées ; l'import
# Secutix déménage dans l'en-tête comme action quotidienne de premier plan.
# Références: docs/LEXICON.md (Space = Espace ; Half-day = Demi-journée ;
#             Secutix import = Import Secutix).
# Décisions design arrêtées le 2026-09-29 :
#   1. L'entrée de navigation « Import / Export » devient « Configuration ».
#   2. La vue Configuration regroupe 3 sections : « Espaces » (CRUD de la
#      liste des espaces, voir spaces.feature), « Données » (export/import
#      JSON.gz, suppression des données, données de démonstration) et
#      « Demi-journées » (réglages demi-journée déplacés depuis
#      l'Import/Export d'aujourd'hui).
#   3. L'import Secutix N'EST PAS dans la vue Configuration : c'est une
#      fonction quotidienne de premier plan, un BOUTON dans l'en-tête,
#      à côté des autres boutons d'action, qui ouvre directement le flux
#      d'import Secutix.
#   4. Les réglages demi-journée (morningEnd / afternoonStart) conservent
#      leurs validations à l'identique après le déplacement.
#   5. Le contenu Données (JSON.gz, suppression, démonstration) fonctionne
#      à l'identique après le déplacement.

Fonctionnalité: Vue Configuration
  En tant que coordinateur
  Je veux une vue Configuration regroupant la gestion des espaces, des données et des demi-journées
  Afin de trouver tous les réglages de l'application au même endroit tout en gardant l'import Secutix quotidien à portée de main dans l'en-tête

  Contexte:
    Soit l'application ouverte avec des données existantes

  # ------------------------------------------------------------------
  # Navigation et structure de la vue
  # ------------------------------------------------------------------

  Scénario: L'entrée « Import / Export » devient « Configuration »
    Quand le coordinateur regarde la barre de navigation
    Alors la navigation ne contient plus d'entrée « Import / Export »
    Et la navigation contient une entrée « Configuration »
    Quand le coordinateur clique sur « Configuration »
    Alors la vue Configuration s'ouvre

  Scénario: La vue Configuration affiche trois sections
    Quand le coordinateur ouvre la vue « Configuration »
    Alors la vue affiche la section « Espaces »
    Et la vue affiche la section « Données »
    Et la vue affiche la section « Demi-journées »

  # ------------------------------------------------------------------
  # Section Espaces
  # ------------------------------------------------------------------

  Scénario: La section Espaces permet le CRUD complet de la liste
    Quand le coordinateur ouvre la vue « Configuration »
    Alors la section « Espaces » permet d'ajouter un espace
    Et la section « Espaces » permet de renommer un espace
    Et la section « Espaces » permet de changer la couleur d'un espace
    Et la section « Espaces » permet de supprimer un espace non référencé
    Et la suppression d'un espace référencé est refusée selon la règle de spaces.feature

  # ------------------------------------------------------------------
  # Section Données — contenu Import/Export déplacé à l'identique
  # ------------------------------------------------------------------

  Scénario: Export JSON.gz depuis la section Données
    Quand le coordinateur ouvre la vue « Configuration »
    Et le coordinateur clique sur le bouton d'export JSON.gz de la section « Données »
    Alors un fichier JSON.gz contenant l'état complet des données est téléchargé

  Scénario: Import JSON.gz depuis la section Données
    Etant donné un fichier JSON.gz export précédemment téléchargé
    Quand le coordinateur ouvre la vue « Configuration »
    Et le coordinateur importe ce fichier via le bouton d'import de la section « Données »
    Alors l'état des données est remplacé par le contenu du fichier importé

  Scénario: Suppression des données depuis la section Données avec confirmation
    Quand le coordinateur ouvre la vue « Configuration »
    Et le coordinateur clique sur le bouton de suppression des données de la section « Données »
    Alors une demande de confirmation est affichée
    Quand le coordinateur confirme
    Alors toutes les données locales sont supprimées

  Scénario: Suppression des données annulée — rien ne change
    Quand le coordinateur ouvre la vue « Configuration »
    Et le coordinateur clique sur le bouton de suppression des données de la section « Données »
    Et le coordinateur annule la confirmation
    Alors les données locales restent inchangées

  Scénario: Chargement des données de démonstration depuis la section Données
    Quand le coordinateur ouvre la vue « Configuration »
    Et le coordinateur clique sur le bouton de données de démonstration de la section « Données »
    Alors un jeu de données de démonstration est chargé
    Et le jeu de démonstration comprend médiateurs, offres et créneaux exploitables

  # ------------------------------------------------------------------
  # Section Demi-journées — réglages déplacés à l'identique
  # ------------------------------------------------------------------

  Scénario: Réglages demi-journée déplacés dans la section Demi-journées
    Quand le coordinateur ouvre la vue « Configuration »
    Alors la section « Demi-journées » propose le réglage de fin de matinée (morningEnd)
    Et la section « Demi-journées » propose le réglage de début d'après-midi (afternoonStart)
    Et ces réglages ne sont plus présents dans l'ancienne vue Import / Export

  Scénario: Validation des réglages demi-journée conservée après le déplacement
    Quand le coordinateur ouvre la vue « Configuration »
    Et le coordinateur règle la fin de matinée à 13:00
    Et le coordinateur règle le début d'après-midi à 12:00
    Alors l'enregistrement est refusé avec le message « L'heure de début doit précéder l'heure de fin »
    Et les réglages demi-journée restent inchangés

  Scénario: Réglages demi-journée valides enregistrés
    Quand le coordinateur ouvre la vue « Configuration »
    Et le coordinateur règle la fin de matinée à 12:30
    Et le coordinateur règle le début d'après-midi à 13:30
    Alors les réglages demi-journée sont enregistrés
    Et la vue quotidienne et la valorisation utilisent ces nouvelles bornes de demi-journée

  # ------------------------------------------------------------------
  # Import Secutix — bouton de l'en-tête, PAS dans Configuration
  # ------------------------------------------------------------------

  Scénario: L'import Secutix n'est pas dans la vue Configuration
    Quand le coordinateur ouvre la vue « Configuration »
    Alors aucune section de la vue ne propose d'import Secutix

  Scénario: Bouton d'import Secutix dans l'en-tête à côté des boutons d'action
    Quand le coordinateur regarde l'en-tête de l'application
    Alors l'en-tête contient un bouton « Import Secutix »
    Et le bouton est placé à côté des autres boutons d'action de l'en-tête
    Et le bouton est visible depuis toutes les vues

  Scénario: Le bouton d'en-tête ouvre directement le flux d'import Secutix
    Quand le coordinateur clique sur le bouton « Import Secutix » de l'en-tête
    Alors le flux d'import Secutix s'ouvre directement
    Et le créneau d'ouverture ne passe pas par la vue Configuration
