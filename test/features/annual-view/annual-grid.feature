# language: fr
# Capability: Tableau de fonctionnement — grille annuelle des médiateurs :
# structure de la grille, présence dérivée du cycle, couleurs, affichage du
# cycle, compteur de samedis travaillés, fériés, solde trimestriel, export.
# Références: docs/LEXICON.md ; docs/OPEN-QUESTIONS.md
#   (sections « Mediator Annual Planning View », « Work cycles »,
#   « Hourly management ») ; vue quotidienne pour le refus des jours de
#   fermeture.
# Décisions design arrêtées le 2026-10-03 :
#   1. Grille annuelle : lignes = TOUS les jours de l'année (week-ends
#      compris), colonnes = médiateurs, UNE cellule par demi-journée
#      (Matin / Après-midi).
#   2. Numéros de semaine ISO affichés sur les lignes du lundi (« S 37 ») ;
#      l'année est commutable (2026, 2027...).
#   3. La semaine de cycle (S1, S2...) d'un médiateur est affichée une fois
#      par semaine (zone de la cellule du lundi), valable pour toute la
#      semaine ISO.
#   4. La présence orange est DÉRIVÉE du cycle (calculée, jamais stockée —
#      src/domain/cycles.ts) ; effacer une cellule revient à l'état dérivé.
#   5. Couleurs (palette mixte Excel + AA, décision 2026-10-03) : orange
#      vide = présence dérivée du cycle ; jaune + code
#      (CA, RHS, RTT, AM, CET, CEX, congé parental/maternité/naissance,
#      dispo, TPT) = absence ; rose + TELE = télétravail ; violet + amgt
#      JJ/MM = aménagement d'un jour travaillé ; bleu + code = souhait en
#      attente (CA/RHS/RTT — type leave_request, distinct du congé
#      confirmé en jaune) ; vert + JDM = mission Jardins du muséum ;
#      orange + texte (Réf. WE, missions, événements) = mission / spécial ;
#      rouge + code (grève, syndicat, formation) = absence liée au travail.
#      Les teintes viennent du fichier Excel de référence (violet #CC99FF =
#      amgt, bleu #99CCFF = souhaits, rose #FF8080 = TELE, vert #99CC00 =
#      JDM), assombries pour la conformité WCAG (contrastes calculés dans
#      contrast_palette_mix.py : violet #7B5AA0 = 5,51 ; bleu #4178AB =
#      4,67 ; rose #B85555 = 4,70 ; vert #2F7A4A = 5,25).
#   6. Jours de fermeture du musée (25/12, 01/01, 01/05) surlignés.
#   7. Compteur de samedis travaillés CALCULÉ automatiquement (samedis de
#      l'année avec créneaux), affiché dans les lignes de samedi, remis à
#      zéro chaque année — alimente le seuil des samedis valorisés
#      (valuedSaturdayThreshold dans src/domain/hours.ts).
#   8. Fériés : liste française par défaut calculée pour l'année
#      (frenchHolidays dans src/domain/hours.ts), MODIFIABLE dans cette
#      vue (ajout / retrait en dérogation, par année).
#   9. Colonnes de comptage (ratio, totaux de présence par jour) :
#      NON reproduites (2026-10-03).
#  10. Solde trimestriel affiché pour les médiateurs avec un aménagement
#      (reliquat / déficit reporté — computeQuarterlyBalance dans
#      src/domain/hours.ts).
#  11. Export Excel au format EXACT de la table de référence (SheetJS ;
#      lignes = jours avec jour de semaine + libellé de semaine ISO, un
#      groupe de colonnes par médiateur Matin/Après-midi, codes dans les
#      cellules, couleurs de remplissage). PAS d'impression/PDF en v1.
#  12. Les absences sont stockées PAR DATE et PAR DEMI-JOURNÉE : changer
#      d'année ne touche jamais aux données d'une autre année.

