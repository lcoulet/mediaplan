# language: fr
# Capability: Cycle de travail — modèle de rotation, ancrage, semaines forcées,
# plages horaires par jour, cycle par défaut, copier/coller JSON, affichage
# dans la vue quotidienne, cycle de travail — avertissement léger.
# Références: docs/LEXICON.md (Work Cycle = Cycle de travail ;
#             amplitude = plage horaire de travail).
# Décisions design arrêtées le 2026-09-25/26 :
#   1. Un médiateur a UN cycle de travail actif à la fois.
#   2. Un cycle = liste ordonnée de 1..N semaines de cycle nommées (S1, S2, S3...).
#   3. Chaque semaine de cycle définit ses jours travaillés (lundi..dimanche,
#      week-end travaillable) et une plage horaire de travail par jour.
#   4. Rotation: une semaine de cycle par semaine ISO, S1→S2→S3→S1...
#      Ancrage par défaut: la rotation démarre à S1. L'ancrage est ajustable,
#      et des semaines ISO précises peuvent être FORCÉES manuellement.
#   5. Par défaut, un nouveau médiateur a un cycle d'une semaine S1,
#      lundi-vendredi 09:30-18:00, week-ends non travaillés.

Fonctionnalité: Cycle de travail d'un médiateur
  En tant que coordinateur
  Je veux définir et visualiser le cycle de travail de chaque médiateur
  Afin de voir d'un coup d'œil les heures de travail attendues et de planifier en connaissance de cause

  Contexte:
    Soit la vue « Médiateurs » ouverte
    Et le médiateur « Alice » sans cycle de travail défini manuellement

  # ------------------------------------------------------------------
  # Cycle par défaut
  # ------------------------------------------------------------------

  Scénario: Nouveau médiateur — cycle par défaut d'une seule semaine S1
    Etant donné un nouveau médiateur « Bob » créé sans personnalisation
    Alors le cycle de travail de Bob comporte exactement 1 semaine de cycle nommée « S1 »
    Et la semaine S1 définit les jours travaillés du lundi au vendredi
    Et chaque jour travaillé de S1 a pour plage horaire de travail 09:30-18:00
    Et samedi et dimanche ne sont pas des jours travaillés dans S1

  # ------------------------------------------------------------------
  # Structure du cycle — semaines de cycle et plages horaires
  # ------------------------------------------------------------------

  Scénario: Cycle de plusieurs semaines avec plages horaires différentes par jour
    Etant donné le cycle de travail d'Alice composé des semaines « S1 », « S2 » et « S3 »
    Et la semaine S1 travaillée le lundi de 09:30 à 18:00
    Et la semaine S1 travaillée le mardi de 10:00 à 18:30
    Et la semaine S2 travaillée du lundi au vendredi de 09:30 à 18:00
    Quand le coordinateur enregistre le cycle
    Alors le cycle de travail d'Alice comporte 3 semaines de cycle dans l'ordre S1, S2, S3
    Et la plage horaire du lundi de S1 est 09:30-18:00
    Et la plage horaire du mardi de S1 est 10:00-18:30

  Scénario: Un jour non travaillé n'a pas de plage horaire
    Etant donné le cycle de travail d'Alice avec la semaine « S1 » travaillée le lundi de 09:30 à 18:00
    Quand le coordinateur retire mercredi des jours travaillés de S1
    Alors S1 ne définit aucune plage horaire pour mercredi
    Et mercredi est un jour non travaillé dans S1

  Scénario: Les week-ends peuvent être travaillés
    Etant donné le cycle de travail d'Alice avec la semaine « S1 »
    Quand le coordinateur ajoute samedi à S1 avec la plage horaire 10:00-17:00
    Alors samedi est un jour travaillé dans S1
    Et la plage horaire du samedi de S1 est 10:00-17:00

  Scénario: Cycle à 0 semaine rejeté
    Etant donné le cycle de travail d'Alice composé de la semaine « S1 »
    Quand le coordinateur supprime la dernière semaine S1
    Alors l'enregistrement est refusé avec le message « Le cycle doit comporter au moins une semaine »
    Et le cycle de travail d'Alice reste inchangé

  Scénario: Plage horaire inversée rejetée avec message
    Etant donné le coordinateur éditeur de la semaine « S1 » du cycle d'Alice
    Quand il saisit pour le lundi une plage horaire de 18:00 à 09:30
    Alors la saisie est refusée avec le message « L'heure de début doit précéder l'heure de fin »
    Et la plage horaire du lundi de S1 reste inchangée

  Scénario: Plage horaire de longueur nulle rejetée avec message
    Etant donné le coordinateur éditeur de la semaine « S1 » du cycle d'Alice
    Quand il saisit pour le lundi une plage horaire de 09:30 à 09:30
    Alors la saisie est refusée avec le message « L'heure de début doit précéder l'heure de fin »
    Et la plage horaire du lundi de S1 reste inchangée

  Scénario: Renommer une semaine de cycle
    Etant donné le cycle de travail d'Alice composé de la semaine « S1 »
    Quand le coordinateur renomme « S1 » en « Semaine matin »
    Alors la semaine de cycle s'appelle « Semaine matin »
    Et le cycle comporte toujours 1 semaine de cycle

  # ------------------------------------------------------------------
  # Rotation et ancrage
  # ------------------------------------------------------------------

  Scénario: Rotation par défaut démarre à S1
    Etant donné le cycle de travail d'Alice composé des semaines « S1 », « S2 » et « S3 »
    Quand la semaine ISO 2026-W40 commence
    Alors la semaine de cycle active pour 2026-W40 est « S1 »
    Et la semaine de cycle active pour 2026-W41 est « S2 »
    Et la semaine de cycle active pour 2026-W42 est « S3 »
    Et la semaine de cycle active pour 2026-W43 est « S1 » à nouveau

  Scénario: Cycle d'une seule semaine — même semaine à chaque semaine ISO
    Etant donné le cycle de travail d'Alice composé de la seule semaine « S1 »
    Quand les semaines ISO 2026-W40, 2026-W41 et 2026-W42 se succèdent
    Alors la semaine de cycle active est « S1 » pour chacune de ces semaines ISO

  Scénario: Ré-ancrage de la rotation à une semaine ISO arbitraire
    Etant donné le cycle de travail d'Alice composé des semaines « S1 », « S2 » et « S3 »
    Et la rotation ancrée sur la semaine ISO 2026-W40 avec « S1 »
    Quand le coordinateur règle l'ancrage sur la semaine ISO 2026-W42 avec « S2 »
    Alors la semaine de cycle active pour 2026-W42 est « S2 »
    Et la semaine de cycle active pour 2026-W43 est « S3 »
    Et la semaine de cycle active pour 2026-W44 est « S1 »
    Et les semaines ISO antérieures à 2026-W42 suivent la rotation précédente

  Scénario: Semaine ISO forcée manuellement vers une semaine de cycle donnée
    Etant donné le cycle de travail d'Alice composé des semaines « S1 », « S2 » et « S3 »
    Et la rotation ancrée sur la semaine ISO 2026-W40 avec « S1 »
    Quand le coordinateur force la semaine ISO 2026-W41 sur « S3 »
    Alors la semaine de cycle active pour 2026-W41 est « S3 »
    Et la semaine de cycle active pour 2026-W42 suit la rotation pure « S3 », le forçage étant ponctuel et sans effet sur les semaines suivantes

  Scénario: Plusieurs semaines ISO forcées indépendamment
    Etant donné le cycle de travail d'Alice composé des semaines « S1 » et « S2 »
    Et la rotation ancrée sur la semaine ISO 2026-W40 avec « S1 »
    Quand le coordinateur force la semaine ISO 2026-W41 sur « S2 »
    Et le coordinateur force la semaine ISO 2026-W52 sur « S1 »
    Alors la semaine de cycle active pour 2026-W41 est « S2 »
    Et la semaine de cycle active pour 2026-W52 est « S1 »
    Et les semaines ISO non forcées suivent la rotation S1→S2→S1

  Scénario: Annuler une semaine forcée rétablit la rotation
    Etant donné le cycle de travail d'Alice composé des semaines « S1 » et « S2 »
    Et la semaine ISO 2026-W41 forcée sur « S2 »
    Quand le coordinateur annule le forçage de la semaine ISO 2026-W41
    Alors la semaine de cycle active pour 2026-W41 suit à nouveau la rotation

  Scénario: Ajout d'une semaine en fin de cycle prolonge la rotation
    Etant donné le cycle de travail d'Alice composé des semaines « S1 » et « S2 »
    Et la rotation ancrée sur la semaine ISO 2026-W40 avec « S1 »
    Quand le coordinateur ajoute la semaine « S3 » travaillée du lundi au vendredi de 09:30 à 18:00
    Alors la rotation devient S1→S2→S3→S1
    Et la semaine de cycle active pour 2026-W42 est « S3 »

  Scénario: Un médiateur n'a qu'un cycle de travail actif
    Etant donné le cycle de travail d'Alice composé de la semaine « S1 »
    Quand le coordinateur crée un nouveau cycle pour Alice
    Alors l'ancien cycle est remplacé et Alice n'a toujours qu'un seul cycle de travail actif

  # ------------------------------------------------------------------
  # Copier / coller du cycle en JSON
  # ------------------------------------------------------------------

  Scénario: Copier le cycle dans le presse-papiers au format JSON
    Etant donné le cycle de travail d'Alice composé des semaines « S1 » et « S2 »
    Et la semaine S1 travaillée le lundi de 09:30 à 18:00
    Quand le coordinateur clique sur le bouton « Copier le cycle » d'Alice
    Alors le presse-papiers contient un JSON valide décrivant le cycle d'Alice
    Et le JSON inclut les noms des semaines et les plages horaires par jour

  Scénario: Coller un cycle sur un autre médiateur remplace son cycle après confirmation
    Etant donné le cycle de travail d'Alice composé des semaines « S1 » et « S2 »
    Et le cycle d'Alice copié dans le presse-papiers au format JSON
    Et le cycle de travail de Bob composé de la seule semaine « S1 »
    Quand le coordinateur clique sur le bouton « Coller le cycle » de Bob
    Alors une demande de confirmation « Remplacer le cycle de Bob ? » est affichée
    Quand le coordinateur confirme
    Alors le cycle de travail de Bob est identique à celui d'Alice
    Et le cycle de travail d'Alice reste inchangé

  Scénario: Coller annulé — rien ne change
    Etant donné le cycle d'Alice copié dans le presse-papiers au format JSON
    Et le cycle de travail de Bob composé de la seule semaine « S1 »
    Quand le coordinateur clique sur le bouton « Coller le cycle » de Bob
    Et le coordinateur annule la confirmation
    Alors le cycle de travail de Bob reste inchangé

  Scénario: Coller un cycle sur le même médiateur après confirmation
    Etant donné le cycle de travail d'Alice composé de la semaine « S1 »
    Et le cycle d'Alice copié dans le presse-papiers au format JSON
    Quand le coordinateur clique sur le bouton « Coller le cycle » d'Alice
    Et le coordinateur confirme
    Alors le cycle de travail d'Alice reste identique à lui-même
    Et aucune erreur n'est signalée

  Scénario: JSON corrompu — erreur et aucun changement
    Etant donné le presse-papiers contenant « {pas du tout du json »
    Et le cycle de travail de Bob composé de la semaine « S1 »
    Quand le coordinateur clique sur le bouton « Coller le cycle » de Bob
    Et le coordinateur confirme
    Alors un message d'erreur « JSON invalide » est affiché
    Et le cycle de travail de Bob reste inchangé

  Scénario: JSON valide mais champs requis manquants — erreur et aucun changement
    Etant donné le presse-papiers contenant un JSON valide sans les champs requis
    Et le cycle de travail de Bob composé de la semaine « S1 »
    Quand le coordinateur clique sur le bouton « Coller le cycle » de Bob
    Et le coordinateur confirme
    Alors un message d'erreur listant les champs manquants est affiché
    Et le cycle de travail de Bob reste inchangé

  Scénario: JSON collé décrivant un cycle à 0 semaine — rejeté
    Etant donné le presse-papiers contenant un JSON valide décrivant un cycle sans semaine
    Et le cycle de travail de Bob composé de la semaine « S1 »
    Quand le coordinateur clique sur le bouton « Coller le cycle » de Bob
    Et le coordinateur confirme
    Alors un message d'erreur « Le cycle doit comporter au moins une semaine » est affiché
    Et le cycle de travail de Bob reste inchangé

  # ------------------------------------------------------------------
  # Affichage dans la vue quotidienne
  # ------------------------------------------------------------------

  Scénario: Pilule de semaine de cycle à côté du nom du médiateur dans la vue quotidienne
    Etant donné le cycle de travail d'Alice composé des semaines « S1 » et « S2 »
    Et la rotation ancrée sur la semaine ISO 2026-W40 avec « S1 »
    Et la vue quotidienne affichant le mardi de la semaine ISO 2026-W41
    Alors la barre de la voie d'Alice affiche la pilule « S2 » à côté de son nom

  Scénario: Hachures en dehors de la plage horaire de travail du jour affiché
    Etant donné le cycle de travail d'Alice composé de la semaine « S1 »
    Et la semaine S1 travaillée le mardi de 09:30 à 18:00
    Et la vue quotidienne affichant un mardi de la semaine de cycle S1
    Alors la voie d'Alice affiche la plage horaire de travail 09:30-18:00 pour ce jour
    Et la zone avant 09:30 est hachurée
    Et la zone après 18:00 est hachurée
    Et la zone entre 09:30 et 18:00 n'est pas hachurée

  Scénario: Jour non travaillé — voie entièrement hachurée et visuellement distincte
    Etant donné le cycle de travail d'Alice composé de la semaine « S1 »
    Et la semaine S1 travaillée uniquement le lundi de 09:30 à 18:00
    Et la vue quotidienne affichant un mercredi de la semaine de cycle S1
    Alors la voie d'Alice est entièrement hachurée sur toute la journée
    Et la voie est visuellement distincte d'un jour travaillé

  # ------------------------------------------------------------------
  # Avertissement léger lors de l'attribution d'un créneau
  # ------------------------------------------------------------------

  Scénario: Créneau attribué en dehors de la plage horaire — avertissement léger non bloquant
    Etant donné le cycle de travail d'Alice composé de la semaine « S1 »
    Et la semaine S1 travaillée le mardi de 09:30 à 18:00
    Et la vue quotidienne affichant un mardi de la semaine de cycle S1
    Quand le coordinateur crée un créneau pour Alice de 08:00 à 09:00
    Alors un avertissement léger signale que le créneau est en dehors de la plage horaire de travail d'Alice
    Et l'avertissement n'empêche pas la création du créneau
    Et le créneau est créé

  Scénario: Créneau attribué sur un jour non travaillé — avertissement léger non bloquant
    Etant donné le cycle de travail d'Alice composé de la semaine « S1 »
    Et la semaine S1 travaillée uniquement le lundi de 09:30 à 18:00
    Et la vue quotidienne affichant un mercredi de la semaine de cycle S1
    Quand le coordinateur crée un créneau pour Alice le mercredi de 10:00 à 12:00
    Alors un avertissement léger signale que le mercredi n'est pas un jour travaillé d'Alice
    Et l'avertissement n'empêche pas la création du créneau
    Et le créneau est créé

  Scénario: Créneau dans la plage horaire — aucun avertissement
    Etant donné le cycle de travail d'Alice composé de la semaine « S1 »
    Et la semaine S1 travaillée le mardi de 09:30 à 18:00
    Et la vue quotidienne affichant un mardi de la semaine de cycle S1
    Quand le coordinateur crée un créneau pour Alice de 10:00 à 12:00
    Alors aucun avertissement n'est affiché
    Et le créneau est créé

  Scénario: Médiateur sans cycle défini — aucun avertissement
    Etant donné le médiateur « Alice » sans cycle de travail
    Et la vue quotidienne affichant un mardi
    Quand le coordinateur crée un créneau pour Alice de 08:00 à 09:00
    Alors aucun avertissement lié au cycle n'est affiché
    Et le créneau est créé

  # ------------------------------------------------------------------
  # Modale de chaîne de cycles (vue Médiateurs)
  # ------------------------------------------------------------------

  Scénario: Ouvrir la modale de chaîne de cycles depuis la vue Médiateurs
    Etant donné la vue « Médiateurs » affichant Alice
    Quand le coordinateur clique sur le bouton de cycle de travail d'Alice
    Alors la modale de chaîne de cycles d'Alice s'ouvre
    Et la modale liste les semaines de cycle dans l'ordre
    Et la modale permet d'ajouter une semaine, de supprimer une semaine, de renommer une semaine
    Et la modale permet de modifier la plage horaire de chaque jour de chaque semaine
    Et la modale permet de régler l'ancrage de la rotation
    Et la modale permet de forcer des semaines ISO précises
