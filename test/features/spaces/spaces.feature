# language: fr
# Capability: Espaces — entité Space (Espace), migration automatique des
# emplacements libres, création automatique via import Secutix, gestion de la
# liste dans la vue Configuration, couleur d'espace comme signal principal
# de la vue jour et du plan accueil.
# Références: docs/LEXICON.md (Space = Espace ; Offer = Offre ;
#             Slot = Créneau ; Day view = Vue quotidienne ;
#             Plan Accueil = vue Plan Accueil).
# Décisions design arrêtées le 2026-09-29 :
#   1. Un espace est défini par : id, nom, couleur (hexadécimal).
#   2. La liste des espaces est gérée dans la vue « Configuration »
#      (voir configuration-view.feature).
#   3. Suppression d'un espace : REFUSÉE tant qu'une offre ou un créneau
#      référence cet espace (pas de ré-attribution automatique ; décision
#      du 2026-09-29 : le refus est le comportement le plus simple et sûr).
#   4. Migration automatique au premier chargement : chaque valeur distincte
#      non vide de « location » (offres et créneaux) devient un espace,
#      couleur attribuée depuis une palette par défaut agréable en cycle —
#      JAMAIS blanc (le blanc est réservé aux espaces auto-créés par
#      l'import Secutix).
#   5. Import Secutix : une valeur ESPACE sans espace correspondant
#      AUTO-CRÉE un espace de couleur BLANC (blanc = auto-créé, non mappé).
#   6. Vue quotidienne : le FOND du bloc de créneau est la couleur de
#      l'ESPACE (signal principal) ; une pastille de la couleur de l'OFFRE
#      accompagne le label court dans le bloc. La couleur de l'offre n'est
#      plus le fond du bloc.
#   7. Plan Accueil : la couleur de l'espace est sur le FOND du bandeau de
#      l'offre ; la colonne des médiateurs est inchangée.
#   8. Formulaire d'offre : l'espace de l'offre devient un SÉLECTEUR depuis
#      la liste des espaces (plus de texte libre) ; slot.location reste un
#      surcharge optionnelle par créneau, également un sélecteur depuis la
#      liste.