Fonctionnalité: Tableau de fonctionnement — grille annuelle des médiateurs
  En tant que coordinateur
  Je veux visualiser sur une grille annuelle la présence et les absences de chaque médiateur
  Afin de piloter d'un coup d'œil le fonctionnement de la médiation sur toute l'année

  Contexte:
    Soit le tableau de fonctionnement ouvert sur l'année 2026
    Et les médiateurs « Alice » et « Bob » affichés en colonnes
    Et le cycle de travail d'Alice composé de la semaine « S1 » travaillée du lundi au vendredi de 09:30 à 18:00
    Et Bob sans cycle de travail défini

  # ------------------------------------------------------------------
  # Structure de la grille
  # ------------------------------------------------------------------

  Scénario: La grille liste tous les jours de l'année, week-ends compris
    Alors la grille comporte une ligne par jour de l'année 2026
    Et chaque ligne affiche le jour de la semaine et la date
    Et les lignes de samedi et de dimanche sont affichées comme les autres jours

  Scénario: Une cellule par demi-journée et par médiateur
    Alors chaque ligne de jour comporte 2 cellules par médiateur
    Et ces cellules correspondent au Matin et à l'Après-midi

  Scénario: Numéro de semaine ISO affiché sur les lignes du lundi
    Quand la grille affiche le lundi 7 septembre 2026
    Alors la ligne du lundi 7 septembre 2026 porte le libellé « S 37 »
    Et les lignes de mardi à dimanche ne portent pas de libellé de semaine

  Scénario: Année à 53 semaines ISO — libellés S 1 à S 53
    Alors la grille 2026 affiche des libellés de semaine de « S 1 » à « S 53 »
    Et la ligne du lundi 28 décembre 2026 porte le libellé « S 53 »

  Scénario: Commuter d'année
    Quand le coordinateur sélectionne l'année 2027 dans le sélecteur d'année
    Alors la grille affiche les jours de l'année 2027
    Et les numéros de semaine ISO sont recalculés pour 2027

  Scénario: Changer d'année préserve les données des autres années
    Etant donné une absence « CA » posée sur le matin du 15 juin 2026 pour Alice
    Quand le coordinateur sélectionne l'année 2027
    Alors la cellule du 15 juin 2027 matin d'Alice suit la présence dérivée, sans trace de l'absence de 2026
    Quand le coordinateur revient sur l'année 2026
    Alors la cellule du 15 juin 2026 matin d'Alice affiche toujours « CA » en jaune

  # ------------------------------------------------------------------
  # Affichage du cycle et présence dérivée
  # ------------------------------------------------------------------

  Scénario: Semaine de cycle affichée une fois par semaine ISO
    Alors la zone de la cellule du lundi de chaque semaine ISO affiche la semaine de cycle active d'Alice
    Et cette semaine de cycle est valable pour toute la semaine ISO
    Et les lignes de mardi à dimanche ne répètent pas la semaine de cycle

  Scénario: Présence orange dérivée du cycle
    Alors les cellules Matin et Après-midi des jours travaillés d'une semaine S1 d'Alice sont orange
    Et les cellules de samedi et de dimanche d'Alice n'affichent pas de présence dérivée

  Scénario: La présence dérivée n'est jamais stockée
    Quand le coordinateur retire le lundi des jours travaillés de S1 dans le cycle d'Alice
    Alors les cellules du lundi d'Alice redeviennent neutres dans toute la grille
    Et aucune donnée de présence n'a été écrite pour ces cellules

  Scénario: Médiateur sans cycle — cellules neutres
    Alors aucune cellule de Bob n'affiche de présence dérivée
    Et les cellules de Bob sont neutres, distinctes visuellement de l'orange de présence
    Et aucune semaine de cycle n'est affichée pour Bob

  # ------------------------------------------------------------------
  # Couleurs et codes
  # ------------------------------------------------------------------

  Scénario: Absence jaune avec code
    Etant donné une absence « CA » posée sur le matin du 10 juin 2026 pour Alice
    Alors la cellule du 10 juin 2026 matin d'Alice est jaune et affiche « CA »
    Et la cellule de l'après-midi du même jour reste à la présence dérivée

  Scénario: Télétravail rose avec « TELE »
    Etant donné un télétravail posé sur le matin du 11 juin 2026 pour Alice
    Alors la cellule du 11 juin 2026 matin d'Alice est rose et affiche « TELE »

  Scénario: Mission ou spécial orange avec texte
    Etant donné la mention « Réf. WE » posée sur le samedi 13 juin 2026 pour Alice
    Alors la cellule du 13 juin 2026 matin d'Alice est orange et affiche « Réf. WE »

  Scénario: Aménagement violet avec « amgt JJ/MM »
    Etant donné un aménagement « amgt 21/06 » posé sur le matin du 21 juin 2026 pour Alice
    Alors la cellule du 21 juin 2026 matin d'Alice est violette et affiche « amgt 21/06 »
    Et la couleur violette est distincte de l'orange des missions et de l'orange de présence dérivée

  Scénario: Souhait de congé bleu, distinct du congé confirmé en jaune
    Etant donné un souhait « CA » en attente posé sur le matin du 16 juin 2026 pour Alice
    Alors la cellule du 16 juin 2026 matin d'Alice est bleue et affiche « souhait CA »
    Et la cellule se distingue du congé confirmé, qui s'affiche en jaune
    Et le souhait est enregistré avec le type existant « leave_request »

  Scénario: Mission JDM verte aux Jardins du muséum
    Etant donné la mission « JDM » posée sur le matin du 18 juin 2026 pour Alice
    Alors la cellule du 18 juin 2026 matin d'Alice est verte et affiche « JDM »
    Et JDM est une mission aux Jardins du muséum, pas une absence

  Scénario: Absence liée au travail rouge avec code
    Etant donné une formation posée sur le matin du 9 juin 2026 pour Alice
    Alors la cellule du 9 juin 2026 matin d'Alice est rouge et affiche le code « formation »
    Et les codes grève et syndicat s'affichent de la même façon rouge

  Scénario: Congés spéciaux en jaune
    Etant donné un congé maternité posé sur le matin du 8 juin 2026 pour Alice
    Alors la cellule est jaune et affiche son code
    Et les congés parental et naissance ainsi que « dispo », « RTT », « CET » et « TPT » s'affichent en jaune avec leur code

  Scénario: Jours de fermeture du musée surlignés
    Alors les lignes du 1er janvier, du 1er mai et du 25 décembre sont surlignées
    Et le surlignage est visible quelle que soit l'année sélectionnée

  # ------------------------------------------------------------------
  # Compteur de samedis travaillés
  # ------------------------------------------------------------------

  Scénario: Compteur de samedis travaillés calculé automatiquement
    Etant donné des créneaux posés pour Alice sur 3 samedis de 2026
    Alors les lignes de samedi de la colonne d'Alice affichent un compteur croissant 1, 2, 3 au fil de l'année
    Et le compteur est calculé à partir des samedis avec créneaux, sans saisie manuelle

  Scénario: Aucun créneau le samedi — compteur à 0
    Etant donné Alice sans créneau posé un seul samedi de 2026
    Alors les lignes de samedi de la colonne d'Alice affichent le compteur 0

  Scénario: Le compteur se remet à zéro au changement d'année
    Etant donné des créneaux posés pour Alice sur 5 samedis de 2026
    Quand le coordinateur sélectionne l'année 2027
    Alors le compteur de samedis d'Alice repart de 0 pour 2027

  Scénario: Le compteur alimente le seuil des samedis valorisés
    Etant donné le seuil des samedis valorisés fixé à 10
    Et des créneaux posés pour Alice sur les 10 premiers samedis avec créneaux de 2026
    Alors le 10e samedi avec créneau d'Alice est valorisé selon valuedSaturdayThreshold
    Et les samedis avec créneau suivants sont valorisés

  # ------------------------------------------------------------------
  # Fériés
  # ------------------------------------------------------------------

  Scénario: Liste des fériés français calculée par défaut pour l'année
    Alors les jours fériés de la liste française par défaut de 2026 sont marqués dans la grille
    Et la liste est recalculée automatiquement pour chaque année sélectionnée

  Scénario: Ajout d'un férié en dérogation
    Quand le coordinateur ajoute le 10 août 2026 comme jour férié dans le tableau
    Alors la ligne du 10 août 2026 est marquée fériée
    Et le marquage par défaut des autres jours fériés est inchangé

  Scénario: Retrait d'un férié par dérogation
    Quand le coordinateur retire le 14 juillet 2026 de la liste des fériés
    Alors le 14 juillet 2026 n'est plus marqué férié
    Et les autres jours fériés de 2026 restent marqués

  Scénario: Les dérogations de fériés sont propres à chaque année
    Etant donné le 10 août 2026 ajouté comme férié en dérogation
    Quand le coordinateur sélectionne l'année 2027
    Alors le 10 août 2027 suit la liste des fériés par défaut de 2027, sans la dérogation de 2026

  # ------------------------------------------------------------------
  # Solde trimestriel et colonnes
  # ------------------------------------------------------------------

  Scénario: Solde trimestriel affiché pour un médiateur avec aménagement
    Etant donné Alice avec l'aménagement « temps partiel » et un quota d'heures configuré pour chaque trimestre
    Et un reliquat d'heures reporté du trimestre précédent
    Alors le tableau affiche le solde trimestriel d'Alice, reliquat ou déficit, calculé par computeQuarterlyBalance
    Et le solde affiché tient compte des heures consommées et du report

  Scénario: Pas de solde affiché sans aménagement
    Alors aucun solde trimestriel n'est affiché pour Bob
    Et aucun suivi de quota n'est déclenché pour Bob

  Scénario: Colonnes de comptage non reproduites
    Alors la grille ne comporte pas de colonne de ratio
    Et la grille ne comporte pas de colonnes de totaux de présence par jour
    Et le compteur de samedis reste affiché dans les lignes de samedi

  # ------------------------------------------------------------------
  # Export Excel
  # ------------------------------------------------------------------

  Scénario: Export Excel au format exact de la table de référence
    Quand le coordinateur clique sur le bouton « Exporter Excel »
    Alors un fichier .xlsx est généré via SheetJS
    Et les lignes du fichier correspondent aux jours de l'année avec le jour de la semaine et le libellé de semaine ISO
    Et le fichier comporte un groupe de colonnes par médiateur avec les cellules Matin et Après-midi
    Et les codes sont écrits dans les cellules avec les couleurs de remplissage de la légende de l'application
    Et aucune fonction d'impression ou d'export PDF n'est proposée pour cette vue en v1
