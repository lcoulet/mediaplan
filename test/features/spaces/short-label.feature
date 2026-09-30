# language: fr
# Capability: Label court d'offre — champ optionnel shortLabel sur l'offre,
# affiché dans les blocs de la vue quotidienne et les bandeaux du plan
# accueil, avec repli sur le nom complet de l'offre.
# Références: docs/LEXICON.md (Short label = Label court ;
#             Offer = Offre ; Day view = Vue quotidienne ;
#             Plan Accueil = vue Plan Accueil ; Print = Impression).
# Décisions design arrêtées le 2026-09-29 :
#   1. Le label court est un champ OPTIONNEL de l'offre, éditable dans la
#      modale d'offre (OfferModal).
#   2. Dans la vue quotidienne, le bloc affiche la pastille de couleur
#      d'offre suivie du LABEL COURT (voir spaces.feature).
#   3. Le bandeau d'offre du plan accueil affiche également le label court.
#   4. REPLI : un label court vide affiche le nom complet de l'offre.
#   5. L'impression de la vue quotidienne utilise aussi le label court
#      (voir day-view-print.feature).

Fonctionnalité: Label court d'offre
  En tant que coordinateur
  Je veux définir un label court optionnel pour chaque offre
  Afin que les blocs de créneaux de la vue quotidienne et les bandeaux du plan accueil restent lisibles dans un espace restreint

  Contexte:
    Soit l'offre « Visite guidée des collections » sans label court défini

  # ------------------------------------------------------------------
  # Édition du champ
  # ------------------------------------------------------------------

  Scénario: Définir un label court dans la modale d'offre
    Quand le coordinateur ouvre la modale de l'offre « Visite guidée des collections »
    Alors la modale propose un champ « Label court » optionnel
    Quand le coordinateur saisit « VG » comme label court et enregistre
    Alors l'offre « Visite guidée des collections » a pour label court « VG »
    Et le nom complet de l'offre reste « Visite guidée des collections »

  Scénario: Label court vide — le nom complet de l'offre est conservé
    Quand le coordinateur ouvre la modale de l'offre « Visite guidée des collections »
    Et le coordinateur laisse le champ « Label court » vide
    Et le coordinateur enregistre
    Alors l'offre « Visite guidée des collections » n'a pas de label court
    Et le nom complet de l'offre reste « Visite guidée des collections »

  # ------------------------------------------------------------------
  # Affichage dans la vue quotidienne
  # ------------------------------------------------------------------

  Scénario: Bloc de créneau affichant la pastille et le label court
    Etant donné l'offre « Visite guidée des collections » de label court « VG »
    Et un créneau de cette offre pour Alice le mardi de 10:00 à 12:00
    Et la vue quotidienne affichant ce mardi
    Alors le bloc du créneau affiche « VG »
    Et le bloc n'affiche pas le nom complet « Visite guidée des collections »

  Scénario: Repli — offre sans label court affiche le nom complet
    Etant donné l'offre « Visite guidée des collections » sans label court
    Et un créneau de cette offre pour Alice le mardi de 10:00 à 12:00
    Et la vue quotidienne affichant ce mardi
    Alors le bloc du créneau affiche le nom complet « Visite guidée des collections »

  Scénario: Deux offres, l'une avec label court et l'autre sans
    Etant donné l'offre « Visite guidée des collections » de label court « VG »
    Et l'offre « Atelier modelage » sans label court
    Et un créneau de chaque offre pour Alice le mardi
    Et la vue quotidienne affichant ce mardi
    Alors le bloc du premier créneau affiche « VG »
    Et le bloc du second créneau affiche « Atelier modelage »

  # ------------------------------------------------------------------
  # Affichage dans le plan accueil
  # ------------------------------------------------------------------

  Scénario: Bandeau d'offre du plan accueil affichant le label court
    Etant donné l'offre « Visite guidée des collections » de label court « VG »
    Et la vue « Plan Accueil » ouverte
    Alors le bandeau de l'offre affiche « VG »

  Scénario: Bandeau d'offre sans label court — nom complet affiché
    Etant donné l'offre « Visite guidée des collections » sans label court
    Et la vue « Plan Accueil » ouverte
    Alors le bandeau de l'offre affiche le nom complet « Visite guidée des collections »

  # ------------------------------------------------------------------
  # Impression
  # ------------------------------------------------------------------

  Scénario: L'impression de la vue quotidienne utilise le label court
    Etant donné l'offre « Visite guidée des collections » de label court « VG »
    Et un créneau de cette offre pour Alice le mardi de 10:00 à 12:00
    Et la vue quotidienne affichant ce mardi
    Quand le coordinateur imprime la vue quotidienne
    Alors le bloc du créneau sur la page imprimée affiche « VG »
    Et le nom complet n'apparaît pas dans le bloc

  # ------------------------------------------------------------------
  # Cas limites
  # ------------------------------------------------------------------

  Scénario: Label court très long tronqué dans le bloc
    Etant donné l'offre « Visite guidée des collections » de label court « Visite exceptionnelle des collections permanentes »
    Et un créneau de cette offre pour Alice le mardi de 10:00 à 11:00
    Et la vue quotidienne affichant ce mardi
    Alors le texte du label court est tronqué avec une ellipse à l'intérieur du bloc
    Et le texte complet est disponible dans l'infobulle du bloc au survol
    Et le bloc ne déborde pas de sa voie ni ne chevauche le créneau voisin
