# language: fr
# Capability: Import/Export manuels depuis l'en-tête — mode locataire M365
# sans enregistrements d'application (fichiers JSON.gz partagés à la main).
# Ajoute deux boutons d'action dans l'en-tête, à côté de « ⇩ Import
# Secutix », avec suivi des modifications non exportées.
# Références: src/presentation/Header.tsx (emplacement des boutons) ;
#             src/infrastructure/store.ts (exportJSON/importJSON,
#             getLastModified — tampon ISO 8601) ;
#             src/domain/export-utils.ts (generateExportFilename →
#             mediaplan_AAAA-MM-JJ_HHMM.json.gz ; buildExportMetadata →
#             { lastModified, exportedAt, version } embarquées dans le
#             fichier) ;
#             test/features/spaces/spaces.feature (format des specs).
# Décisions design arrêtées le 2026-10-03 :
#   1. DEUX BOUTONS dans l'en-tête, à droite de « ⇩ Import Secutix » :
#      « ⇧ Export » (clic unique : télécharge immédiatement le JSON.gz
#      horodaté, SANS dialogue) et « ⇩ Import » (ouvre directement le
#      sélecteur de fichiers). Choix des libellés : flèches ⇧/⇩ cohérentes
#      avec le bouton Secutix existant, mots pleins « Export »/« Import »
#      distincts de « Import Secutix » (le qualificatif Secutix reste
#      réservé au flux métier Secutix).
#   2. EXPORT-HIGHLIGHT : tampon persisté « lastExportedAt » (clé
#      localStorage dédiée — l'implémentation choisit le stockage exact).
#      Signal = PASTILLE AMBRE sur le bouton « ⇧ Export » + attribut
#      title « Modifications non exportées », visible SI ET SEULEMENT SI
#      data.lastModified > lastExportedAt (règle unique, quelle que soit
#      la source de lastModified — édition, import Secutix, annulation,
#      rétablissement). AUCUN changement de couleur du bouton.
#   3. BASELINE D'IMPORT : un import réussi EST le nouvel état de
#      référence — lastExportedAt est mis à jour au lastModified embarqué
#      du fichier importé (donc badge effacé), et un tampon séparé
#      lastImportedAt est posé à l'instant de l'import.
#   4. Import en tête : SÉLECTEUR DE FICHIERS direct (JSON.gz ou .json),
#      puis DEUX confirmations séquentielles NON BLOQUANTES :
#      a) « ⚠ Vos données seront remplacées — vous pourrez annuler avec ↶ »
#         (informatif : l'annulation existe via l'historique ↶) ;
#      b) SI le lastModified embarqué du fichier est PLUS ANCIEN que le
#         lastModified local : « ⚠ Ce fichier est plus ancien que vos
#         données actuelles (X vs Y) » avec dates au format français,
#         confirmation pour poursuivre quand même.
#      Un fichier SANS métadonnées lastModified (héritage) passe SANS
#      l'avertissement b (rien à comparer), mais garde la confirmation a.
#   5. Échec d'export : alerte, données inchangées, badge conservé.
#   6. La section « Données » de la vue Configuration garde son
#      import/export existant, mais met à jour les MÊMES tampons
#      lastExportedAt / lastImportedAt : le badge d'en-tête reste
#      cohérent entre les deux points d'entrée.