Fonctionnalité: Espaces — entité, liste et usage des couleurs d'espace
  En tant que coordinateur
  Je veux gérer une liste d'espaces nommés et colorés
  Afin de repérer d'un coup d'œil, par la couleur, où se déroule chaque créneau dans la vue quotidienne et le plan accueil

  Contexte:
    Soit la vue « Configuration » ouverte sur la section « Espaces »
    Et la liste des espaces vide

  # ------------------------------------------------------------------
  # Entité et gestion de la liste
  # ------------------------------------------------------------------

  Scénario: Ajouter un espace avec nom et couleur
    Quand le coordinateur ajoute l'espace « Salle Bronze » avec la couleur #4A90D9
    Alors la liste des espaces contient exactement 1 espace
    Et l'espace « Salle Bronze » a pour couleur #4A90D9
    Et l'espace « Salle Bronze » a un identifiant unique

  Scénario: Nom d'espace vide rejeté
    Quand le coordinateur ajoute un espace avec un nom vide
    Alors l'ajout est refusé avec le message « Le nom de l'espace est obligatoire »
    Et la liste des espaces reste vide

  Scénario: Nom d'espace en doublon rejeté
    Etant donné l'espace « Salle Bronze » avec la couleur #4A90D9
    Quand le coordinateur ajoute un espace nommé « Salle Bronze »
    Alors l'ajout est refusé avec le message « Un espace porte déjà ce nom »
    Et la liste des espaces contient toujours exactement 1 espace

  Scénario: Renommer un espace
    Etant donné l'espace « Salle Bronze » avec la couleur #4A90D9
    Quand le coordinateur renomme « Salle Bronze » en « Salle Antiquités »
    Alors la liste des espaces contient l'espace « Salle Antiquités »
    Et la liste ne contient plus l'espace « Salle Bronze »
    Et l'espace « Salle Antiquités » garde la couleur #4A90D9
    Et les offres et créneaux référençant cet espace suivent le renommage

  Scénario: Renommer un espace vers un nom déjà existant rejeté
    Etant donné l'espace « Salle Bronze » avec la couleur #4A90D9
    Et l'espace « Auditorium » avec la couleur #7B1FA2
    Quand le coordinateur renomme « Salle Bronze » en « Auditorium »
    Alors le renommage est refusé avec le message « Un espace porte déjà ce nom »
    Et l'espace « Salle Bronze » reste nommé « Salle Bronze »

  Scénario: Changer la couleur d'un espace avec un sélecteur hexadécimal
    Etant donné l'espace « Salle Bronze » avec la couleur #4A90D9
    Quand le coordinateur choisit la couleur #E65100 pour « Salle Bronze »
    Alors l'espace « Salle Bronze » a pour couleur #E65100
    Et la couleur est stockée au format hexadécimal

  Scénario: Supprimer un espace non référencé
    Etant donné l'espace « Auditorium » avec la couleur #7B1FA2
    Et aucune offre ni créneau ne référence « Auditorium »
    Quand le coordinateur supprime l'espace « Auditorium »
    Alors la liste des espaces est vide

  Scénario: Supprimer un espace référencé par une offre — refus
    Etant donné l'espace « Salle Bronze » avec la couleur #4A90D9
    Et l'offre « Visite guidée » associée à l'espace « Salle Bronze »
    Quand le coordinateur supprime l'espace « Salle Bronze »
    Alors la suppression est refusée avec le message « Cet espace est utilisé par une offre ou un créneau »
    Et la liste des espaces contient toujours l'espace « Salle Bronze »

  Scénario: Supprimer un espace référencé par un créneau — refus
    Etant donné l'espace « Salle Bronze » avec la couleur #4A90D9
    Et un créneau de l'offre « Visite guidée » sur l'espace « Salle Bronze »
    Quand le coordinateur supprime l'espace « Salle Bronze »
    Alors la suppression est refusée avec le message « Cet espace est utilisé par une offre ou un créneau »
    Et la liste des espaces contient toujours l'espace « Salle Bronze »

  # ------------------------------------------------------------------
  # Migration automatique des emplacements libres existants
  # ------------------------------------------------------------------

  Scénario: Migration automatique au premier chargement
    Etant donné des données existantes avec l'offre « Visite guidée » d'emplacement « Salle Bronze »
    Et un créneau d'emplacement « Auditorium »
    Et un créneau sans emplacement
    Quand l'application est chargée pour la première fois avec ces données
    Alors la liste des espaces contient exactement 2 espaces : « Salle Bronze » et « Auditorium »
    Et chaque valeur distincte non vide d'emplacement a donné naissance à un espace du même nom
    Et l'offre « Visite guidée » est associée à l'espace « Salle Bronze »
    Et le créneau d'emplacement « Auditorium » référence l'espace « Auditorium »
    Et le créneau sans emplacement reste sans espace

  Scénario: Migration sans doublon pour une même valeur d'emplacement
    Etant donné des données existantes avec 3 offres d'emplacement « Salle Bronze »
    Quand l'application est chargée pour la première fois avec ces données
    Alors la liste des espaces contient exactement 1 espace nommé « Salle Bronze »
    Et les 3 offres sont associées à cet espace

  Scénario: Couleurs de migration issues d'une palette par défaut, jamais blanches
    Etant donné des données existantes avec les emplacements « Salle Bronze » et « Auditorium »
    Quand l'application est chargée pour la première fois avec ces données
    Alors la couleur de « Salle Bronze » est issue de la palette par défaut
    Et la couleur de « Auditorium » est la couleur suivante du cycle de la palette
    Et aucune couleur migrée n'est blanche

  Scénario: Données anciennes sans aucun emplacement — liste vide
    Etant donné des données existantes sans valeur d'emplacement sur les offres ni sur les créneaux
    Quand l'application est chargée pour la première fois avec ces données
    Alors la liste des espaces est vide
    Et l'application fonctionne normalement

  # ------------------------------------------------------------------
  # Import Secutix — création automatique d'espaces blancs
  # ------------------------------------------------------------------

  Scénario: Valeur ESPACE inconnue auto-créée en blanc lors de l'import Secutix
    Etant donné la liste des espaces vide
    Quand le coordinateur importe un fichier Secutix contenant une ligne avec l'espace « Crypte »
    Alors l'espace « Crypte » est automatiquement créé
    Et l'espace « Crypte » a pour couleur le blanc
    Et le créneau importé référence l'espace « Crypte »

  Scénario: Valeur ESPACE déjà connue réutilisée sans création
    Etant donné l'espace « Salle Bronze » avec la couleur #4A90D9
    Quand le coordinateur importe un fichier Secutix contenant une ligne avec l'espace « Salle Bronze »
    Alors aucun nouvel espace n'est créé
    Et la liste des espaces contient toujours exactement 1 espace
    Et le créneau importé référence l'espace « Salle Bronze »
    Et l'espace « Salle Bronze » garde sa couleur #4A90D9

  # ------------------------------------------------------------------
  # Vue quotidienne — couleur d'espace en fond, pastille d'offre
  # ------------------------------------------------------------------

  Scénario: Fond du bloc de créneau = couleur de l'espace
    Etant donné l'espace « Salle Bronze » avec la couleur #4A90D9
    Et l'offre « Visite guidée » de couleur #E65100 associée à l'espace « Salle Bronze »
    Et un créneau de « Visite guidée » pour Alice le mardi de 10:00 à 12:00
    Et la vue quotidienne affichant ce mardi
    Alors le fond du bloc du créneau est la couleur #4A90D9 de l'espace « Salle Bronze »
    Et le fond du bloc n'est PAS la couleur #E65100 de l'offre

  Scénario: Pastille de la couleur de l'offre à côté du label court dans le bloc
    Etant donné l'espace « Salle Bronze » avec la couleur #4A90D9
    Et l'offre « Visite guidée » de couleur #E65100 et de label court « VG »
    Et un créneau de « Visite guidée » pour Alice le mardi de 10:00 à 12:00
    Et la vue quotidienne affichant ce mardi
    Alors le bloc du créneau affiche une pastille de couleur #E65100
    Et la pastille est suivie du label court « VG » à l'intérieur du bloc

  Scénario: Créneau avec surcharge d'espace — l'espace du créneau prime
    Etant donné l'espace « Salle Bronze » avec la couleur #4A90D9
    Et l'espace « Auditorium » avec la couleur #7B1FA2
    Et l'offre « Visite guidée » associée à l'espace « Salle Bronze »
    Et un créneau de « Visite guidée » avec l'espace « Auditorium » pour Alice le mardi de 10:00 à 12:00
    Et la vue quotidienne affichant ce mardi
    Alors le fond du bloc du créneau est la couleur #7B1FA2 de l'espace « Auditorium »
    Et le fond du bloc n'est pas la couleur #4A90D9 de l'espace de l'offre

  Scénario: Bloc blanc auto-créé reste lisible
    Etant donné l'espace « Crypte » de couleur blanche auto-créé par l'import Secutix
    Et l'offre « Visite guidée » de couleur #E65100 associée à l'espace « Crypte »
    Et un créneau de « Visite guidée » pour Alice le mardi de 10:00 à 12:00
    Et la vue quotidienne affichant ce mardi
    Alors le fond du bloc est blanc
    Et le bloc a un contour et un texte suffisamment contrastés pour rester lisible sur fond blanc
    Et la pastille #E65100 et le label court restent lisibles

  # ------------------------------------------------------------------
  # Plan Accueil — bandeau d'offre coloré par l'espace
  # ------------------------------------------------------------------

  Scénario: Fond du bandeau d'offre = couleur de l'espace dans le plan accueil
    Etant donné l'espace « Salle Bronze » avec la couleur #4A90D9
    Et l'offre « Visite guidée » de couleur #E65100 associée à l'espace « Salle Bronze »
    Et la vue « Plan Accueil » ouverte
    Alors le bandeau de l'offre « Visite guidée » a pour fond la couleur #4A90D9 de l'espace
    Et la colonne des médiateurs est inchangée par la couleur d'espace

  # ------------------------------------------------------------------
  # Formulaire d'offre — sélecteur d'espace
  # ------------------------------------------------------------------

  Scénario: L'espace de l'offre est choisi depuis un sélecteur
    Etant donné l'espace « Salle Bronze » avec la couleur #4A90D9
    Et l'espace « Auditorium » avec la couleur #7B1FA2
    Quand le coordinateur ouvre la modale de l'offre « Visite guidée »
    Alors le champ espace est un sélecteur listant « Salle Bronze » et « Auditorium »
    Et le champ espace n'accepte pas de saisie libre hors liste
    Quand le coordinateur choisit « Auditorium » et enregistre
    Alors l'offre « Visite guidée » est associée à l'espace « Auditorium »

  Scénario: Surcharge d'espace d'un créneau — sélecteur optionnel
    Etant donné l'espace « Salle Bronze » avec la couleur #4A90D9
    Et l'espace « Auditorium » avec la couleur #7B1FA2
    Et l'offre « Visite guidée » associée à l'espace « Salle Bronze »
    Quand le coordinateur ouvre l'édition du créneau et choisit « Auditorium » dans le champ espace
    Alors le créneau référence l'espace « Auditorium » en surcharge
    Et si le coordinateur laisse le champ espace vide, le créneau suit l'espace de son offre
