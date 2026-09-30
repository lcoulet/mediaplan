# language: fr
# Capability: Impression de la vue quotidienne — lisibilité sur A4
# paysage : axe temporel 08:30-19:00 extensible, blocs compacts au label
# court, hachures de cycle conservées, tenue sur une seule page.
# Références: docs/LEXICON.md (Day view = Vue quotidienne ;
#             Short label = Label court ; Print = Impression ;
#             Work cycle = Cycle de travail).
# Décisions design arrêtées le 2026-09-29 :
#   1. Axe temporel d'impression : début FIXE 08:30, fin FIXE 19:00.
#   2. L'axe s'ÉTEND à gauche et/ou à droite si un bloc de créneau
#      (montage inclus, démontage inclus) dépasse la plage — p.ex. un
#      créneau à 06:00 étend l'axe à gauche.
#   3. Les blocs imprimés affichent la pastille d'offre et le label court
#      (voir short-label.feature) avec des hauteurs compactes.
#   4. Les hachures horaires hors cycle de travail sont conservées à
#      l'impression.
#   5. A4 paysage : la journée entière tient sur UNE page en largeur,
#      sans découpage horizontal.

Fonctionnalité: Impression de la vue quotidienne au format A4 paysage
  En tant que coordinateur
  Je veux imprimer la vue quotidienne de façon lisible sur une seule page A4 paysage
  Afin d'afficher le planning du jour au mur de la régie et de le distribuer aux médiateurs

  Contexte:
    Soit la vue quotidienne affichant le mardi 29 septembre 2026
    Et le mode impression activé

  # ------------------------------------------------------------------
  # Axe temporel
  # ------------------------------------------------------------------

  Scénario: Axe temporel fixe 08:30-19:00 par défaut
    Etant donné aucun créneau ce jour-là
    Quand le coordinateur imprime la vue quotidienne
    Alors l'axe temporel imprimé commence à 08:30
    Et l'axe temporel imprimé se termine à 19:00

  Scénario: Créneau à 06:00 — l'axe s'étend à gauche
    Etant donné un créneau de 06:00 à 07:30 pour Alice
    Quand le coordinateur imprime la vue quotidienne
    Alors l'axe temporel imprimé commence avant ou à 06:00
    Et l'axe temporel imprimé se termine à 19:00
    Et le bloc du créneau est entièrement visible et proportionné sur l'axe

  Scénario: Créneau après 19:00 — l'axe s'étend à droite
    Etant donné un créneau de 19:30 à 21:00 pour Alice
    Quand le coordinateur imprime la vue quotidienne
    Alors l'axe temporel imprimé commence à 08:30
    Et l'axe temporel imprimé se termine après ou à 21:00
    Et le bloc du créneau est entièrement visible

  Scénario: Le montage du créneau étend l'axe à gauche
    Etant donné l'offre « Visite guidée » avec un temps de montage de 30 minutes
    Et un créneau de cette offre pour Alice de 09:00 à 10:00
    Quand le coordinateur imprime la vue quotidienne
    Alors l'axe temporel imprimé commence avant ou à 08:30 pour couvrir le début du montage à 08:30
    Et la zone de montage du créneau est visible sur l'axe

  Scénario: Le démontage du créneau étend l'axe à droite
    Etant donné l'offre « Visite guidée » avec un temps de démontage de 45 minutes
    Et un créneau de cette offre pour Alice de 18:45 à 19:00
    Quand le coordinateur imprime la vue quotidienne
    Alors l'axe temporel imprimé se termine après ou à 19:45
    Et la zone de démontage du créneau est visible sur l'axe

  # ------------------------------------------------------------------
  # Contenu des blocs
  # ------------------------------------------------------------------

  Scénario: Bloc imprimé compact affichant pastille et label court
    Etant donné l'offre « Visite guidée » de couleur #E65100 et de label court « VG »
    Et un créneau de cette offre pour Alice de 10:00 à 11:00
    Quand le coordinateur imprime la vue quotidienne
    Alors le bloc imprimé affiche la pastille de couleur #E65100
    Et le bloc imprimé affiche le label court « VG » à côté de la pastille
    Et le bloc imprimé a une hauteur compacte adaptée à l'échelle d'impression

  Scénario: Bloc d'une offre sans label court — nom complet imprimé
    Etant donné l'offre « Visite guidée des collections » sans label court
    Et un créneau de cette offre pour Alice de 10:00 à 11:00
    Quand le coordinateur imprime la vue quotidienne
    Alors le bloc imprimé affiche le nom complet « Visite guidée des collections »

  Scénario: Hachures hors cycle de travail conservées à l'impression
    Etant donné le cycle de travail d'Alice composé de la semaine « S1 »
    Et la semaine S1 travaillée le mardi de 09:30 à 18:00
    Et la vue quotidienne affichant un mardi de la semaine de cycle S1
    Quand le coordinateur imprime la vue quotidienne
    Alors les zones hors plage horaire de travail de la voie d'Alice sont hachurées sur la page imprimée
    Et la zone de travail 09:30-18:00 n'est pas hachurée

  # ------------------------------------------------------------------
  # Comportements d'impression existants préservés
  # ------------------------------------------------------------------

  Scénario: En-tête d'impression avec la date
    Etant donné la vue quotidienne affichant le mardi 29 septembre 2026
    Quand le coordinateur imprime la vue quotidienne
    Alors la page imprimée comporte un en-tête d'impression avec la date du 29 septembre 2026

  Scénario: Barre d'outils et en-tête d'application masqués à l'impression
    Quand le coordinateur imprime la vue quotidienne
    Alors la barre d'outils de l'application n'apparaît pas sur la page imprimée
    Et l'en-tête de navigation n'apparaît pas sur la page imprimée

  # ------------------------------------------------------------------
  # Tenue sur une seule page A4 paysage
  # ------------------------------------------------------------------

  Scénario: Journée entière sur une seule page A4 paysage
    Etant donné un créneau de 08:30 à 19:00 pour Alice
    Quand le coordinateur imprime la vue quotidienne
    Alors la page imprimée est au format A4 paysage
    Et l'axe temporel complet tient en largeur sur une seule page
    Et aucun découpage horizontal de l'axe n'introduit une seconde page en largeur

  Scénario: Pilules de cycle et de contrat imprimées si présentes
    Etant donné le cycle de travail d'Alice composé des semaines « S1 » et « S2 »
    Et la rotation ancrée sur la semaine ISO 2026-W40 avec « S1 »
    Et Alice avec un type de contrat « CDI » affiché en pilule dans la vue quotidienne
    Et la vue quotidienne affichant le mardi de la semaine ISO 2026-W41
    Quand le coordinateur imprime la vue quotidienne
    Alors la pilule de semaine de cycle « S2 » apparaît sur la page imprimée
    Et la pilule de contrat « CDI » apparaît sur la page imprimée

  # ------------------------------------------------------------------
  # Cas limites
  # ------------------------------------------------------------------

  Scénario: Impression d'une journée sans créneau
    Etant donné aucun créneau ce jour-là
    Quand le coordinateur imprime la vue quotidienne
    Alors la page imprimée s'imprime sans erreur
    Et l'axe temporel 08:30-19:00 est imprimé
    Et aucun bloc de créneau n'apparaît