Fonctionnalité: Import et export manuels depuis l'en-tête avec suivi des modifications
  En tant que coordinateur
  Je veux exporter et importer mes données depuis l'en-tête, avec un signal des modifications non encore exportées
  Afin d'échanger des fichiers JSON.gz avec l'équipe sans infrastructure de synchronisation, sans jamais perdre de vue ce qui n'a pas été partagé

  Contexte:
    Soit l'application MediaPlan ouverte avec l'en-tête visible
    Et le bouton « ⇩ Import Secutix » affiché dans les actions de l'en-tête
    Et le tampon persisté lastExportedAt
    Et le tampon de dernière modification des données lastModified

  # ------------------------------------------------------------------
  # Boutons de l'en-tête
  # ------------------------------------------------------------------

  Scénario: Les deux boutons d'import/export sont affichés à côté de l'import Secutix
    Alors l'en-tête affiche le bouton « ⇧ Export » juste à droite du bouton « ⇩ Import Secutix »
    Et l'en-tête affiche le bouton « ⇩ Import » à côté du bouton « ⇧ Export »
    Et aucun de ces boutons n'ouvre de dialogue avant l'action

  Scénario: Export en un clic — téléchargement immédiat sans dialogue
    Etant donné des données contenant l'offre « Visite guidée »
    Quand le coordinateur clique sur « ⇧ Export »
    Alors un fichier mediaplan_AAAA-MM-JJ_HHMM.json.gz est téléchargé immédiatement
    Et aucun dialogue de confirmation n'est affiché
    Et le fichier contient les métadonnées lastModified, exportedAt et version
    Et le fichier contient les données actuelles

  Scénario: Import depuis l'en-tête — sélecteur de fichiers direct
    Quand le coordinateur clique sur « ⇩ Import »
    Alors le sélecteur de fichiers s'ouvre directement
    Et le sélecteur accepte les fichiers .json.gz et .json

  # ------------------------------------------------------------------
  # Pastille « modifications non exportées »
  # ------------------------------------------------------------------

  Scénario: Aucune pastille quand les données sont à jour du dernier export
    Etant donné un export réussi à 14:00:00 posant lastExportedAt à 2026-10-03T14:00:00Z
    Et lastModified à 2026-10-03T13:55:00Z
    Alors le bouton « ⇧ Export » n'affiche pas de pastille
    Et le bouton « ⇧ Export » n'a pas l'attribut title « Modifications non exportées »

  Scénario: Pastille ambre après une modification postérieure à l'export
    Etant donné un export réussi posant lastExportedAt à 2026-10-03T14:00:00Z
    Et lastModified à 2026-10-03T13:55:00Z
    Quand le coordinateur modifie un créneau à 14:30:00
    Alors le bouton « ⇧ Export » affiche une pastille ambre
    Et le bouton « ⇧ Export » a l'attribut title « Modifications non exportées »
    Et la couleur du bouton « ⇧ Export » est inchangée

  Scénario: Pastille visible dès la première utilisation sans export préalable
    Etant donné l'application n'ayant jamais été exportée
    Quand le coordinateur crée un créneau
    Alors le bouton « ⇧ Export » affiche la pastille ambre
    Et le bouton « ⇧ Export » a l'attribut title « Modifications non exportées »

  Scénario: L'export efface la pastille jusqu'à la prochaine modification
    Etant donné la pastille ambre affichée sur « ⇧ Export »
    Quand le coordinateur clique sur « ⇧ Export » et le téléchargement aboutit
    Alors la pastille disparaît
    Et lastExportedAt vaut l'instant de cet export
    Quand le coordinateur modifie ensuite une offre
    Alors la pastille ambre réapparaît

  Scénario: Export sans modification depuis le dernier export — autorisé, sans pastille
    Etant donné un export réussi posant lastExportedAt à 2026-10-03T14:00:00Z
    Et lastModified à 2026-10-03T13:55:00Z
    Quand le coordinateur clique à nouveau sur « ⇧ Export »
    Alors le téléchargement a lieu normalement
    Et la pastille n'apparaît pas
    Et lastExportedAt est mis à jour à l'instant de ce second export

  Scénario: Échec d'export — alerte et pastille conservée
    Etant donné la pastille ambre affichée sur « ⇧ Export »
    Et le téléchargement qui échoue
    Quand le coordinateur clique sur « ⇧ Export »
    Alors une alerte signale l'échec de l'export
    Et la pastille ambre reste affichée
    Et lastExportedAt est inchangé
    Et les données sont inchangées

  Scénario: L'annulation ↶ ne fait pas réapparaître la pastille si l'état restauré est antérieur à l'export
    Etant donné un export réussi posant lastExportedAt à 2026-10-03T14:00:00Z
    Et lastModified à 2026-10-03T13:55:00Z
    Quand le coordinateur modifie un créneau à 14:30:00
    Et la pastille ambre s'affiche
    Et le coordinateur annule avec ↶
    Alors lastModified est restauré à 2026-10-03T13:55:00Z
    Et la pastille ambre disparaît car lastModified ≤ lastExportedAt
    Et le rétablissement ↷ suit la même règle : la pastille revient seulement si l'état rétabli a un lastModified postérieur à lastExportedAt

  # ------------------------------------------------------------------
  # Import depuis l'en-tête — confirmations séquentielles
  # ------------------------------------------------------------------

  Scénario: Confirmation informative de remplacement avant l'import
    Etant donné le sélecteur de fichiers ouvert avec un fichier d'export valide
    Quand le coordinateur choisit le fichier
    Alors une confirmation non bloquante affiche « ⚠ Vos données seront remplacées — vous pourrez annuler avec ↶ »
    Et le message mentionne explicitement la possibilité d'annuler avec ↶

  Scénario: Annulation de la confirmation de remplacement — rien ne change
    Etant donné le message « ⚠ Vos données seront remplacées — vous pourrez annuler avec ↶ » affiché
    Quand le coordinateur annule la confirmation
    Alors aucune donnée n'est remplacée
    Et la pastille du bouton « ⇧ Export » garde son état d'avant l'opération

  Scénario: Avertissement de fichier plus ancien — dates affichées en français
    Etant donné lastModified local à 2026-10-03T15:45:00Z
    Et le fichier choisi avec un lastModified embarqué à 2026-10-02T10:00:00Z
    Et la confirmation de remplacement acceptée
    Alors une seconde confirmation non bloquante affiche « ⚠ Ce fichier est plus ancien que vos données actuelles »
    Et les deux dates sont affichées au format français, celle du fichier puis celle des données actuelles
    Quand le coordinateur confirme pour poursuivre quand même
    Alors l'import se poursuit avec les données du fichier

  Scénario: Refus de l'avertissement de fichier plus ancien — rien ne change
    Etant donné lastModified local à 2026-10-03T15:45:00Z
    Et le fichier choisi avec un lastModified embarqué à 2026-10-02T10:00:00Z
    Et l'avertissement de fichier plus ancien affiché
    Quand le coordinateur refuse de poursuivre
    Alors les données locales sont inchangées
    Et lastModified local reste 2026-10-03T15:45:00Z

  Scénario: Fichier de même horodatage — pas d'avertissement d'ancienneté
    Etant donné lastModified local à 2026-10-03T15:45:00Z
    Et le fichier choisi avec un lastModified embarqué à 2026-10-03T15:45:00Z
    Et la confirmation de remplacement acceptée
    Alors l'avertissement de fichier plus ancien N'EST PAS affiché
    Et l'import se poursuit directement

  Scénario: Fichier plus récent — pas d'avertissement, remplacement direct
    Etant donné lastModified local à 2026-10-02T10:00:00Z
    Et le fichier choisi avec un lastModified embarqué à 2026-10-03T15:45:00Z
    Et la confirmation de remplacement acceptée
    Alors l'avertissement de fichier plus ancien n'est pas affiché
    Et l'import remplace les données locales par celles du fichier

  Scénario: Fichier hérité sans métadonnées lastModified — pas d'avertissement d'ancienneté
    Etant donné lastModified local à 2026-10-03T15:45:00Z
    Et le fichier choisi sans métadonnée lastModified embarquée
    Et la confirmation de remplacement acceptée
    Alors l'avertissement de fichier plus ancien n'est pas affiché, rien n'étant comparable
    Et l'import se poursuit directement

  # ------------------------------------------------------------------
  # Succès de l'import — nouvel état de référence
  # ------------------------------------------------------------------

  Scénario: Import réussi — données remplacées, annulables, pastille effacée
    Etant donné la pastille ambre affichée sur « ⇧ Export »
    Et le fichier choisi avec un lastModified embarqué à 2026-10-03T12:00:00Z
    Et les deux confirmations acceptées
    Quand l'import aboutit
    Alors les données locales sont remplacées par celles du fichier
    Et l'opération est annulable avec ↶
    Et la pastille ambre disparaît du bouton « ⇧ Export »
    Et lastExportedAt vaut 2026-10-03T12:00:00Z, le lastModified embarqué du fichier importé
    Et le tampon lastImportedAt est posé à l'instant de l'import

  Scénario: Annulation de l'import avec ↶ restaure les données d'avant
    Etant donné les données contenant l'offre « Visite guidée »
    Et un import réussi remplaçant les données par celles du fichier
    Quand le coordinateur annule avec ↶
    Alors les données d'avant l'import sont restaurées
    Et l'offre « Visite guidée » est de nouveau présente

  Scénario: Fichier corrompu — alerte d'erreur et rien ne change
    Etant donné le sélecteur de fichiers ouvert
    Quand le coordinateur choisit un fichier JSON.gz corrompu
    Et les confirmations nécessaires sont acceptées
    Alors une alerte signale l'échec de l'import
    Et les données locales sont inchangées
    Et lastExportedAt est inchangé
    Et l'opération ne figure pas dans l'historique annulable ↶

  # ------------------------------------------------------------------
  # Cohérence avec les autres flux de modification
  # ------------------------------------------------------------------

  Scénario: L'import Secutix déclenche la pastille via le même lastModified
    Etant donné un export réussi posant lastExportedAt
    Quand le coordinateur importe un fichier Secutix modifiant les données
    Alors lastModified est postérieur à lastExportedAt
    Et la pastille ambre s'affiche sur le bouton « ⇧ Export »

  Scénario: La section « Données » de la vue Configuration partage les mêmes tampons
    Etant donné la pastille ambre affichée sur « ⇧ Export »
    Quand le coordinateur exporte depuis la section « Données » de la vue Configuration
    Alors la pastille ambre disparaît du bouton « ⇧ Export »
    Et lastExportedAt est mis à jour à l'instant de cet export
    Quand le coordinateur importe un fichier depuis la section « Données » de la vue Configuration
    Alors lastImportedAt est mis à jour
    Et lastExportedAt suit le lastModified du fichier importé
    Et l'état de la pastille du bouton « ⇧ Export » reste cohérent avec ces tampons
