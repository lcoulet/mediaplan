# language: fr
# Capability: OneDrive sync — configuration (Configuration view section)
# Phase 1: coordinator collaboration.
# References: ADR-0014, docs/OPEN-QUESTIONS.md — "OneDrive Synchronization"
# (UI bullet: Import/Export view becomes a Configuration view).
#
# NOTE (implementation): the transport (Microsoft Graph API) is MOCKED in
# step definitions. Share-link resolution, drive folder creation and all
# Graph errors are simulated — no real HTTP requests.

Fonctionnalité: Configuration de la synchronisation OneDrive
  En tant que coordinateur
  Je veux configurer la connexion OneDrive, la fréquence d'interrogation et le lien de partage
  Afin de contrôler précisément le comportement de la synchronisation et diagnostiquer ses erreurs

  Contexte:
    Soit la vue Configuration ouverte dans MediaPlan
    Et une section « Synchronisation OneDrive » affichée dans cette vue
    Et le transport Graph simulé par les définitions d'étapes

  Scénario: Statut non connecté affiché dans la section OneDrive
    Etant donné que la synchronisation OneDrive n'est pas configurée
    Quand je consulte la section « Synchronisation OneDrive »
    Alors le statut « Non connecté » est affiché
    Et l'interrupteur de synchronisation dans l'en-tête est désactivé

  Scénario: Statut connecté affiché après connexion
    Etant donné que la synchronisation est connectée pour « Alice »
    Et que la dernière synchronisation a eu lieu le 24 sept. 2026 à 10:15
    Quand je consulte la section « Synchronisation OneDrive »
    Alors le statut « Connecté » est affiché
    Et l'heure de dernière synchronisation « 24 sept. 2026 à 10:15 » est affichée
    Et le nom de l'utilisateur connecté « Alice » est affiché
    Et l'interrupteur de synchronisation dans l'en-tête est activé

  Scénario: Fréquence d'interrogation par défaut à 30 secondes
    Etant donné que la synchronisation est connectée
    Quand je consulte le champ fréquence d'interrogation de la section « Synchronisation OneDrive »
    Alors le champ contient « 30 » avec l'unité « secondes »
    Et la fréquence d'interrogation effective est de 30 secondes

  Plan du scénario: Fréquence d'interrogation saisie en secondes ou en minutes
    Etant donné que la synchronisation est connectée
    Quand je saisis « <valeur>» dans le champ fréquence d'interrogation avec l'unité « <unité> »
    Alors la fréquence d'interrogation effective est de « <secondes> » secondes
    Et la nouvelle valeur est conservée après rechargement de la page

    Exemples:
      | valeur | unité     | secondes |
      | 10     | secondes | 10       |
      | 45     | secondes | 45       |
      | 2      | minutes  | 120      |
      | 15     | minutes  | 900      |

  Plan du scénario: Fréquence d'interrogation hors bornes rejetée
    Etant donné que la synchronisation est connectée
    Et que la fréquence d'interrogation actuelle est de 30 secondes
    Quand je saisis « <valeur>» dans le champ fréquence d'interrogation avec l'unité « <unité> »
    Alors la valeur est refusée avec un message d'erreur indiquant la plage 10 secondes à 15 minutes
    Et la fréquence d'interrogation reste à 30 secondes

    Exemples:
      | valeur | unité     |
      | 5      | secondes  |
      | 20     | minutes   |
      | 0      | secondes  |

  Scénario: Identifiant client requis avant connexion
    Etant donné que le champ identifiant client est vide
    Quand je saisis « 0000-aaaa-bbbb-1111 » dans le champ identifiant client
    Alors l'identifiant client est conservé dans la configuration locale
    Et le bouton « Connecter OneDrive » devient utilisable

  Scénario: Résolution du lien de partage via l'API Graph shares
    Etant donné que la synchronisation est connectée pour « Alice »
    Et que le champ identifiant client contient « 0000-aaaa-bbbb-1111 »
    Quand je colle le lien de partage « https://museum-my.sharepoint.com/:f:/g/abc123 » dans le champ lien de partage
    Et je valide la résolution du lien
    Alors le lien est résolu une seule fois via l'API Graph shares
    Et le driveId et l'itemId du dossier partagé sont stockés dans la configuration locale
    Et le statut « Dossier partagé résolu » est affiché
    Et les requêtes suivantes adressent directement le dossier par driveId/itemId, sans nouvelle résolution

  Scénario: Lien de partage invalide signalé
    Etant donné que la synchronisation est connectée pour « Alice »
    Quand je colle le lien de partage « https://exemple.lien/invalide » dans le champ lien de partage
    Et je valide la résolution du lien
    Alors le Graph simulé renvoie une erreur
    Et l'erreur brute du Graph est affichée dans le panneau de diagnostic
    Et aucun driveId ni itemId n'est stocké
    Et la synchronisation reste non configurée pour ce dossier

  Scénario: Interrupteur de synchronisation actif une fois configuré
    Etant donné que la synchronisation est connectée pour « Alice »
    Et que le lien de partage est résolu
    Alors l'interrupteur de synchronisation dans l'en-tête est activé
    Quand j'actionne l'interrupteur de synchronisation
    Alors la synchronisation est désactivée et aucun envoi ni interrogation n'a lieu
    Quand j'actionne à nouveau l'interrupteur de synchronisation
    Alors la synchronisation est réactivée avec la fréquence d'interrogation configurée

  Scénario: Interrupteur de synchronisation désactivé en cas d'erreur
    Etant donné que la synchronisation est connectée pour « Alice »
    Et que le Graph simulé est en erreur permanente
    Quand l'interrogation échoue avec l'erreur simulée
    Alors l'interrupteur de synchronisation dans l'en-tête est désactivé
    Et l'état d'erreur est visible dans la section « Synchronisation OneDrive »
    Et l'utilisateur peut réactiver manuellement la synchronisation

  Scénario: Panneau de diagnostic — journal de synchronisation avec horodatage
    Etant donné que la synchronisation est connectée pour « Alice »
    Et que l'horloge est fixée à 10:00:00
    Et qu'une interrogation de current.json a réussi à 10:00:30
    Quand je consulte le panneau de diagnostic de la section « Synchronisation OneDrive »
    Alors le journal de synchronisation affiche une entrée « interrogation réussie » horodatée à 10:00:30
    Et chaque entrée du journal porte un horodatage

  Scénario: Panneau de diagnostic — statut du jeton
    Etant donné que la synchronisation est connectée pour « Alice »
    Et que le jeton d'accès expire à 10:05:00
    Quand je consulte le panneau de diagnostic à 10:00:00
    Alors le statut du jeton affiche « valide » avec l'heure d'expiration 10:05:00

  Scénario: Panneau de diagnostic — erreurs brutes du Graph
    Etant donné que la synchronisation est connectée pour « Alice »
    Quand le Graph simulé renvoie l'erreur 403 « accessDenied » sur une interrogation
    Alors l'entrée correspondante apparaît dans le journal de synchronisation
    Et l'erreur brute du Graph « 403 accessDenied » est affichée dans le panneau de diagnostic
