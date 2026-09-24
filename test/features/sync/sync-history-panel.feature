# language: fr
# Capability: OneDrive sync — History Panel: shared drive versions
# Phase 1: coordinator collaboration.
# References: docs/OPEN-QUESTIONS.md — "OneDrive Synchronization"
#            ("Resolved 2026-09-25": the History Panel gains a second
#            group "Historique partagé" listing drive history/ files,
#            loaded on demand when the panel opens — ONE Graph call, no
#            extra polling; display capped at the 50 most recent files;
#            restoring = load file, apply as local state (undoable),
#            then a normal debounced push, append-only history),
#            ADR-0004 (undo/redo full snapshots, 50 entries; the local
#            group of the panel stays in-memory, undo/redo unchanged),
#            ADR-0014/0015 (drive history/ files, whole-version model).
#
# NOTE (implementation): the transport (Microsoft Graph API) is MOCKED in
# step definitions. Drive history/ files are simulated in a fake drive;
# listing and file contents are returned by the mock, no real requests.

Fonctionnalité: Versions partagées du drive dans le panneau Historique
  En tant que coordinateur
  Je veux consulter les versions partagées du dossier history/ du drive dans le panneau Historique
  Afin de restaurer une version antérieure du planning partagé sans jamais perdre d'historique

  Contexte:
    Soit la synchronisation connectée et activée pour « Alice »
    Et le dossier partagé /MediaPlan/ résolu avec driveId « drive-1 » et itemId « item-1 »
    Et le dossier history/ du drive contenant les fichiers d'historique suivants:
      | nom du fichier                        | date/heure           | auteur   |
      | 2026-09-23T09-00-00Z_bob.json         | 23 sept. 2026 09:00  | Bob      |
      | 2026-09-24T14-30-05Z_claire.json      | 24 sept. 2026 14:30  | Claire   |
      | 2026-09-24T16-12-33Z_alice.json       | 24 sept. 2026 16:12  | Alice    |
    Et le panneau Historique contenant le groupe « Historique local » avec les entrées locales en mémoire
    Et le transport Graph simulé par les définitions d'étapes

  Scénario: Groupe « Historique partagé » dans le panneau Historique
    Quand Alice ouvre le panneau Historique (bouton « Historique » ou raccourci H)
    Alors le groupe « Historique local » liste les entrées locales, de la plus récente à la plus ancienne
    Et un second groupe « Historique partagé » est affiché
    Et le groupe « Historique partagé » liste les fichiers d'historique du dossier history/ du drive
    Et chaque entrée affiche sa date/heure et son auteur

  Scénario: Chargement à la demande — un seul appel Graph, pas d'interrogation supplémentaire
    Etant donné que le panneau Historique est fermé
    Et qu'aucune requête de listage du dossier history/ n'a eu lieu depuis l'ouverture de la page
    Quand Alice ouvre le panneau Historique
    Alors un seul appel Graph liste le dossier history/ du drive au moment de l'ouverture
    Et les entrées du groupe « Historique partagé » sont chargées à la demande
    Et aucune interrogation périodique du dossier history/ n'est mise en place pour ce groupe
    Et le groupe « Historique local » reste alimenté par les entrées en mémoire, sans appel Graph

  Scénario: Affichage plafonné aux 50 fichiers les plus récents
    Etant donné que le dossier history/ du drive contient 120 fichiers d'historique
    Quand Alice ouvre le panneau Historique
    Alors le groupe « Historique partagé » affiche exactement 50 entrées
    Et les 50 entrées affichées sont les fichiers les plus récents, du plus récent au plus ancien
    Et les fichiers plus anciens ne sont pas affichés
    Mais les fichiers plus anciens restent présents dans le dossier history/ du drive jusqu'à la purge

  Scénario: Restauration d'une version partagée — état local, annulable, puis envoi différé
    Etant donné que le panneau Historique est ouvert avec le groupe « Historique partagé »
    Quand Alice clique sur l'entrée du fichier 2026-09-23T09-00-00Z_bob.json
    Alors le fichier est chargé via le Graph simulé
    Et son contenu est appliqué comme nouvel état local complet
    Et l'application crée une entrée annulable dans la pile d'annulation locale
    Et l'envoi différé de la version locale a lieu après 5 secondes
    Et un nouveau fichier d'historique est écrit dans le dossier history/ du drive
    Et le fichier restauré 2026-09-23T09-00-00Z_bob.json n'est jamais modifié en place
    Et le dossier history/ du drive reste en ajout seul (append-only)

  Scénario: Annulation d'une restauration de version partagée
    Etant donné que la version partagée 2026-09-23T09-00-00Z_bob.json a été restaurée localement
    Quand Alice annule (Ctrl+Z)
    Alors l'état local revient à l'état d'avant la restauration
    Et l'entrée correspondante de la pile d'annulation est annulable et rétablissable (Ctrl+Y)

  Scénario: Historique partagé vide
    Etant donné que le dossier history/ du drive est vide
    Quand Alice ouvre le panneau Historique
    Alors le groupe « Historique partagé » est absent du panneau ou affiche un état vide sans entrée
    Et le groupe « Historique local » fonctionne normalement

  Scénario: Panneau ouvert hors ligne — groupe partagé indisponible, groupe local intact
    Etant donné que le réseau est indisponible
    Quand Alice ouvre le panneau Historique
    Alors le groupe « Historique partagé » affiche une erreur ou un état « indisponible »
    Et aucune entrée du dossier history/ du drive n'est listée
    Mais le groupe « Historique local » liste les entrées locales en mémoire, de la plus récente à la plus ancienne
    Et l'édition locale et l'annulation/restauration locale restent possibles
