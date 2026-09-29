# language: fr
# Capability: Gestion fine des heures — aménagement, quota d'heures trimestriel,
# valorisation des jours (fériés, dimanches, samedis valorisés), jours fériés,
# avertissements légers de dépassement, report de reliquat/déficit,
# affichage du quota (fiche médiateur + tableau de fonctionnement).
# Références: docs/LEXICON.md (Work Cycle = Cycle de travail ; amplitude =
#             plage horaire de travail). La consommation d'heures comptée ici
#             est distincte de l'affichage d'amplitude (cf. cycle-model.feature).
# Décisions design arrêtées le 2026-09-29 :
#   1. DEUX champs distincts sur le médiateur : type de contrat
#      (temps plein, stagiaire...) ET aménagement (temps partiel,
#      mi-temps thérapeutique...). Le quota d'heures trimestriel s'applique
#      UNIQUEMENT aux médiateurs ayant un aménagement.
#   2. Quota d'heures trimestriel : configurable par trimestre (T1..T4)
#      et par médiateur. Les heures travaillées consomment le quota du
#      trimestre en cours.
#   3. Valorisation : les jours fériés comptent DOUBLE (×2). Les dimanches
#      et les samedis valorisés ont des multiplicateurs CONFIGURABLES
#      (valeurs exactes à fixer ; exemples ci-dessous avec dimanche ×1.5
#      et samedi valorisé ×1.5). Samedis valorisés : à partir du Nième
#      samedi de l'année inclus (N configurable, ex. 10 ou 12) ;
#      les premiers samedis comptent normalement (×1).
#   4. Dépassement/sous-consommation du quota : avertissement LÉGER non
#      bloquant. Le solde (reliquat ou déficit) est REPORTÉ au trimestre
#      suivant (solde courant cumulatif).
#   5. Affichage du quota : sur la fiche du médiateur ET dans le tableau
#      de fonctionnement (vue annuelle des jours de présence — vue future,
#      spécifiée ici uniquement sur ce qu'elle doit y afficher : les compteurs
#      trimestriels).
#   6. Jours fériés : liste française par défaut calculée automatiquement
#      pour chaque année (Jour de l'An, Lundi de Pâques, 1er Mai, 8 Mai,
#      Ascension, Lundi de Pentecôte, 14 Juillet, 15 Août, 1er Novembre,
#      11 Novembre, 25 Décembre), modifiable (ajout/retrait par année).
#      Musée FERMÉ le 25/12, 01/01 et 01/05 (aucun travail possible).
#   7. Heures travaillées = créneaux attribués au médiateur, dans sa plage
#      horaire de travail par cycle. La durée du créneau, INSTALLATION ET
#      DÉMONTAGE INCLUS (temps payé), constitue la base d'heures travaillées.
#   8. Calcul trimestriel : un trimestre = trimestre calendaire
#      (T1 janvier-mars, T2 avril-juin, T3 juillet-septembre,
#      T4 octobre-décembre). Les heures sont attribuées au trimestre de la
#      DATE du créneau.

