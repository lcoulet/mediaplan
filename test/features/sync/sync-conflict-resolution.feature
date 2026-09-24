# language: fr
# Capability: OneDrive sync — whole-version conflict resolution
# Phase 1: coordinator collaboration.
# References: ADR-0015 (whole-version conflict, manual choice, bidirectional
#            undo, dialog behavior: timeout, live update, connection drop),
#            ADR-0004 (undo/redo full snapshots, 50 entries),
#            docs/OPEN-QUESTIONS.md — "OneDrive Synchronization"
#            (incl. "Resolved 2026-09-25": "Save now" disabled while the
#            dialog is open; "Garder la version partagée" writes no new
#            drive history file).
#
# NOTE (implementation): the transport (Microsoft Graph API) is MOCKED in
# step definitions. The base/local/remote triple is a pure domain input:
# step definitions construct the three versions directly, no real network.

Fonctionnalité: Résolution des conflits de versions entières
  En tant que coordinateur
  Je veux choisir explicitement entre ma version et la version partagée quand les deux ont divergé
  Afin de ne jamais perdre de travail silencieusement et de pouvoir revenir sur mon choix

  Contexte:
    Soit la synchronisation connectée et activée pour « Alice »
    Et le dossier partagé /MediaPlan/ résolu
    Et un état de base synchronisé commun, horodaté 24 sept. 2026 à 09:00, auteur « Alice »
    Et l'état local identique à l'état de base
    Et current.json sur le drive identique à l'état de base
    Et l'horloge fixée à 10:00:00
    Et le délai d'inactivité du dialogue configuré à 5 minutes
    Et le transport Graph simulé par les définitions d'étapes

  Scénario: Pas de conflit quand seul l'état local a changé
    Quand Alice crée un créneau localement
    Alors aucun dialogue de conflit ne s'ouvre
    Et l'envoi différé de la version locale a lieu après 5 secondes

  Scénario: Pas de conflit quand seul l'état distant a changé
    Etant donné que Bob a modifié current.json à 09:30
    Quand l'interrogation détecte la version de Bob
    Alors la version de Bob est appliquée localement
    Et aucun dialogue de conflit ne s'ouvre

  Scénario: Détection du conflit — versions locale et distante toutes deux modifiées
    Etant donné qu'Alice a créé un créneau localement à 09:15
    Et que Bob a modifié current.json à 09:30
    Quand l'interrogation détecte la version de Bob
    Alors la comparaison avec l'état de base montre que l'état local ET l'état distant ont changé
    Et aucun écrasement silencieux n'a lieu
    Et l'état local d'Alice est conservé tel quel jusqu'à la décision

  Scénario: Dialogue de conflit avec les deux versions datées et attribuées
    Etant donné qu'Alice a modifié l'état local à 09:15
    Et que Bob a modifié current.json à 09:30
    Quand l'interrogation détecte la version de Bob
    Alors un dialogue de conflit s'ouvre
    Et le dialogue affiche la version locale avec sa date de modification « 24 sept. 2026 à 09:15 » et son auteur « Alice »
    Et le dialogue affiche la version partagée avec sa date de modification « 24 sept. 2026 à 09:30 » et son auteur « Bob »
    Et le dialogue propose le bouton « Garder ma version »
    Et le dialogue propose le bouton « Garder la version partagée »

  Scénario: Choix « Garder ma version »
    Etant donné que le dialogue de conflit est ouvert
    Quand Alice clique sur « Garder ma version »
    Alors l'état local complet devient la version de référence
    Et l'envoi de current.json a lieu avec la version d'Alice
    Et un fichier d'historique est écrit sur le drive pour cet envoi
    Et le dialogue se ferme

  # Resolved 2026-09-25 (docs/OPEN-QUESTIONS.md): "Save now" is DISABLED
  # while the conflict dialog is open — no queue, no dialog trigger.
  # French UI label: « Sauvegarder maintenant ».

  Scénario: Le bouton « Save now » désactivé pendant le dialogue de conflit ouvert
    Etant donné que le dialogue de conflit est ouvert
    Quand Alice consulte le bouton « Save now » (« Sauvegarder maintenant »)
    Alors le bouton est désactivé tant que le dialogue est ouvert
    Et le clic sur le bouton n'a aucun effet — ni envoi immédiat, ni mise en file d'attente
    Quand Alice clique sur « Garder ma version »
    Alors le dialogue se ferme
    Et le bouton « Save now » est à nouveau activé

  # Resolved 2026-09-25 (docs/OPEN-QUESTIONS.md): choosing the shared
  # version writes NO new drive history file (the drive already holds
  # that version); the losing local version stays in the local undo
  # stack (50 entries).

  Scénario: Choix « Garder la version partagée »
    Etant donné que le dialogue de conflit est ouvert avec la version partagée de Bob
    Quand Alice clique sur « Garder la version partagée »
    Alors l'état local complet est remplacé par la version de Bob
    Et aucun envoi n'est nécessaire car le drive contient déjà cette version
    Et aucun nouveau fichier d'historique n'est écrit dans le dossier history/ du drive
    Et la version locale perdante d'Alice reste disponible dans la pile d'annulation locale (50 entrées)
    Et le dialogue se ferme
    Et l'état de base synchronisé devient la version de Bob

  Scénario: Choix réversible dans les deux directions — annuler après « Garder ma version »
    Etant donné que le dialogue de conflit est ouvert
    Quand Alice clique sur « Garder ma version »
    Alors les deux versions restent disponibles dans la pile d'annulation
    Quand Alice annule (Ctrl+Z)
    Alors l'état local revient à la version partagée de Bob
    Et Alice peut rétablir (Ctrl+Y) pour revenir à sa version

  Scénario: Choix réversible dans les deux directions — annuler après « Garder la version partagée »
    Etant donné que le dialogue de conflit est ouvert
    Quand Alice clique sur « Garder la version partagée »
    Alors les deux versions restent disponibles dans la pile d'annulation
    Quand Alice annule (Ctrl+Z)
    Alors l'état local revient à la version locale d'Alice d'avant le choix
    Et Alice peut rétablir (Ctrl+Y) pour revenir à la version partagée

  Scénario: La version perdante reste présente dans les fichiers d'historique du drive
    Etant donné que le dialogue de conflit est ouvert
    Quand Alice clique sur « Garder ma version »
    Alors la version perdante de Bob reste disponible dans les fichiers d'historique du dossier history/ du drive
    Et un coordinateur peut la retrouver dans history/ dans les 30 jours

  Scénario: Délai d'inactivité configuré à 5 minutes par défaut
    Etant donné que le dialogue de conflit s'ouvre à 10:00:00
    Quand Alice ne répond pas pendant 4 minutes 59 secondes
    Alors le dialogue est toujours ouvert
    Et aucune version n'a été choisie automatiquement

  Scénario: Expiration du délai — synchronisation en pause et notification
    Etant donné que le dialogue de conflit s'ouvre à 10:00:00
    Quand Alice ne répond pas pendant 5 minutes
    Alors le dialogue se ferme
    Et la synchronisation passe à l'état « En pause »
    Et une notification « Synchro en pause — divergence non résolue » est affichée
    Et aucun choix automatique de version n'a lieu
    Et l'état local reste intact

  Scénario: Aucune nouvelle invite avant réactivation manuelle
    Etant donné que la synchronisation est en pause après expiration du délai de conflit
    Et que Bob modifie current.json à nouveau
    Quand l'horloge avance de 10 minutes
    Alors aucun dialogue de conflit ne s'ouvre automatiquement
    Et aucune interrogation n'a lieu
    Quand Alice réactive la synchronisation via l'interrupteur de l'en-tête
    Alors l'interrogation reprend
    Et le dialogue de conflit s'ouvre à nouveau avec les versions à jour

  Scénario: Le chrono n'est pas réinitialisé par un nouveau changement distant
    Etant donné que le dialogue de conflit s'ouvre à 10:00:00
    Et que Bob modifie current.json à 10:02:00
    Quand l'interrogation du dialogue détecte la nouvelle version de Bob
    Alors le dialogue reste ouvert sans réinitialiser le chrono
    Et le temps restant est calculé depuis 10:00:00
    Quand l'horloge atteint 10:05:00
    Alors le délai de 5 minutes est expiré
    Et la synchronisation passe à l'état « En pause » avec notification « Synchro en pause — divergence non résolue »

  Scénario: L'interrogation continue pendant le dialogue ouvert
    Etant donné que le dialogue de conflit s'ouvre à 10:00:00
    Et que la fréquence d'interrogation est de 30 secondes
    Quand l'horloge avance de 30 secondes
    Alors une interrogation de current.json a lieu pendant que le dialogue est ouvert
    Et le dialogue reste affiché

  Scénario: Mise à jour en direct du dialogue — « N nouvelles versions sur le drive »
    Etant donné que le dialogue de conflit s'ouvre à 10:00:00 sur la version de Bob de 09:30
    Et que la fréquence d'interrogation est de 30 secondes
    Et que Bob envoie 2 nouvelles versions à 10:01:00
    Quand l'horloge avance jusqu'à la prochaine interrogation
    Alors le dialogue affiche « 2 nouvelles versions sur le drive »
    Et le dialogue présente les détails de la dernière version proposée, avec sa date et son auteur
    Et le dialogue reste ouvert avec les boutons « Garder ma version » et « Garder la version partagée »
    Quand Alice clique sur « Garder la version partagée »
    Alors la dernière version distante est appliquée localement

  Scénario: Coupure de connexion pendant le dialogue — fermeture propre
    Etant donné que le dialogue de conflit est ouvert
    Quand le réseau devient indisponible
    Alors le dialogue se ferme proprement
    Et la synchronisation passe à l'état « En pause »
    Et aucune version n'a été choisie automatiquement
    Et l'état local reste intact
    Et l'édition locale reste possible
    Quand le réseau redevient disponible
    Alors le dialogue de conflit s'ouvre à nouveau avec les versions à jour

  # Edge case: conflict detected while offline edits are pending (same as
  # the reconnect scenario in sync-pull, but from the conflict module's
  # point of view: the dialog must open and offer both versions).

  Scénario: Conflit détecté au retour en ligne avec des éditions locales en attente
    Etant donné que le réseau est indisponible
    Et qu'Alice a créé un créneau localement pendant la coupure
    Et que Bob a modifié current.json pendant la coupure
    Quand le réseau redevient disponible
    Et l'interrogation détecte la version de Bob
    Alors le dialogue de conflit s'ouvre avec la version locale d'Alice et la version partagée de Bob
    Et les deux versions affichent leur date de modification et leur auteur
    Et les boutons « Garder ma version » et « Garder la version partagée » sont proposés
