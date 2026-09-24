# language: fr
# Capability: OneDrive sync — push (local -> drive)
# Phase 1: coordinator collaboration.
# References: ADR-0014 (push: debounced 5 s after last local mutation +
#            manual "save now"; history/ file per effective push, 30-day
#            purge), docs/OPEN-QUESTIONS.md — "OneDrive Synchronization".
#
# NOTE (implementation): the transport (Microsoft Graph API) is MOCKED in
# step definitions. Writes to current.json and history/ are simulated in
# a fake drive; timestamps are controlled with a fixed clock. Pushes are
# debounced with FAKE TIMERS advanced deterministically (5 s debounce).

Fonctionnalité: Envoi des modifications locales vers OneDrive
  En tant que coordinateur
  Je veux que mes modifications locales soient envoyées vers le dossier partagé OneDrive de façon différée et contrôlable
  Afin que l'équipe de coordination travaille sur un planning à jour sans perdre d'historique

  Contexte:
    Soit la synchronisation connectée et activée pour « Alice »
    Et le dossier partagé /MediaPlan/ résolu avec driveId « drive-1 » et itemId « item-1 »
    Et current.json sur le drive identique à l'état local synchronisé de base
    Et l'horloge fixée à 10:00:00
    Et le transport Graph simulé par les définitions d'étapes

  Scénario: Envoi différé 5 secondes après la dernière mutation locale
    Quand Alice crée un créneau le 24 sept. 2026 à 09:00 pour l'offre « Visite guidée »
    Alors aucun envoi n'a lieu immédiatement
    Et current.json sur le drive reste inchangé
    Quand l'horloge avance de 5 secondes
    Alors current.json sur le drive contient l'état local avec le créneau créé
    Et un fichier d'historique est écrit dans le dossier history/ du drive

  Scénario: Le délai d'envoi est réinitialisé par chaque nouvelle mutation
    Quand Alice crée un créneau à 10:00:00
    Et Alice crée un second créneau à 10:00:03
    Alors aucun envoi n'a lieu à 10:00:05
    Et current.json sur le drive reste inchangé
    Quand l'horloge avance jusqu'à 10:00:08
    Alors un seul envoi a lieu
    Et current.json sur le drive contient les deux créneaux
    Et un seul fichier d'historique est écrit pour cet envoi

  Scénario: Enregistrement manuel immédiat avec le bouton « Save now »
    Quand Alice modifie un créneau existant
    Et Alice clique sur le bouton « Save now »
    Alors l'envoi a lieu immédiatement, sans attendre le délai de 5 secondes
    Et current.json sur le drive contient la modification

  Scénario: Nom du fichier d'historique selon le motif horodatage-auteur
    Quand Alice clique sur le bouton « Save now » à 10:00:00 le 24 sept. 2026
    Alors un fichier d'historique est écrit dans le dossier history/ du drive
    Et le nom du fichier suit le motif <horodatage-ISO>_<utilisateur>.json
    Et le nom du fichier commence par l'horodatage ISO 2026-09-24T10:00:00
    Et le nom du fichier contient le nom d'auteur « Alice » issu du jeton connecté
    Et le nom du fichier se termine par .json

  Scénario: Un fichier d'historique par envoi effectif
    Quand Alice modifie un créneau et l'envoi différé aboutit
    Et Alice modifie un autre créneau et l'envoi différé aboutit
    Alors le dossier history/ du drive contient exactement 2 fichiers d'historique
    Et chaque fichier correspond à un envoi effectif distinct

  Scénario: Purge des fichiers d'historique de plus de 30 jours
    Etant donné que le dossier history/ du drive contient un fichier d'historique écrit il y a 31 jours
    Et un fichier d'historique écrit il y a 15 jours
    Quand un nouvel envoi effectif a lieu
    Alors le fichier de plus de 30 jours est supprimé du dossier history/
    Et le fichier de moins de 30 jours est conservé

  Scénario: Aucun envoi quand la synchronisation est désactivée
    Etant donné que l'interrupteur de synchronisation est désactivé
    Quand Alice crée un créneau
    Et l'horloge avance de 5 secondes
    Alors aucun envoi n'a lieu
    Et current.json sur le drive reste inchangé
    Et aucun fichier d'historique n'est écrit
    Mais l'état local contient bien le créneau créé

  Scénario: Envoi bloqué quand un conflit non résolu est présent
    Etant donné que l'état local et l'état distant ont divergé depuis l'état de base synchronisé
    Et que le dialogue de conflit « Garder ma version » / « Garder la version partagée » est ouvert
    Quand l'horloge avance de 5 secondes après une mutation locale
    Alors aucun envoi n'a lieu tant que le conflit n'est pas résolu
    Et current.json sur le drive reste inchangé

  Scénario: L'envoi reprend après résolution du conflit par « Garder ma version »
    Etant donné que le dialogue de conflit est ouvert
    Quand Alice clique sur « Garder ma version »
    Alors l'état local devient la nouvelle version de référence
    Et un envoi de current.json a lieu
    Et un fichier d'historique est écrit pour cet envoi

  # Edge case: two clients push within the same poll window. The second
  # write hits a changed current.json: divergence, not silent overwrite.

  Scénario: Deux envois simultanés de deux coordinateurs
    Etant donné que Bob est connecté depuis un autre poste avec le même dossier partagé
    Et que Bob a envoyé une modification de current.json à 10:00:02
    Quand Alice clique sur « Save now » à 10:00:04
    Alors l'envoi d'Alice détecte que current.json a changé depuis l'état de base synchronisé
    Et l'état local d'Alice ET l'état distant ont changé depuis l'état de base
    Et l'envoi d'Alice est bloqué
    Et le dialogue de conflit « Garder ma version » / « Garder la version partagée » s'ouvre
    Et current.json sur le drive contient toujours la version de Bob

  # Edge case: push while polling detects a remote change (push/pull race).

  Scénario: Envoi pendant qu'une interrogation détecte un changement distant
    Etant donné que la fréquence d'interrogation est de 30 secondes
    Et que Bob a modifié current.json à 10:00:00
    Quand Alice modifie un créneau à 10:00:03
    Et l'horloge avance de 5 secondes pour l'envoi différé
    Alors l'envoi d'Alice détecte la divergence locale et distante depuis l'état de base
    Et aucun écrasement silencieux de current.json n'a lieu
    Et le dialogue de conflit s'ouvre avec les deux versions datées et attribuées

  Scénario: Token expiré pendant un envoi — pas de fichier d'historique pour un envoi échoué
    Etant donné que le jeton d'accès expire à 10:00:03
    Quand Alice modifie un créneau à 10:00:00
    Et l'horloge avance de 5 secondes pour déclencher l'envoi
    Et le Graph simulé répond 401 à l'écriture
    Alors l'envoi échoue et aucun fichier d'historique n'est écrit
    Et current.json sur le drive reste inchangé
    Et l'état local reste intact dans localStorage
    Et un rafraîchissement silencieux du jeton est tenté pour un nouvel envoi
