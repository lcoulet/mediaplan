# language: fr
# Capability: Tableau de fonctionnement — édition de la grille annuelle :
# menu contextuel par demi-journée, mode peinture, texte libre, effacement,
# refus des jours de fermeture, annuler/rétablir.
# Références: docs/LEXICON.md ; docs/OPEN-QUESTIONS.md
#   (sections « Mediator Annual Planning View », « Hourly management ») ;
#   test/features/cycles/cycle-model.feature (présence dérivée du cycle).
# Décisions design arrêtées le 2026-10-03 :
#   1. Un clic sur une cellule de demi-journée ouvre un MENU CONTEXTUEL
#      avec tous les codes (CA, RHS, AM, TELE, amgt, Souhait, Réf. WE,
#      CEX, TPT, texte libre, effacer / retour au dérivé). « Souhait »
#      (demande de congé en attente, type leave_request) s'affiche en
#      BLEU dans la cellule, distinct du congé confirmé en jaune ; les
#      couleurs sont celles de la palette mixte Excel + AA (décision
#      palette 2026-10-03 : rose TELE, violet amgt, vert JDM).
#   2. MODE PEINTURE : une valeur choisie une fois, puis chaque clic sur
#      une autre cellule duplique la valeur (clic par clic, PAS de
#      glisser-déposer) ; chaque cellule doit être cliquée individuellement.
#   3. Les absences sont stockées par demi-journée ; la présence est
#      dérivée du cycle ; effacer une cellule revient à l'état dérivé.
#   4. Vert non bloquant : texte libre + codes décodés en suggestions ;
#      le sens des cellules vertes sera ajouté plus tard (2026-10-03).
#   5. Éditer un jour de fermeture du musée (25/12, 01/01, 01/05) affiche
#      une ALERTE NON BLOQUANTE (le musée est fermé ce jour-là) mais
#      l'édition reste possible (décision 2026-10-03 — diffère de la vue
#      quotidienne qui refuse, car le tableau couvre l'année entière
#      et peut légitimement noter des exceptions).
#   6. Navigation hors du périmètre d'édition : la vue suit la date de la
#      route, les libellés de semaine et de jour ouvrent les vues hebdo
#      et jour, et le numéro de semaine ISO vit dans sa propre colonne à
#      gauche (décisions 2026-10-04 — spécifiées dans annual-grid.feature).

