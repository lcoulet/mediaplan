# language: fr
# Capability: Type de contrat d'un médiateur — champ optionnel, texte libre
# avec suggestions prédéfinies, affichage en pilule à côté du nom.
# Décision design (2026-09-25/26) : Mediator reçoit un contractType
# optionnel. Suggestions prédéfinies: temps plein, mi-temps,
# stagiaire. Affiché en pilule à côté du nom du médiateur.

Fonctionnalité: Type de contrat d'un médiateur
  En tant que coordinateur
  Je veux renseigner et voir le type de contrat de chaque médiateur
  Afin d'identifier d'un coup d'œil le statut des médiateurs dans le planning

  Contexte:
    Soit la vue « Médiateurs » ouverte
    Et le médiateur « Alice » existant sans type de contrat renseigné

  # ------------------------------------------------------------------
  # Champ optionnel
  # ------------------------------------------------------------------

  Scénario: Aucun type de contrat par défaut
    Alors Alice n'a aucun type de contrat renseigné
    Et aucune pilule de type de contrat n'est affichée à côté de son nom

  Scénario: Type de contrat optionnel — validation sans renseigner
    Quand le coordinateur enregistre la fiche d'Alice sans renseigner le type de contrat
    Alors l'enregistrement réussit
    Et Alice n'a toujours aucun type de contrat

  Scénario: Effacer le type de contrat
    Etant donné le type de contrat d'Alice « temps plein »
    Quand le coordinateur efface le type de contrat d'Alice
    Alors Alice n'a plus aucun type de contrat
    Et aucune pilule n'est affichée à côté de son nom

  # ------------------------------------------------------------------
  # Sélecteur avec suggestions et texte libre
  # ------------------------------------------------------------------

  Scénario: Suggestions prédéfinies affichées dans le sélecteur
    Quand le coordinateur ouvre le sélecteur de type de contrat d'Alice
    Alors les suggestions « temps plein », « mi-temps » et « stagiaire » sont proposées

  Scénario: Choisir une suggestion prédéfinie
    Quand le coordinateur ouvre le sélecteur de type de contrat d'Alice
    Et le coordinateur choisit la suggestion « temps plein »
    Alors le type de contrat d'Alice est « temps plein »

  Scénario: Saisie libre d'un type de contrat personnalisé
    Quand le coordinateur saisit « vacataire 3 jours » dans le champ type de contrat d'Alice
    Et le coordinateur enregistre
    Alors le type de contrat d'Alice est « vacataire 3 jours »

  Scénario: Remplacer un type de contrat par un autre
    Etant donné le type de contrat d'Alice « stagiaire »
    Quand le coordinateur remplace le type de contrat par « temps plein »
    Alors le type de contrat d'Alice est « temps plein »

  Scénario: Le type de contrat est une chaîne libre sans validation de format
    Quand le coordinateur saisit « Mi-TeMpS 50% — CDI » dans le champ type de contrat d'Alice
    Et le coordinateur enregistre
    Alors le type de contrat d'Alice est exactement « Mi-TeMpS 50% — CDI »

  # ------------------------------------------------------------------
  # Affichage en pilule
  # ------------------------------------------------------------------

  Scénario: Pilule du type de contrat à côté du nom dans la vue Médiateurs
    Etant donné le type de contrat d'Alice « temps plein »
    Alors la vue « Médiateurs » affiche une pilule « temps plein » à côté du nom d'Alice

  Scénario: Pilule du type de contrat à côté du nom dans la vue quotidienne
    Etant donné le type de contrat d'Alice « stagiaire »
    Et la vue quotidienne ouverte
    Alors la barre de la voie d'Alice affiche une pilule « stagiaire » à côté de son nom

  Scénario: Pilule affichée avec la pilule de semaine de cycle
    Etant donné le type de contrat d'Alice « temps plein »
    Et le cycle de travail d'Alice composé des semaines « S1 » et « S2 »
    Et la semaine de cycle active pour la date affichée « S2 »
    Et la vue quotidienne affichant cette date
    Alors la barre de la voie d'Alice affiche la pilule « temps plein » à côté de son nom
    Et la barre de la voie d'Alice affiche la pilule « S2 » à côté de son nom

  Scénario: Texte libre long affiché tronqué dans la pilule
    Etant donné le type de contrat d'Alice « vacataire longue durée renouvelable 24 mois »
    Alors la pilule affichée à côté de son nom reste lisible
    Et le texte complet reste accessible

  Plan du scénario: Chaque suggestion prédéfinie est affichable en pilule
    Quand le coordinateur choisit la suggestion « <contrat> » pour Alice
    Alors le type de contrat d'Alice est « <contrat> »
    Et une pilule « <contrat> » est affichée à côté du nom d'Alice

    Exemples:
      | contrat                  |
      | temps plein              |
      | mi-temps                 |
      | stagiaire                |
