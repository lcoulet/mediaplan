# language: fr
# Capability: OneDrive sync — pull (drive -> local)
# Phase 1: coordinator collaboration.
# References: ADR-0014 (pull: polling current.json with ETag/If-None-Match,
#            configurable 10 s - 15 min, default 30 s; offline pauses with
#            backoff, localStorage stays source of truth).
#
# NOTE (implementation): the transport (Microsoft Graph API) is MOCKED in
# step definitions. ETag headers are simulated; network loss is simulated
# by making the mocked Graph unreachable; time advances with a fixed clock
# and fake timers.

Fonctionnalité: Réception des modifications distantes depuis OneDrive
  En tant que coordinateur
  Je veux recevoir automatiquement les modifications envoyées par mes collègues sur le dossier partagé
  Afin de travailler sur un planning à jour sans jamais être bloqué dans mes éditions locales

  Contexte:
    Soit la synchronisation connectée et activée pour « Alice »
    Et le dossier partagé /MediaPlan/ résolu avec driveId « drive-1 » et itemId « item-1 »
    Et la fréquence d'interrogation configurée à 30 secondes
    Et current.json sur le drive identique à l'état local synchronisé de base
    Et l'horloge fixée à 10:00:00
    Et le transport Graph simulé par les définitions d'étapes
    Et l'ETag courant de current.json stocké localement

  Scénario: Interrogation sans changement via ETag
    Quand l'horloge avance de 30 secondes
    Alors une interrogation de current.json est envoyée avec l'en-tête If-None-Match contenant l'ETag courant
    Et le Graph simulé répond 304 Not Modified
    Et l'état local reste inchangé

  Scénario: Changement distant appliqué localement
    Etant donné que Bob a modifié current.json à 10:00:10 en créant un créneau
    Quand l'horloge avance de 30 secondes pour déclencher l'interrogation
    Alors le Graph simulé répond 200 avec le nouveau contenu et un nouvel ETag
    Et le nouveau créneau de Bob apparaît dans le planning local
    Et le nouvel ETag est stocké localement pour la prochaine interrogation
    Et l'état de base synchronisé devient la version de Bob

  Plan du scénario: Interrogation à la fréquence configurée
    Etant donné que la fréquence d'interrogation est de « <secondes> » secondes
    Et que le Graph simulé répond 304 à chaque interrogation
    Quand l'horloge avance de « <secondes> » secondes
    Alors exactement 1 interrogation a lieu
    Quand l'horloge avance à nouveau de « <secondes> » secondes
    Alors exactement 2 interrogations ont eu lieu au total

    Exemples:
      | secondes |
      | 10       |
      | 30       |
      | 900      |

  Scénario: Perte du réseau — la synchronisation se met en pause
    Quand le réseau devient indisponible
    Et l'horloge avance de 30 secondes
    Alors l'interrogation échoue
    Et la synchronisation passe à l'état « En pause »
    Et l'état « En pause » est visible dans la section « Synchronisation OneDrive » de la vue Configuration

  Scénario: Édition locale jamais bloquée pendant une coupure réseau
    Etant donné que le réseau est indisponible et la synchronisation en pause depuis 10:05:00
    Quand Alice crée un créneau à 10:06:00
    Alors le créneau est créé dans le planning local
    Et l'état local est persisté dans localStorage
    Et aucun message ne bloque l'édition

  Scénario: Reprise avec temporisation croissante après coupure
    Etant donné que le réseau est indisponible depuis 10:00:00
    Quand l'horloge avance de 30 secondes
    Alors la première interrogation échoue
    Quand l'horloge avance de 30 secondes supplémentaires
    Alors la temporisation de reprise a augmenté et aucune nouvelle interrogation n'a encore lieu
    Quand l'horloge avance jusqu'à la prochaine échéance de temporisation
    Alors une nouvelle interrogation est tentée
    Et le nombre de requêtes vers le Graph reste borné pendant la coupure

  Scénario: Reprise après reconnexion quand aucune modification locale n'est en attente
    Etant donné que le réseau est indisponible depuis 10:00:00
    Et que Bob a modifié current.json pendant la coupure
    Quand le réseau redevient disponible
    Alors la synchronisation reprend automatiquement
    Et l'interrogation récupère la version de Bob
    Et le planning local est mis à jour avec les modifications de Bob

  Scénario: Reconnexion avec éditions locales en attente et modifications distantes
    Etant donné que le réseau est indisponible depuis 10:00:00
    Et qu'Alice a créé un créneau localement pendant la coupure
    Et que Bob a modifié current.json deux fois pendant la coupure
    Quand le réseau redevient disponible
    Alors l'interrogation détecte que l'état local ET l'état distant ont changé depuis l'état de base synchronisé
    Et le dialogue de conflit s'ouvre avec les deux versions datées et attribuées

  Scénario: Résumé « N nouvelles versions » à la reconnexion
    Etant donné que le réseau est indisponible depuis 10:00:00
    Et qu'Alice n'a aucune modification locale en attente
    Et que Bob a envoyé 3 versions successives de current.json pendant la coupure
    Quand le réseau redevient disponible
    Alors la synchronisation reprend automatiquement
    Et la dernière version distante est appliquée localement
    Et un résumé « 3 nouvelles versions » est affiché à l'utilisateur

  Scénario: Résumé au singulier pour une seule nouvelle version
    Etant donné que le réseau est indisponible depuis 10:00:00
    Et qu'Alice n'a aucune modification locale en attente
    Et que Bob a envoyé 1 seule nouvelle version de current.json pendant la coupure
    Quand le réseau redevient disponible
    Alors la nouvelle version distante est appliquée localement
    Et un résumé « 1 nouvelle version » est affiché à l'utilisateur

  Scénario: Aucune interrogation quand la synchronisation est désactivée
    Etant donné que l'interrupteur de synchronisation est désactivé
    Quand l'horloge avance de 60 secondes
    Alors aucune interrogation de current.json n'a lieu
    Et l'état local reste inchangé
    Mais l'édition locale reste possible