Fonctionnalité: Tableau de fonctionnement — édition de la grille annuelle
  En tant que coordinateur
  Je veux saisir et modifier les absences et missions de chaque médiateur directement dans la grille annuelle
  Afin de tenir le tableau de fonctionnement à jour sans quitter la vue

  Contexte:
    Soit le tableau de fonctionnement ouvert sur l'année 2026
    Et le cycle de travail d'Alice composé de la semaine « S1 » travaillée du lundi au vendredi de 09:30 à 18:00
    Et la cellule du matin du mardi 9 juin 2026 d'Alice à la présence dérivée

  # ------------------------------------------------------------------
  # Menu contextuel
  # ------------------------------------------------------------------

  Scénario: Un clic sur une cellule ouvre le menu contextuel des codes
    Quand le coordinateur clique sur la cellule du matin du mardi 9 juin 2026 d'Alice
    Alors un menu contextuel s'ouvre pour cette demi-journée
    Et le menu propose les codes « CA », « RHS », « AM », « TELE », « amgt », « Souhait », « Réf. WE », « CEX » et « TPT »
    Et le menu propose une saisie de texte libre
    Et le menu propose l'effacement « retour au dérivé »

  Scénario: Choisir un code dans le menu remplace la présence dérivée
    Quand le coordinateur clique sur la cellule du matin du mardi 9 juin 2026 d'Alice
    Et il choisit « CA » dans le menu contextuel
    Alors la cellule affiche « CA » en jaune
    Et l'absence est enregistrée pour le matin du 9 juin 2026 d'Alice
    Et la cellule de l'après-midi du même jour reste inchangée

  Scénario: Le menu propose le texte libre et les codes décodés en suggestions
    Quand le coordinateur clique sur la cellule du matin du mardi 9 juin 2026 d'Alice
    Et il ouvre la saisie de texte libre
    Alors la saisie propose en suggestions les codes décodés connus
    Et le coordinateur peut saisir un texte quelconque, par exemple « Stop Motion »
    Et la cellule affiche alors ce texte en orange de mission

  Scénario: Télétravail depuis le menu contextuel
    Quand le coordinateur clique sur la cellule du matin du mardi 9 juin 2026 d'Alice
    Et il choisit « TELE » dans le menu contextuel
    Alors la cellule est rose et affiche « TELE »

  Scénario: Souhait de congé depuis le menu contextuel
    Quand le coordinateur clique sur la cellule du matin du mardi 9 juin 2026 d'Alice
    Et il choisit « Souhait » dans le menu contextuel
    Alors la cellule est bleue et affiche « souhait CA »
    Et le souhait est enregistré avec le type existant « leave_request », distinct du congé confirmé en jaune

  Scénario: Éditer une cellule de l'après-midi est indépendant du matin
    Quand le coordinateur choisit « AM » pour l'après-midi du mardi 9 juin 2026 d'Alice
    Alors la cellule de l'après-midi affiche « AM » en jaune
    Et la cellule du matin reste à la présence dérivée

  # ------------------------------------------------------------------
  # Médiateur sans cycle
  # ------------------------------------------------------------------

  Scénario: Éditer une cellule d'un médiateur sans cycle
    Etant donné Bob sans cycle de travail défini
    Quand le coordinateur clique sur la cellule du matin du mardi 9 juin 2026 de Bob
    Et il choisit « CA » dans le menu contextuel
    Alors la cellule de Bob affiche « CA » en jaune
    Et effacer cette cellule la laisse neutre, sans présence dérivée à rétablir

  # ------------------------------------------------------------------
  # Effacement — retour à l'état dérivé
  # ------------------------------------------------------------------

  Scénario: Effacer une cellule rétablit la présence dérivée
    Etant donné une absence « CA » sur le matin du mardi 9 juin 2026 d'Alice
    Quand le coordinateur clique sur la cellule et choisit « retour au dérivé » dans le menu
    Alors la cellule retrouve l'orange de la présence dérivée du cycle
    Et l'absence est supprimée du modèle de données

  Scénario: Effacer une cellule de jour non travaillé reste neutre
    Etant donné une absence « CA » sur le matin du samedi 13 juin 2026 d'Alice
    Quand le coordinateur efface la cellule
    Alors la cellule est neutre, sans présence dérivée, samedi n'étant pas travaillé dans S1

  # ------------------------------------------------------------------
  # Jours de fermeture du musée
  # ------------------------------------------------------------------

  Scénario: Éditer un jour de fermeture du musée affiche une alerte mais reste possible
    Quand le coordinateur clique sur la cellule du matin du 25 décembre 2026 d'Alice
    Alors une alerte non bloquante indique que le musée est fermé ce jour-là
    Et le coordinateur peut néanmoins choisir un code dans le menu contextuel

  Scénario: L'alerte vaut aussi pour le 1er janvier et le 1er mai
    Quand le coordinateur tente d'éditer une cellule du 1er janvier 2027 d'Alice
    Alors une alerte non bloquante s'affiche et l'édition reste possible
    Et le coordinateur tente d'éditer une cellule du 1er mai 2027 d'Alice
    Alors une alerte non bloquante s'affiche et l'édition reste possible

  # ------------------------------------------------------------------
  # Mode peinture
  # ------------------------------------------------------------------

  Scénario: Activer le mode peinture depuis le menu contextuel
    Quand le coordinateur clique sur la cellule du matin du mardi 9 juin 2026 d'Alice
    Et il choisit « CA » puis active le mode peinture
    Alors la cellule affiche « CA » en jaune
    Et le mode peinture est actif avec « CA » comme valeur à dupliquer
    Et l'interface signale que le mode peinture est actif

  Scénario: Chaque clic duplique la valeur peinte, clic par clic
    Etant donné le mode peinture actif avec la valeur « CA »
    Quand le coordinateur clique sur la cellule du matin du mercredi 10 juin 2026 d'Alice
    Alors la cellule affiche « CA » en jaune
    Quand le coordinateur clique sur la cellule de l'après-midi du mercredi 10 juin 2026 d'Alice
    Alors la cellule affiche « CA » en jaune
    Et aucune duplication ne s'est produite sans clic sur chaque cellule

  Scénario: Pas de duplication par glisser-déposer
    Etant donné le mode peinture actif avec la valeur « CA »
    Quand le coordinateur clique sur la cellule du matin du mercredi 10 juin 2026 d'Alice puis glisse sur les lignes suivantes
    Alors seule la cellule cliquée reçoit « CA »
    Et les cellules survolées pendant le glissement restent inchangées

  Scénario: Le mode peinture peint aussi des cellules d'autres médiateurs
    Etant donné le mode peinture actif avec la valeur « CA »
    Quand le coordinateur clique sur la cellule du matin du mardi 9 juin 2026 de Bob
    Alors la cellule de Bob affiche « CA » en jaune

  Scénario: Le mode peinture prend le pas sur le menu contextuel
    Etant donné le mode peinture actif avec la valeur « TELE »
    Quand le coordinateur clique sur la cellule du matin du mercredi 10 juin 2026 d'Alice
    Alors la cellule reçoit « TELE » en rose
    Et le menu contextuel ne s'ouvre pas, le mode peinture étant actif

  Scénario: La touche Échap quitte le mode peinture
    Etant donné le mode peinture actif avec la valeur « CA »
    Quand le coordinateur appuie sur la touche Échap
    Alors le mode peinture est désactivé
    Et un clic suivant sur une cellule ouvre à nouveau le menu contextuel

  Scénario: Un clic hors de la grille quitte le mode peinture
    Etant donné le mode peinture actif avec la valeur « CA »
    Quand le coordinateur clique en dehors de la grille
    Alors le mode peinture est désactivé
    Et les clics suivants sur les cellules ouvrent le menu contextuel

  Scénario: Peindre puis changer de valeur dans le menu
    Etant donné le mode peinture actif avec la valeur « CA »
    Quand le coordinateur appuie sur la touche Échap
    Et il clique sur la cellule du matin du mercredi 10 juin 2026 d'Alice
    Et il choisit « RHS » dans le menu contextuel puis active à nouveau le mode peinture
    Alors la valeur peinte est désormais « RHS »
    Et les clics suivants dupliquent « RHS »

  # ------------------------------------------------------------------
  # Annuler / rétablir
  # ------------------------------------------------------------------

  Scénario: Annuler une saisie dans la grille
    Etant donné la cellule du matin du mardi 9 juin 2026 d'Alice à la présence dérivée
    Quand le coordinateur choisit « CA » pour cette cellule
    Et il annule
    Alors la cellule retrouve l'orange de la présence dérivée
    Et l'absence n'est plus dans le modèle de données

  Scénario: Rétablir une saisie annulée
    Etant donné la saisie « CA » du matin du mardi 9 juin 2026 d'Alice annulée
    Quand le coordinateur rétablit
    Alors la cellule affiche à nouveau « CA » en jaune

  Scénario: Chaque clic du mode peinture est une opération annulable une à une
    Etant donné le mode peinture actif avec la valeur « CA »
    Quand le coordinateur clique sur les cellules des matins des mardis 9, 16 et 23 juin 2026 d'Alice
    Et il annule trois fois
    Alors les trois cellules ont retrouvé leur état antérieur
    Et une seule opération d'annulation est consommée par cellule peinte

  # ------------------------------------------------------------------
  # Persistance et changement d'année
  # ------------------------------------------------------------------

  Scénario: Les saisies persistent quand on change d'année et qu'on revient
    Etant donné une absence « CA » sur le matin du mardi 9 juin 2026 d'Alice
    Quand le coordinateur sélectionne l'année 2027
    Alors la grille 2027 ne montre aucune trace de l'absence de 2026
    Quand le coordinateur revient sur l'année 2026
    Alors la cellule du matin du mardi 9 juin 2026 d'Alice affiche toujours « CA » en jaune
