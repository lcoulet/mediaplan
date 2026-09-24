# language: fr
# Capability: OneDrive sync — authentication (OAuth 2.0 PKCE, public SPA client)
# Phase 1: coordinator collaboration.
# References: ADR-0014 (frontend-only sync via OneDrive files),
#             docs/OPEN-QUESTIONS.md — "OneDrive Synchronization".
#
# NOTE (implementation): the transport (Microsoft Graph API + Microsoft
# authentication popup) is MOCKED in step definitions. No real HTTP request
# and no real browser popup are made: step definitions simulate the popup
# outcome (success, error, user closes popup) and stub Graph responses,
# including 401 responses and token expiry.
#
# UI strings below are in French, as they appear in the application
# (see AGENTS.md). Domain vocabulary follows docs/LEXICON.md.

Fonctionnalité: Authentification OneDrive (OAuth 2.0 PKCE)
  En tant que coordinateur
  Je veux connecter mon compte Microsoft (OneDrive Personnel ou M365 Business)
  Afin de synchroniser le planning avec l'équipe de coordination

  Contexte:
    Soit l'application MediaPlan ouverte avec un planning chargé depuis localStorage
    Et la synchronisation OneDrive non connectée
    Et le transport Graph simulé par les définitions d'étapes

  Scénario: Première connexion via le bouton « Connecter OneDrive »
    Quand j'ouvre la vue Configuration
    Et je clique sur le bouton « Connecter OneDrive »
    Alors une popup d'authentification Microsoft s'ouvre
    Et le flux OAuth 2.0 PKCE est utilisé, sans secret client
    Quand l'utilisateur se connecte dans la popup avec le compte « alice@museum.example »
    Et la popup se ferme après autorisation des scopes demandés
    Alors la section OneDrive de la vue Configuration affiche l'état « Connecté »
    Et le nom d'auteur « Alice » issu du jeton connecté est affiché
    Et les jetons sont stockés dans localStorage

  Scénario: Le bouton « Connecter OneDrive » échoue si aucun identifiant client n'est configuré
    Etant donné que le champ identifiant client de la vue Configuration est vide
    Quand je clique sur le bouton « Connecter OneDrive »
    Alors aucune popup d'authentification ne s'ouvre
    Et un message d'erreur demande de renseigner l'identifiant client

  Scénario: L'utilisateur ferme la popup d'authentification sans se connecter
    Quand j'ouvre la vue Configuration
    Et je clique sur le bouton « Connecter OneDrive »
    Et l'utilisateur ferme la popup Microsoft sans terminer la connexion
    Alors la synchronisation reste à l'état « Non connecté »
    Et aucune donnée locale n'est modifiée
    Et le jeton d'accès n'est pas stocké

  Scénario: Rafraîchissement silencieux du jeton avant expiration
    Etant donné que la synchronisation est connectée pour « Alice »
    Et que le jeton d'accès expire dans 60 secondes
    Et que l'horloge est fixée à 10:00:00
    Quand l'horloge avance de 45 secondes pour déclencher une interrogation
    Alors le jeton est rafraîchi silencieusement à partir du jeton de rafraîchissement stocké dans localStorage
    Et aucune popup Microsoft ne s'ouvre
    Et la vue Configuration reste sur l'écran courant, sans changement visible pour l'utilisateur
    Et l'interrogation de current.json est envoyée avec le jeton rafraîchi

  Scénario: Bannière « Session cloud expirée » quand le jeton de rafraîchissement est refusé
    Etant donné que la synchronisation est connectée pour « Alice »
    Quand le Graph simulé répond 401 au rafraîchissement du jeton
    Alors une bannière jaune « Session cloud expirée » est affichée dans l'application
    Et la bannière contient un bouton « Reconnecter »
    Et l'édition locale du planning reste possible
    Et les données de localStorage restent la source de vérité

  Scénario: Reconnexion depuis la bannière « Session cloud expirée »
    Etant donné que la bannière « Session cloud expirée » est affichée
    Quand je clique sur le bouton « Reconnecter »
    Alors une popup d'authentification Microsoft s'ouvre
    Quand l'utilisateur se reconnecte dans la popup
    Alors la bannière « Session cloud expirée » disparaît
    Et la synchronisation reprend avec le nouveau jeton

  Scénario: Pas de boucle de reconnexion automatique — 401 répétés
    Etant donné que la synchronisation est connectée pour « Alice »
    Quand le Graph simulé répond 401 à trois rafraîchissements de jeton consécutifs
    Alors la synchronisation est désactivée
    Et une notification informe l'utilisateur que la synchronisation est désactivée
    Et aucune nouvelle requête automatique n'est envoyée vers le Graph
    Et l'édition locale du planning reste possible

  Scénario: Reconnexion manuelle après désactivation automatique
    Etant donné que la synchronisation a été désactivée après des 401 répétés
    Et que la bannière « Session cloud expirée » est affichée
    Quand je clique sur le bouton « Reconnecter »
    Et l'utilisateur se reconnecte avec succès dans la popup Microsoft
    Alors la synchronisation est réactivée
    Et les requêtes vers le Graph reprennent

  Scénario: Déconnexion depuis la vue Configuration
    Etant donné que la synchronisation est connectée pour « Alice »
    Quand j'ouvre la vue Configuration
    Et je clique sur le bouton « Déconnecter »
    Alors la section OneDrive affiche l'état « Non connecté »
    Et les jetons sont supprimés du localStorage
    Et l'interrupteur de synchronisation de l'en-tête est désactivé
    Et le planning local reste intact dans localStorage
    Et aucune requête de synchronisation n'est envoyée

  # Edge case required by the spec phase: token expires DURING a push.

  Scénario: Expiration du jeton pendant un envoi
    Etant donné que la synchronisation est connectée pour « Alice »
    Et que l'horloge est fixée à 10:00:00
    Et qu'une mutation locale a déclenché un envoi différé
    Quand l'horloge avance de 5 secondes
    Et le Graph simulé répond 401 à l'écriture de current.json
    Alors l'envoi est interrompu
    Et aucun fichier d'historique n'est écrit sur le drive pour cet envoi échoué
    Et current.json sur le drive reste inchangé
    Et un rafraîchissement silencieux du jeton est tenté
    Et l'édition locale du planning reste possible