Fonctionnalité: Gestion fine des heures des médiateurs à temps partiel
  En tant que coordinateur
  Je veux suivre le quota d'heures trimestriel des médiateurs avec aménagement
  Afin de piloter finement les heures des temps partiels et de respecter leurs aménagements

  Contexte:
    Soit la vue « Médiateurs » ouverte
    Et le médiateur « Alice » existant sans aménagement défini
    Et l'année affichée 2026

  # ------------------------------------------------------------------
  # Champ aménagement — distinct du type de contrat
  # ------------------------------------------------------------------

  Scénario: L'aménagement est un champ distinct du type de contrat
    Etant donné le type de contrat d'Alice « temps plein »
    Quand le coordinateur renseigne l'aménagement d'Alice « mi-temps thérapeutique »
    Alors l'aménagement d'Alice est « mi-temps thérapeutique »
    Et le type de contrat d'Alice reste « temps plein »

  Scénario: Aménagement sans type de contrat et inversement
    Quand le coordinateur renseigne l'aménagement d'Alice « temps partiel » sans renseigner le type de contrat
    Alors l'enregistrement réussit
    Et l'aménagement d'Alice est « temps partiel »
    Et Alice n'a aucun type de contrat renseigné

  Scénario: Effacer l'aménagement ne touche pas au type de contrat
    Etant donné le type de contrat d'Alice « stagiaire »
    Et l'aménagement d'Alice « temps partiel »
    Quand le coordinateur efface l'aménagement d'Alice
    Alors Alice n'a plus d'aménagement
    Et le type de contrat d'Alice reste « stagiaire »

  # ------------------------------------------------------------------
  # Champ aménagement — texte libre avec suggestions
  # ------------------------------------------------------------------

  Scénario: Suggestions prédéfinies d'aménagement
    Quand le coordinateur ouvre le sélecteur d'aménagement d'Alice
    Alors les suggestions « temps partiel », « mi-temps thérapeutique » et « 80% » sont proposées

  Scénario: Saisie libre d'un aménagement personnalisé
    Quand le coordinateur saisit « 4/5 congé parental » dans le champ aménagement d'Alice
    Et le coordinateur enregistre
    Alors l'aménagement d'Alice est exactement « 4/5 congé parental »

  Scénario: Modifier l'aménagement d'un médiateur
    Etant donné l'aménagement d'Alice « temps partiel »
    Quand le coordinateur remplace l'aménagement d'Alice par « mi-temps thérapeutique »
    Alors l'aménagement d'Alice est « mi-temps thérapeutique »

  # ------------------------------------------------------------------
  # Qui est soumis au quota d'heures trimestriel
  # ------------------------------------------------------------------

  Scénario: Médiateur sans aménagement — aucun quota suivi, aucun avertissement
    Etant donné le type de contrat d'Alice « temps plein »
    Et Alice sans aménagement
    Quand le coordinateur crée un créneau pour Alice de 10:00 à 18:00 le mardi 06/01/2026
    Alors le créneau est créé
    Et aucun quota d'heures n'est suivi pour Alice
    Et aucun avertissement de quota n'est affiché

  Scénario: Le type de contrat seul ne déclenche pas le suivi de quota
    Etant donné le type de contrat d'Alice « temps plein »
    Et Alice sans aménagement
    Quand le coordinateur configure un quota d'heures pour Alice au T1 2026
    Alors la configuration est refusée avec le message « Le quota d'heures s'applique uniquement aux médiateurs avec aménagement »

  Scénario: Aménagement renseigné mais quota non configuré — pas de suivi
    Etant donné l'aménagement d'Alice « temps partiel »
    Et aucun quota d'heures configuré pour Alice en 2026
    Quand le coordinateur crée un créneau pour Alice de 10:00 à 18:00 le mardi 06/01/2026
    Alors le créneau est créé
    Et aucune consommation d'heures n'est comptée pour Alice
    Et aucun avertissement de quota n'est affiché
    Et la fiche d'Alice indique « quota non configuré » pour le trimestre concerné

  # ------------------------------------------------------------------
  # Configuration du quota trimestriel
  # ------------------------------------------------------------------

  Scénario: Configurer un quota d'heures par trimestre et par médiateur
    Etant donné l'aménagement d'Alice « temps partiel »
    Quand le coordinateur configure pour Alice les quotas T1 2026 à 120 heures, T2 2026 à 100 heures, T3 2026 à 100 heures et T4 2026 à 100 heures
    Alors le quota T1 2026 d'Alice est 120 heures
    Et le quota T2 2026 d'Alice est 100 heures
    Et le quota T3 2026 d'Alice est 100 heures
    Et le quota T4 2026 d'Alice est 100 heures

  Scénario: Le quota par défaut d'un trimestre est vide — aucun suivi jusqu'à configuration
    Etant donné l'aménagement d'Alice « temps partiel »
    Et le quota T1 2026 d'Alice configuré à 120 heures
    Alors le quota T2 2026 d'Alice est vide
    Et les heures travaillées par Alice en avril 2026 ne consomment aucun quota
    Et aucun avertissement de quota n'est affiché pour le T2 2026

  Scénario: Ajuster le quota d'un trimestre déjà entamé
    Etant donné l'aménagement d'Alice « temps partiel »
    Et le quota T1 2026 d'Alice configuré à 120 heures
    Et un créneau pour Alice de 10:00 à 18:00 le mardi 06/01/2026
    Quand le coordinateur ajuste le quota T1 2026 d'Alice à 90 heures
    Alors la consommation d'heures T1 d'Alice reste 8 heures
    Et le solde T1 d'Alice est recalculé par rapport à 90 heures

  # ------------------------------------------------------------------
  # Heures travaillées — base de comptage
  # ------------------------------------------------------------------

  Scénario: La durée du créneau consomme le quota du trimestre de sa date
    Etant donné l'aménagement d'Alice « temps partiel »
    Et le quota T1 2026 d'Alice configuré à 120 heures
    Et le quota T2 2026 d'Alice configuré à 100 heures
    Quand le coordinateur crée un créneau pour Alice de 10:00 à 18:00 le mardi 31/03/2026
    Et le coordinateur crée un créneau pour Alice de 10:00 à 13:00 le mercredi 01/04/2026
    Alors la consommation T1 2026 d'Alice est 8 heures
    Et la consommation T2 2026 d'Alice est 3 heures

  Scénario: Installation et démontage inclus dans les heures travaillées
    Etant donné l'aménagement d'Alice « temps partiel »
    Et le quota T1 2026 d'Alice configuré à 120 heures
    Et un créneau pour Alice le mardi 06/01/2026 de 10:00 à 18:00 avec 30 minutes d'installation avant et 30 minutes de démontage après
    Alors la consommation T1 2026 d'Alice est 9 heures

  Scénario: Créneau sur un jour non travaillé — avertissement léger mais heures comptées
    Etant donné l'aménagement d'Alice « temps partiel »
    Et le quota T1 2026 d'Alice configuré à 120 heures
    Et le cycle de travail d'Alice avec la semaine « S1 » travaillée du lundi au vendredi de 09:30 à 18:00
    Quand le coordinateur crée un créneau pour Alice le dimanche 08/02/2026 de 10:00 à 12:00
    Alors un avertissement léger signale que le dimanche 08/02/2026 n'est pas un jour travaillé d'Alice
    Et le créneau est créé
    Et les 2 heures du créneau comptent dans la consommation T1 2026 d'Alice

  # ------------------------------------------------------------------
  # Valorisation des jours
  # ------------------------------------------------------------------

  Scénario: Jour férié compté double
    Etant donné l'aménagement d'Alice « temps partiel »
    Et le quota T2 2026 d'Alice configuré à 100 heures
    Et le vendredi 08/05/2026 férié (8 Mai)
    Quand le coordinateur crée un créneau pour Alice de 10:00 à 18:00 le vendredi 08/05/2026
    Alors la consommation T2 2026 d'Alice augmente de 16 heures
    Et la fiche d'Alice détaille « 8 heures × 2 (jour férié) »

  Scénario: Multiplicateur du dimanche configurable
    Etant donné l'aménagement d'Alice « temps partiel »
    Et le quota T1 2026 d'Alice configuré à 120 heures
    Et le multiplicateur dimanche réglé à 1.5
    Quand le coordinateur crée un créneau pour Alice de 10:00 à 14:00 le dimanche 08/02/2026
    Alors la consommation T1 2026 d'Alice augmente de 6 heures
    Et la fiche d'Alice détaille « 4 heures × 1.5 (dimanche) »

  Scénario: Modifier le multiplicateur du dimanche change la valorisation des créneaux futurs
    Etant donné l'aménagement d'Alice « temps partiel »
    Et le quota T1 2026 d'Alice configuré à 120 heures
    Et le multiplicateur dimanche réglé à 1.5
    Et un créneau pour Alice de 10:00 à 14:00 le dimanche 08/02/2026
    Quand le coordinateur règle le multiplicateur dimanche à 2
    Alors la consommation T1 2026 d'Alice est recalculée à 8 heures

  Scénario: Samedis valorisés à partir du Nième samedi de l'année — N configurable
    Etant donné l'aménagement d'Alice « temps partiel »
    Et le quota T1 2026 d'Alice configuré à 120 heures
    Et le paramètre « samedis valorisés à partir du » réglé à 12
    Et le multiplicateur samedi valorisé réglé à 1.5
    Quand le coordinateur crée un créneau pour Alice de 10:00 à 18:00 le samedi 28/03/2026
    Alors la consommation T1 2026 d'Alice augmente de 12 heures
    Et la fiche d'Alice détaille « 8 heures × 1.5 (samedi valorisé, 13e samedi de l'année) »

  Scénario: Samedi antérieur au Nième samedi — compté normalement
    Etant donné l'aménagement d'Alice « temps partiel »
    Et le quota T1 2026 d'Alice configuré à 120 heures
    Et le paramètre « samedis valorisés à partir du » réglé à 12
    Quand le coordinateur crée un créneau pour Alice de 10:00 à 18:00 le samedi 31/01/2026
    Alors la consommation T1 2026 d'Alice augmente de 8 heures
    Et aucun multiplicateur de samedi valorisé n'est appliqué

  Scénario: Un jour férié tombant un samedi ou un dimanche prime sur la valorisation du week-end
    Etant donné l'aménagement d'Alice « temps partiel »
    Et le quota T3 2026 d'Alice configuré à 100 heures
    Et le multiplicateur dimanche réglé à 1.5
    Et le paramètre « samedis valorisés à partir du » réglé à 12
    Et le samedi 15/08/2026 férié (15 Août)
    Quand le coordinateur crée un créneau pour Alice de 10:00 à 18:00 le samedi 15/08/2026
    Alors la consommation T3 2026 d'Alice augmente de 16 heures
    Et la fiche d'Alice détaille « 8 heures × 2 (jour férié) »
    Et la fiche n'applique pas le multiplicateur de samedi valorisé

  # ------------------------------------------------------------------
  # Jours fériés — liste par défaut et modification
  # ------------------------------------------------------------------

  Scénario: Liste française des jours fériés calculée automatiquement pour l'année
    Quand le coordinateur ouvre la liste des jours fériés de 2026
    Alors la liste contient le 01/01/2026 (Jour de l'An), le 06/04/2026 (Lundi de Pâques), le 01/05/2026 (1er Mai), le 08/05/2026 (8 Mai), le 14/05/2026 (Ascension), le 25/05/2026 (Lundi de Pentecôte), le 14/07/2026 (14 Juillet), le 15/08/2026 (15 Août), le 01/11/2026 (1er Novembre), le 11/11/2026 (11 Novembre) et le 25/12/2026 (25 Décembre)

  Scénario: Ajouter un jour férié pour une année donnée
    Quand le coordinateur ajoute le 26/05/2026 comme jour férié de 2026
    Alors le 26/05/2026 est un jour férié en 2026
    Et un créneau d'Alice ce jour-là est compté double

  Scénario: Retirer un jour férié pour une année donnée
    Etant donné le 08/05/2026 férié en 2026
    Quand le coordinateur retire le 08/05/2026 de la liste des jours fériés 2026
    Alors le 08/05/2026 n'est plus un jour férié en 2026
    Et un créneau d'Alice ce jour-là est compté normalement

  Scénario: La modification des jours fériés d'une année ne touche pas les autres années
    Quand le coordinateur retire le 08/05/2026 de la liste des jours fériés 2026
    Alors la liste des jours fériés 2027 contient toujours le 08/05/2027

  Scénario: Jour de fermeture du musée — tentative d'attribution avertie et refusée
    Etant donné le 25/12/2026 férié et le musée fermé
    Quand le coordinateur tente de créer un créneau pour Alice le 25/12/2026
    Alors un avertissement signale « Le musée est fermé le 25/12/2026 — aucun travail n'est possible »
    Et la création du créneau est refusée
    Et aucune heure ne consomme le quota d'Alice ce jour-là

  Scénario: Tentative d'attribution le 01/05 et le 01/01 — fermeture du musée
    Etant donné le 01/05/2026 et le 01/01/2027 comme jours de fermeture du musée
    Quand le coordinateur tente de créer un créneau pour Alice le 01/05/2026
    Alors un avertissement signale que le musée est fermé ce jour-là
    Quand le coordinateur tente de créer un créneau pour Alice le 01/01/2027
    Alors un avertissement signale que le musée est fermé ce jour-là

  # ------------------------------------------------------------------
  # Dépassement et sous-consommation — avertissement léger et report
  # ------------------------------------------------------------------

  Scénario: Dépassement du quota trimestriel — avertissement léger non bloquant
    Etant donné l'aménagement d'Alice « temps partiel »
    Et le quota T1 2026 d'Alice configuré à 120 heures
    Et la consommation T1 2026 d'Alice à 118 heures
    Quand le coordinateur crée un créneau pour Alice de 10:00 à 13:00 le mardi 31/03/2026
    Alors un avertissement léger signale « Quota T1 2026 dépassé : 121 heures consommées pour un quota de 120 heures »
    Et l'avertissement n'empêche pas la création du créneau
    Et le créneau est créé

  Scénario: L'avertissement de dépassement est visible sur la fiche du médiateur
    Etant donné l'aménagement d'Alice « temps partiel »
    Et le quota T1 2026 d'Alice configuré à 120 heures
    Et la consommation T1 2026 d'Alice à 130 heures
    Alors la fiche d'Alice affiche l'avertissement « Quota T1 2026 dépassé de 10 heures »
    Et la fiche affiche le déficit de 10 heures

  Scénario: Reliquat du trimestre reporté sur le quota du trimestre suivant
    Etant donné l'aménagement d'Alice « temps partiel »
    Et le quota T1 2026 d'Alice configuré à 120 heures
    Et le quota T2 2026 d'Alice configuré à 100 heures
    Et la consommation T1 2026 d'Alice à 100 heures
    Alors le solde T1 2026 d'Alice est un reliquat de 20 heures
    Et le quota effectif T2 2026 d'Alice est 120 heures

  Scénario: Déficit du trimestre reporté sur le quota du trimestre suivant
    Etant donné l'aménagement d'Alice « temps partiel »
    Et le quota T1 2026 d'Alice configuré à 120 heures
    Et le quota T2 2026 d'Alice configuré à 100 heures
    Et la consommation T1 2026 d'Alice à 130 heures
    Alors le solde T1 2026 d'Alice est un déficit de 10 heures
    Et le quota effectif T2 2026 d'Alice est 90 heures

  Scénario: Solde courant cumulatif sur plusieurs trimestres
    Etant donné l'aménagement d'Alice « temps partiel »
    Et le quota T1 2026 d'Alice configuré à 120 heures
    Et le quota T2 2026 d'Alice configuré à 100 heures
    Et le quota T3 2026 d'Alice configuré à 100 heures
    Et la consommation T1 2026 d'Alice à 100 heures
    Et la consommation T2 2026 d'Alice à 115 heures
    Alors le solde courant à la fin du T2 2026 est un reliquat de 5 heures
    Et le quota effectif T3 2026 d'Alice est 105 heures

  Scénario: Le report de solde ne s'applique qu'aux médiateurs avec aménagement et quota configuré
    Etant donné le médiateur « Bob » sans aménagement
    Quand le coordinateur consulte la fiche de Bob
    Alors aucune mention de quota, de reliquat ou de déficit n'est affichée pour Bob

  # ------------------------------------------------------------------
  # Changement d'aménagement en cours de trimestre
  # ------------------------------------------------------------------

  Scénario: Aménagement ajouté en cours de trimestre — quota suivi à partir de la configuration
    Etant donné Alice sans aménagement jusqu'au 15/02/2026
    Et un créneau pour Alice de 10:00 à 18:00 le mardi 10/02/2026
    Quand le coordinateur renseigne l'aménagement « temps partiel » d'Alice le 15/02/2026
    Et le coordinateur configure le quota T1 2026 d'Alice à 120 heures
    Alors les 8 heures du créneau du 10/02/2026 ne consomment pas le quota T1 2026 d'Alice
    Et seules les heures des créneaux postérieurs à la configuration consomment le quota

  Scénario: Changement d'aménagement en cours de trimestre ne réinitialise pas le suivi
    Etant donné l'aménagement d'Alice « temps partiel »
    Et le quota T1 2026 d'Alice configuré à 120 heures
    Et la consommation T1 2026 d'Alice à 50 heures
    Quand le coordinateur remplace l'aménagement d'Alice par « mi-temps thérapeutique » le 15/02/2026
    Alors la consommation T1 2026 d'Alice reste 50 heures
    Et le quota T1 2026 d'Alice reste 120 heures

  Scénario: Aménagement retiré en cours de trimestre — arrêt du suivi
    Etant donné l'aménagement d'Alice « temps partiel »
    Et le quota T1 2026 d'Alice configuré à 120 heures
    Et la consommation T1 2026 d'Alice à 50 heures
    Quand le coordinateur efface l'aménagement d'Alice le 15/02/2026
    Alors les créneaux postérieurs au 15/02/2026 ne consomment plus le quota d'Alice
    Et aucun avertissement de quota n'est plus affiché pour Alice

  # ------------------------------------------------------------------
  # Affichage du quota
  # ------------------------------------------------------------------

  Scénario: Compteurs du trimestre affichés sur la fiche du médiateur
    Etant donné l'aménagement d'Alice « temps partiel »
    Et le quota T1 2026 d'Alice configuré à 120 heures
    Et la consommation T1 2026 d'Alice à 100 heures
    Alors la fiche d'Alice affiche pour le T1 2026 le quota de 120 heures
    Et la fiche affiche la consommation de 100 heures
    Et la fiche affiche le solde de 20 heures restantes

  Scénario: Le tableau de fonctionnement affiche les compteurs trimestriels
    Etant donné l'aménagement d'Alice « temps partiel »
    Et le quota T1 2026 d'Alice configuré à 120 heures
    Et le quota T2 2026 d'Alice configuré à 100 heures
    Et la consommation T1 2026 d'Alice à 110 heures
    Quand le coordinateur ouvre le tableau de fonctionnement de l'année 2026
    Alors la ligne d'Alice affiche le compteur T1 2026 : quota 120 heures, consommé 110 heures, solde 10 heures
    Et la ligne d'Alice affiche le compteur T2 2026 : quota 100 heures, consommé 0 heure, solde 10 heures

  Scénario: Le tableau de fonctionnement n'affiche pas de compteurs sans aménagement
    Etant donné le médiateur « Bob » sans aménagement
    Quand le coordinateur ouvre le tableau de fonctionnement de l'année 2026
    Alors la ligne de Bob n'affiche aucun compteur trimestriel d'heures
