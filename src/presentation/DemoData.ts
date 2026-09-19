// DemoData.ts — seedDemoData, ported from js/app.js seedDemoData()

import type { AppData } from '../domain/types';
import { createMediator, createOffer, createSlot, createAbsence } from '../domain/models';

export function seedDemoData(data: AppData): void {
  // --- 20 mediators with creative French names ---
  const mediatorDefs = [
    { lastName: 'Tempête', firstName: 'Océane', email: 'oceane.tempete@museum.fr', phone: '06 12 34 56 78', color: '#1abc9c', notes: 'Spécialiste paléontologie' },
    { lastName: 'Fortin', firstName: 'Maxime', email: 'maxime.fortin@museum.fr', phone: '06 23 45 67 89', color: '#e67e22', notes: '' },
    { lastName: 'Vermillon', firstName: 'Léonie', email: 'leonie.vermillon@museum.fr', phone: '06 34 56 78 90', color: '#e74c3c', notes: 'Historienne de l\u2019art' },
    { lastName: 'Lavandier', firstName: 'Côme', email: 'come.lavandier@museum.fr', color: '#9b59b6', notes: '' },
    { lastName: 'Ménétrier', firstName: 'Aubin', email: 'aubin.menétrier@museum.fr', phone: '07 11 22 33 44', color: '#3498db', notes: 'Musicien, anime les conférences-spectacles' },
    { lastName: 'Roselière', firstName: 'Hortense', email: 'hortense.roselière@museum.fr', color: '#2ecc71', notes: 'Botaniste' },
    { lastName: 'Marchenoir', firstName: 'Gaspard', email: 'gaspard.marchenoir@museum.fr', phone: '06 78 90 12 34', color: '#34495e', notes: '' },
    { lastName: 'Clair de Lune', firstName: 'Aurore', email: 'aurore.clairdelune@museum.fr', color: '#f39c12', notes: 'Spécialiste des visites nocturnes' },
    { lastName: 'Brisemarbre', firstName: 'Timothée', email: 'timothée.brisemarbre@museum.fr', phone: '07 22 33 44 55', color: '#16a085', notes: '' },
    { lastName: 'ÉtoiledeMer', firstName: 'Pénelope', email: 'penelope.etoiledemer@museum.fr', color: '#d35400', notes: 'Spécialiste zoologie marine' },
    { lastName: 'Orage', firstName: 'Théodore', email: 'theodore.orage@museum.fr', phone: '06 56 78 90 12', color: '#27ae60', notes: '' },
    { lastName: 'Plumedor', firstName: 'Yseult', email: 'yseult.plumedor@museum.fr', color: '#c0392b', notes: 'Spécialiste oiseaux et taxidermie' },
    { lastName: 'Rochembrune', firstName: 'Médéric', email: 'mederic.rochembrune@museum.fr', color: '#8e44ad', notes: '' },
    { lastName: 'Fontainebleue', firstName: 'Blanche', email: 'blanche.fontainebleue@museum.fr', phone: '06 89 01 23 45', color: '#2980b9', notes: '' },
    { lastName: 'PapillondArgent', firstName: 'Éléonore', email: 'eleonore.papillondargent@museum.fr', color: '#a0522d', notes: 'Spécialiste insectes' },
    { lastName: 'Sablevague', firstName: 'Hippolyte', email: 'hippolyte.sablevague@museum.fr', phone: '07 33 44 55 66', color: '#2c6e49', notes: '' },
    { lastName: 'BrumedAutomne', firstName: 'Solène', email: 'solene.brumedautomne@museum.fr', color: '#1f618d', notes: '' },
    { lastName: 'LoupdOrage', firstName: 'Lancelot', email: 'lancelot.loupdorage@museum.fr', phone: '06 44 55 66 77', color: '#7d3c98', notes: '' },
    { lastName: 'Vignesvertes', firstName: 'Margaux', email: 'margaux.vignesvertes@museum.fr', color: '#117a65', notes: 'Spécialiste jardin botanique' },
    { lastName: 'CuivredOr', firstName: 'Faustine', email: 'faustine.cuivredor@museum.fr', phone: '07 55 66 77 88', color: '#b9770e', notes: '' },
  ];
  const mediators = mediatorDefs.map((d) => createMediator(d));

  // --- 70 offers ---
  const offerDefs = [
    { name: 'Visite guidée Dinosauria', description: 'Découverte de la galerie des dinosaures', duration: 90, capacity: 25, location: 'Galerie Dinosauria' },
    { name: 'Visite guidée : Trésors de l\u2019Égypte antique', description: 'Parcours dans les collections égyptiennes', duration: 90, capacity: 30, location: 'Salle Égypte' },
    { name: 'Visite guidée : La Préhistoire pas à pas', description: 'De la pierre taillée à l\u2019art pariétal', duration: 80, capacity: 20, location: 'Galerie Préhistoire' },
    { name: 'Visite guidée : Animaux disparus', description: 'Tous les animaux éteints du musée', duration: 70, capacity: 25, location: 'Galerie de zoologie' },
    { name: 'Visite guidée : Minéraux du monde', description: 'Collection de minéraux et gemmes', duration: 60, capacity: 20, location: 'Salle Minéralogie' },
    { name: 'Visite guidée : Au temps des mammouths', description: 'Faune glaciaire et grands mammifères', duration: 80, capacity: 25, location: 'Galerie Glaciaire' },
    { name: 'Visite guidée : Les civilisations disparues', description: 'Mayas, Assyriens, Étrusques', duration: 90, capacity: 30, location: 'Salle Archéologie' },
    { name: 'Visite guidée : Oiseaux du monde', description: 'Plus de 400 espèces naturalisées', duration: 70, capacity: 20, location: 'Galerie d\u2019ornithologie' },
    { name: 'Visite guidée : Bêtes noires et créatures mythiques', description: 'Quand la science rencontre la légende', duration: 60, capacity: 25, location: 'Galerie Temporaire' },
    { name: 'Visite guidée : L\u2019homme et la mer', description: 'Histoire de la navigation et de la pêche', duration: 75, capacity: 30, location: 'Galerie Maritime' },
    { name: 'Visite guidée : Histoire de la Terre', description: 'Formation des continents et tectonique', duration: 60, capacity: 20, location: 'Salle Géologie' },
    { name: 'Visite guidée : La nuit des étoiles', description: 'Astronomie et observation', duration: 90, capacity: 20, location: 'Planétarium' },
    { name: 'Visite guidée : Plantes médicinales d\u2019hier et d\u2019aujourd\u2019hui', description: 'Remèdes traditionnels et pharmacopée', duration: 60, capacity: 20, location: 'Jardin botanique' },
    { name: 'Visite guidée : Les fonds marins', description: 'Biodiversité océanique', duration: 70, capacity: 25, location: 'Galerie Aquatique' },
    { name: 'Visite guidée : Au cœur du volcan', description: 'Tout savoir sur les volcans', duration: 60, capacity: 20, location: 'Salle Vulcanologie' },
    { name: 'Visite nocturne : Le musée s\u2019anime', description: 'Visite exceptionnelle en soirée à la lampe de poche', duration: 90, capacity: 20, location: 'Musée entier', setupTime: 30, teardownTime: 15 },
    { name: 'Visite nocturne : Contes et légendes au musée', description: 'Récits autour des collections', duration: 80, capacity: 30, location: 'Galerie principale', setupTime: 20 },
    { name: 'Visite nocturne : Dîner-spectacle', description: 'Repas au musée suivi d\u2019une visite', duration: 180, capacity: 40, location: 'Hall d\u2019accueil', setupTime: 60, teardownTime: 45 },
    { name: 'Visite nocturne : Chasse au trésor nocturne', description: 'Jeu de piste nocturne en équipe', duration: 120, capacity: 25, location: 'Musée entier', setupTime: 30, teardownTime: 15 },
    { name: 'Visite nocturne : Scènes nocturnes du passé', description: 'Mises en scène sonores et visuelles', duration: 90, capacity: 30, location: 'Galerie principale', setupTime: 45, teardownTime: 30 },
    { name: 'Atelier paléontologie', description: 'Atelier pratique pour enfants : fouilles et moulages', duration: 120, capacity: 15, location: 'Salle pédagogique', setupTime: 30, teardownTime: 20 },
    { name: 'Atelier : Devenez un chevalier', description: 'Pour les enfants de 6 à 10 ans', duration: 90, capacity: 12, location: 'Salle pédagogique', setupTime: 20, teardownTime: 15 },
    { name: 'Atelier : Céramique néolithique', description: 'Fabriquer et décorer un pot en argile', duration: 120, capacity: 15, location: 'Salle pédagogique', setupTime: 25, teardownTime: 30 },
    { name: 'Atelier : Calligraphie égyptienne', description: 'Apprendre les hiéroglyphes', duration: 90, capacity: 12, location: 'Salle pédagogique', setupTime: 15 },
    { name: 'Atelier : Dissection de la chouette', description: 'Étude des pelotes de rejection', duration: 90, capacity: 15, location: 'Laboratoire éducatif', setupTime: 20, teardownTime: 20 },
    { name: 'Atelier : Le masque et la moue', description: 'Construire un masque de théâtre antique', duration: 100, capacity: 12, location: 'Salle pédagogique' },
    { name: 'Atelier : Couleur des pierres', description: 'Observer et dessiner les minéraux', duration: 90, capacity: 15, location: 'Salle Minéralogie', setupTime: 10 },
    { name: 'Atelier : Tisser l\u2019histoire', description: 'Tissage de fils à la manière gallo-romaine', duration: 110, capacity: 10, location: 'Salle pédagogique', setupTime: 30, teardownTime: 30 },
    { name: 'Atelier : Le volcan expérimental', description: 'Fabrication et éruption d\u2019un volcan en argile', duration: 90, capacity: 15, location: 'Laboratoire éducatif', setupTime: 30, teardownTime: 30 },
    { name: 'Atelier : Préparer sa valise de paléontologue', description: 'Atelier pour enfants de 8 à 12 ans', duration: 60, capacity: 15, location: 'Salle pédagogique', setupTime: 15 },
    { name: 'Atelier : Squelette en carton', description: 'Assemblage d\u2019un squelette humain en modèle réduit', duration: 80, capacity: 15, location: 'Salle pédagogique', setupTime: 15, teardownTime: 15 },
    { name: 'Atelier : Herboristerie médiévale', description: 'Reconnaître et préparer les plantes du Moyen Âge', duration: 90, capacity: 12, location: 'Jardin botanique', setupTime: 20, teardownTime: 15 },
    { name: 'Atelier : Moulage fossile', description: 'Apprendre à mouler un fossile', duration: 100, capacity: 12, location: 'Laboratoire éducatif', setupTime: 30, teardownTime: 30 },
    { name: 'Atelier : L\u2019art de la préhistoire', description: 'Peindre comme à Lascaux', duration: 90, capacity: 15, location: 'Salle pédagogique', setupTime: 20 },
    { name: 'Atelier : Énigmes au musée', description: 'Rallye-jeu pour enfants', duration: 90, capacity: 20, location: 'Musée entier', setupTime: 10 },
    { name: 'Atelier : Voyage au centre de la cellule', description: 'Observer au microscope', duration: 90, capacity: 12, location: 'Laboratoire éducatif', setupTime: 25, teardownTime: 15 },
    { name: 'Conférence : Les dinosaures de l\u2019extrême', description: 'Deuxième partie : les prédateurs', duration: 60, capacity: 80, location: 'Auditorium', setupTime: 20, teardownTime: 10 },
    { name: 'Conférence : Les plantes qui guérissent', description: 'Histoire de la pharmacopée', duration: 60, capacity: 60, location: 'Auditorium', setupTime: 15 },
    { name: 'Conférence : L\u2019art pariétal', description: 'Lascaux, Chauvet, Altamira', duration: 70, capacity: 80, location: 'Auditorium' },
    { name: 'Conférence : L\u2019évolution en questions', description: 'Darwin et ses héritiers', duration: 60, capacity: 60, location: 'Auditorium', setupTime: 15, teardownTime: 10 },
    { name: 'Conférence : Volcans, séismes et tsunamis', description: 'Comprendre la Terre vivante', duration: 70, capacity: 80, location: 'Auditorium' },
    { name: 'Conférence : Les grands voyageurs du XVIIIe siècle', description: 'Explorations et collections', duration: 60, capacity: 60, location: 'Auditorium', setupTime: 15 },
    { name: 'Conférence : Le return des grands prédateurs', description: 'Loup, ours, lynx en France', duration: 60, capacity: 60, location: 'Auditorium' },
    { name: 'Conférence-spectacle : Le rire du mammouth', description: 'One-man-show paléontologique', duration: 80, capacity: 100, location: 'Auditorium', setupTime: 30, teardownTime: 20 },
    { name: 'Conférence-spectacle : La nuit des pôles', description: 'Récit immersif au-delà du cercle polaire', duration: 90, capacity: 80, location: 'Auditorium', setupTime: 45, teardownTime: 30 },
    { name: 'Conférence-spectacle : Aux origines de l\u2019art', description: 'Entre science et poésie', duration: 70, capacity: 100, location: 'Auditorium', setupTime: 30, teardownTime: 15 },
    { name: 'Conférence-spectacle : La Grande Épopée de la Forêt', description: 'Drama naturaliste de la forêt primaire', duration: 90, capacity: 100, location: 'Auditorium', setupTime: 30, teardownTime: 20 },
    { name: 'Spectacle : Le Concile des oiseaux', description: 'Spectacle vivant sur l\u2019ornithologie', duration: 60, capacity: 80, location: 'Auditorium', setupTime: 40, teardownTime: 30 },
    { name: 'Spectacle : Le Maître du feu', description: 'Démonstration interactive sur les volcans', duration: 50, capacity: 60, location: 'Galerie Vulcanologie', setupTime: 30, teardownTime: 20 },
    { name: 'Concert : Musiques préhistoriques', description: 'Concert d\u2019instruments reconstitués', duration: 70, capacity: 80, location: 'Auditorium', setupTime: 45, teardownTime: 30 },
    { name: 'Concert : Chants d\u2019oiseaux du monde', description: 'Récital ornithologique', duration: 60, capacity: 60, location: 'Auditorium', setupTime: 30, teardownTime: 20 },
    { name: 'Spectacle jeune public : La petite fouine', description: 'Aventure sensorielle pour 3-6 ans', duration: 40, capacity: 20, location: 'Salle jeune public', setupTime: 30, teardownTime: 20 },
    { name: 'Spectacle : La rivière des castors', description: 'Conte musical naturaliste', duration: 50, capacity: 50, location: 'Auditorium', setupTime: 30, teardownTime: 20 },
    { name: 'Récit musical : Le voyage de la baleine', description: 'Récit immersif sur les cétacés', duration: 60, capacity: 80, location: 'Auditorium', setupTime: 40, teardownTime: 20 },
    { name: 'Projection-débat : Microcosmos', description: 'Film suivi d\u2019un débat sur les insectes', duration: 100, capacity: 80, location: 'Auditorium', setupTime: 15, teardownTime: 10 },
    { name: 'Parcours : Animaux de nos régions', description: 'Visite guidée des collections locales', duration: 60, capacity: 20, location: 'Galerie Faune locale' },
    { name: 'Parcours : Les plantes et leurs secrets', description: 'Botanique dans le jardin', duration: 70, capacity: 15, location: 'Jardin botanique' },
    { name: 'Parcours : Femme scientifiques, pionnières', description: 'Parcours sur les femmes en sciences', duration: 75, capacity: 25, location: 'Musée entier' },
    { name: 'Parcours : Les couleurs de la nature', description: 'Couleurs minérales, végétales, animales', duration: 60, capacity: 20, location: 'Musée entier' },
    { name: 'Parcours sensoriel : À l\u2019aveugle', description: 'Visite à l\u2019aveugle guidée par le toucher et l\u2019odorat', duration: 60, capacity: 8, location: 'Galerie Tactile', setupTime: 20, teardownTime: 10 },
    { name: 'Parcours : De l\u2019atome à la galaxie', description: 'Parcours multi-échelles', duration: 90, capacity: 25, location: 'Musée entier' },
    { name: 'Parcours : Le temps des glaciers', description: 'Climat et glaciations', duration: 70, capacity: 20, location: 'Galerie Glaciaire' },
    { name: 'Visite tactile des collections', description: 'Expérience insolite : toucher les moulages et spécimens', duration: 60, capacity: 10, location: 'Galerie Tactile', setupTime: 20, teardownTime: 10 },
    { name: 'Visite en LSF : Trésors du musée', description: 'Visite guidée en langue des signes française', duration: 90, capacity: 15, location: 'Musée entier' },
    { name: 'Visite adaptée : Handicap mental', description: 'Parcours adapté et sensoriel', duration: 60, capacity: 10, location: 'Galerie Tactile', setupTime: 15, teardownTime: 15 },
    { name: 'Visite famille : Dino-aventure', description: 'Visite interactive pour les 5-10 ans', duration: 60, capacity: 20, location: 'Galerie Dinosauria' },
    { name: 'Visite groupe scolaire : Primaire', description: 'Parcours pédagogique adapté au primaire', duration: 90, capacity: 30, location: 'Musée entier' },
    { name: 'Visite groupe scolaire : Secondaire', description: 'Parcours pédagogique adapté au secondaire', duration: 90, capacity: 30, location: 'Musée entier' },
    { name: 'Bivouac préhistorique', description: 'Bivouac et ateliers de survie préhistorique dans le parc', duration: 300, capacity: 20, location: 'Parc du musée', setupTime: 120, teardownTime: 90 },
    { name: 'Atelier taxidermie (observation)', description: 'Démonstration et initiation à la taxidermie (spécimens naturalisés)', duration: 180, capacity: 10, location: 'Laboratoire de taxidermie', setupTime: 60, teardownTime: 45 },
  ];
  const offers = offerDefs.map((d) => createOffer(d));

  // --- Assign competences (skills) to mediators ---
  const skillAssignments = [
    [0, 20, 42, 62, 64],
    [0, 1, 16, 34, 56],
    [2, 3, 17, 43, 57],
    [4, 5, 21, 44, 63],
    [18, 41, 42, 43, 44],
    [12, 13, 30, 55],
    [6, 7, 45, 46],
    [16, 17, 18, 19, 48],
    [8, 9, 22, 23, 58],
    [13, 14, 26, 38, 65],
    [10, 14, 15, 39, 40],
    [7, 25, 47, 50, 51],
    [2, 3, 21, 24, 33],
    [1, 11, 56, 57],
    [8, 9, 23, 24, 36],
    [4, 15, 27, 31, 67],
    [5, 6, 34, 54, 61],
    [3, 7, 45, 46, 49],
    [12, 13, 30, 55, 58],
    [10, 14, 39, 41, 66],
  ];
  skillAssignments.forEach((skills, i) => {
    mediators[i].competences = skills.map((offIdx) => ({ offerId: offers[offIdx].id, status: 'confirmed' as const }));
  });

  // Reference date: start of previous month
  const now = new Date();
  const refDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const dayFromRef = (n: number) => {
    const d = new Date(refDate);
    d.setDate(d.getDate() + n);
    return fmt(d);
  };

  const totalDays = 90;
  const slots: typeof data.slots = [];
  const absences: typeof data.absences = [];

  const secutixImport = new Date(refDate).toISOString();
  const coordinationImport = new Date(refDate.getTime() + 7 * 86400000).toISOString();

  // Predefined slot patterns for weekdays (Mon=1..Fri=5)
  // Each entry: [offerIdx, mediatorIdx, start, end, status, participants, origin, source?, modifiedAfterImport?, unassigned?, extraMediatorIdx?]
  // Doubled patterns: most unassigned (imported reservations without mediator)
  const weekdayPatterns: (string | number | boolean | null)[][] = [
    // Monday — 14 patterns (most unassigned)
    [0, 0, '09:00', '10:30', 'confirmed', 22, 'imported', 'Secutix'],
    [20, 2, '10:00', '12:00', 'confirmed', 14, 'imported', 'Secutix'],
    [34, 4, '14:00', '15:00', 'confirmed', 60, 'imported', 'Secutix'],
    [56, 6, '11:00', '12:00', 'planned', 18, 'imported', 'Secutix'],
    [1, 8, '15:30', '17:00', 'planned', 12, 'imported', 'Secutix'],
    [16, null, '18:00', '19:30', 'planned', 0, 'imported', 'Secutix', null, false, true],
    [60, 0, '10:00', '12:00', 'planned', 10, 'manual'],
    // Monday unassigned extras
    [3, null, '09:30', '11:00', 'planned', 18, 'imported', 'Secutix', null, true],
    [21, null, '14:30', '16:00', 'planned', 22, 'imported', 'Secutix', null, true],
    [42, null, '10:00', '11:30', 'planned', 14, 'imported', 'Coordination', null, true],
    [7, null, '11:00', '12:10', 'planned', 25, 'imported', 'Secutix', null, true],
    [46, null, '16:00', '17:00', 'planned', 50, 'imported', 'Secutix', null, true],
    [13, null, '09:00', '10:00', 'planned', 20, 'imported', 'Secutix', null, true],
    [66, null, '14:00', '15:30', 'planned', 12, 'imported', 'Coordination', null, true],
    // Tuesday — 14 patterns
    [2, 1, '09:30', '11:00', 'confirmed', 18, 'imported', 'Secutix'],
    [22, 3, '10:00', '11:40', 'confirmed', 12, 'imported', 'Secutix'],
    [42, 4, '14:00', '15:20', 'confirmed', 80, 'imported', 'Secutix'],
    [5, 10, '11:00', '12:20', 'planned', 20, 'imported', 'Secutix'],
    [12, 5, '14:30', '15:30', 'planned', 18, 'imported', 'Secutix'],
    [61, 12, '10:00', '11:15', 'planned', 14, 'imported', 'Coordination'],
    [66, 0, '10:00', '11:30', 'planned', 12, 'manual'],
    // Tuesday unassigned extras
    [0, null, '09:00', '10:30', 'planned', 25, 'imported', 'Secutix', null, true],
    [24, null, '14:00', '15:00', 'planned', 12, 'imported', 'Secutix', null, true],
    [40, null, '10:00', '11:30', 'planned', 60, 'imported', 'Secutix', null, true],
    [8, null, '11:00', '12:10', 'planned', 25, 'imported', 'Secutix', null, true],
    [17, null, '18:00', '19:20', 'planned', 30, 'imported', 'Secutix', null, true],
    [57, null, '10:00', '11:00', 'planned', 8, 'imported', 'Coordination', null, true],
    [63, null, '14:30', '16:00', 'planned', 10, 'imported', 'Secutix', null, true],
    // Wednesday — 14 patterns
    [0, 0, '09:00', '10:30', 'confirmed', 25, 'imported', 'Secutix'],
    [20, 2, '10:00', '12:00', 'confirmed', 15, 'imported', 'Secutix'],
    [38, 3, '14:00', '15:00', 'confirmed', 60, 'imported', 'Secutix'],
    [44, 4, '15:30', '16:50', 'planned', 100, 'imported', 'Secutix'],
    [13, 5, '11:00', '12:10', 'planned', 20, 'imported', 'Secutix'],
    [57, 8, '10:00', '11:00', 'planned', 8, 'imported', 'Coordination'],
    [62, null, '10:00', '11:00', 'planned', 10, 'imported', 'Secutix', null, true],
    // Wednesday unassigned extras
    [1, null, '09:00', '10:30', 'planned', 22, 'imported', 'Secutix', null, true],
    [21, null, '14:00', '15:30', 'planned', 12, 'imported', 'Secutix', null, true],
    [35, null, '10:00', '11:00', 'planned', 60, 'imported', 'Secutix', null, true],
    [7, null, '11:00', '12:10', 'planned', 25, 'imported', 'Secutix', null, true],
    [46, null, '18:00', '19:00', 'planned', 50, 'imported', 'Secutix', null, true],
    [58, null, '10:00', '12:00', 'planned', 12, 'imported', 'Secutix', null, true],
    [64, null, '10:00', '11:30', 'planned', 0, 'imported', 'Secutix', null, true],
    // Thursday — 14 patterns
    [3, 1, '09:30', '11:00', 'confirmed', 22, 'imported', 'Secutix'],
    [21, 12, '10:00', '11:30', 'confirmed', 12, 'imported', 'Secutix'],
    [35, 4, '14:00', '15:00', 'planned', 60, 'imported', 'Secutix'],
    [7, 6, '11:00', '12:10', 'planned', 25, 'imported', 'Secutix'],
    [46, 11, '18:00', '19:00', 'confirmed', 50, 'imported', 'Secutix'],
    [58, 8, '10:00', '12:00', 'planned', 12, 'manual'],
    [0, 2, '14:30', '16:00', 'planned', 20, 'imported', 'Secutix', null, false, 18],
    // Thursday unassigned extras
    [2, null, '09:30', '11:00', 'planned', 18, 'imported', 'Secutix', null, true],
    [22, null, '10:00', '11:40', 'planned', 12, 'imported', 'Secutix', null, true],
    [42, null, '14:00', '15:20', 'planned', 80, 'imported', 'Secutix', null, true],
    [5, null, '11:00', '12:20', 'planned', 20, 'imported', 'Secutix', null, true],
    [12, null, '14:30', '15:30', 'planned', 18, 'imported', 'Secutix', null, true],
    [61, null, '10:00', '11:15', 'planned', 14, 'imported', 'Coordination', null, true],
    [66, null, '10:00', '11:30', 'planned', 12, 'imported', 'Secutix', null, true],
    // Friday — 14 patterns
    [0, 0, '09:00', '10:30', 'confirmed', 25, 'imported', 'Secutix'],
    [24, 14, '10:00', '11:30', 'confirmed', 12, 'imported', 'Secutix'],
    [40, 10, '14:00', '15:00', 'planned', 60, 'imported', 'Secutix'],
    [8, 6, '11:00', '12:10', 'confirmed', 25, 'imported', 'Secutix'],
    [17, 7, '18:00', '19:20', 'planned', 30, 'imported', 'Secutix'],
    [64, 0, '10:00', '11:30', 'planned', 0, 'manual', null, true],
    [63, 16, '10:00', '11:30', 'planned', 12, 'imported', 'Coordination'],
    // Friday unassigned extras
    [1, null, '09:00', '10:30', 'planned', 22, 'imported', 'Secutix', null, true],
    [20, null, '10:00', '12:00', 'planned', 14, 'imported', 'Secutix', null, true],
    [34, null, '14:00', '15:00', 'planned', 60, 'imported', 'Secutix', null, true],
    [56, null, '11:00', '12:00', 'planned', 18, 'imported', 'Secutix', null, true],
    [13, null, '09:00', '10:00', 'planned', 20, 'imported', 'Secutix', null, true],
    [42, null, '14:30', '16:00', 'planned', 80, 'imported', 'Secutix', null, true],
    [7, null, '11:00', '12:10', 'planned', 25, 'imported', 'Secutix', null, true],
  ];

  const dayPatternOffsets: Record<number, number> = { 1: 0, 2: 14, 3: 28, 4: 42, 5: 56 };

  for (let day = 0; day < totalDays; day++) {
    const date = new Date(refDate);
    date.setDate(date.getDate() + day);
    const dow = date.getDay();
    if (dow === 0 || dow === 6) continue; // Skip weekends

    const patternStart = dayPatternOffsets[dow];
    const weekNum = Math.floor(day / 7);
    const medOffset = weekNum % mediators.length;

    for (let p = 0; p < 14; p++) {
      const patternIdx = patternStart + p;
      if (patternIdx >= weekdayPatterns.length) break;
      const pattern = weekdayPatterns[patternIdx];
      const [offIdx, medIdx, start, end, status, participants, origin, source, modified, unassigned, extraMed] = pattern;

      let mediatorId = '';
      if (!unassigned) {
        mediatorId = mediators[((medIdx as number) + medOffset) % mediators.length].id;
      }

      const slotData: Record<string, unknown> = {
        offerId: offers[offIdx as number].id,
        mediatorIds: [mediatorId].filter(Boolean),
        date: dayFromRef(day),
        startTime: start,
        endTime: end,
        status,
        participantCount: participants,
        origin,
      };
      if (source) {
        slotData.importSource = source;
        slotData.importedAt = source === 'Secutix' ? secutixImport : coordinationImport;
      }
      if (modified) slotData.modifiedAfterImport = true;

      slots.push(createSlot(slotData as Parameters<typeof createSlot>[0]));

      if (extraMed !== undefined && extraMed !== null) {
        const traineeId = mediators[((extraMed as number) + medOffset) % mediators.length].id;
        if (traineeId !== mediatorId) {
          const traineeSlot = createSlot({
            ...(slotData as Parameters<typeof createSlot>[0]),
            mediatorIds: [traineeId],
            notes: 'Tutorat — formation en situation',
          });
          if (traineeSlot.origin === 'imported') traineeSlot.modifiedAfterImport = true;
          slots.push(traineeSlot);
        }
      }
    }
  }

  // Mark a few slots as modified after import
  [10, 25, 45, 60, 80, 100, 130].forEach((idx) => {
    if (slots[idx] && slots[idx].origin === 'imported') {
      slots[idx].modifiedAfterImport = true;
    }
  });

  // Add some unassigned slots
  [5, 20, 40, 70, 90, 120, 150].forEach((idx) => {
    if (slots[idx]) {
      slots[idx].mediatorIds = [];
    }
  });

  // Generate ~20 absences
  const absencePatterns = [
    { mediator: 0, startDay: 7, duration: 1, halfDay: 'morning' as const, type: 'leave' as const, notes: 'RTT' },
    { mediator: 1, startDay: 12, duration: 2, halfDay: 'none' as const, type: 'mission' as const, notes: 'Déplacement Lyon — colloque' },
    { mediator: 2, startDay: 5, duration: 1, halfDay: 'afternoon' as const, type: 'training' as const, notes: 'Formation accueil du public' },
    { mediator: 3, startDay: 20, duration: 3, halfDay: 'none' as const, type: 'leave' as const, notes: 'Congés payés' },
    { mediator: 4, startDay: 35, duration: 1, halfDay: 'morning' as const, type: 'sick' as const, notes: 'Maladie' },
    { mediator: 5, startDay: 3, duration: 2, halfDay: 'none' as const, type: 'mission' as const, notes: 'Mission Bordeaux — inventaire botanique' },
    { mediator: 6, startDay: 15, duration: 1, halfDay: 'afternoon' as const, type: 'other' as const, notes: 'Rendez-vous médical' },
    { mediator: 7, startDay: 28, duration: 1, halfDay: 'none' as const, type: 'training' as const, notes: 'Formation sécurité' },
    { mediator: 8, startDay: 42, duration: 4, halfDay: 'none' as const, type: 'leave' as const, notes: 'Congés d\u2019été' },
    { mediator: 9, startDay: 50, duration: 1, halfDay: 'morning' as const, type: 'sick' as const, notes: 'Grippe' },
    { mediator: 10, startDay: 18, duration: 2, halfDay: 'none' as const, type: 'mission' as const, notes: 'Salon professionnel Paris' },
    { mediator: 11, startDay: 60, duration: 1, halfDay: 'afternoon' as const, type: 'training' as const, notes: 'Formation taxidermie — perfectionnement' },
    { mediator: 12, startDay: 8, duration: 1, halfDay: 'morning' as const, type: 'other' as const, notes: 'Administratif' },
    { mediator: 13, startDay: 33, duration: 3, halfDay: 'none' as const, type: 'leave' as const, notes: 'Congés sans solde' },
    { mediator: 14, startDay: 47, duration: 1, halfDay: 'afternoon' as const, type: 'sick' as const, notes: 'Migraine' },
    { mediator: 15, startDay: 55, duration: 2, halfDay: 'none' as const, type: 'mission' as const, notes: 'Fouilles archéologiques — bénévolat encadré' },
    { mediator: 16, startDay: 72, duration: 1, halfDay: 'morning' as const, type: 'training' as const, notes: 'Formation LSF niveau 2' },
    { mediator: 17, startDay: 80, duration: 1, halfDay: 'none' as const, type: 'other' as const, notes: 'Congé familial' },
    { mediator: 18, startDay: 65, duration: 2, halfDay: 'none' as const, type: 'leave' as const, notes: 'RTT cumulée' },
    { mediator: 19, startDay: 85, duration: 1, halfDay: 'afternoon' as const, type: 'sick' as const, notes: 'Rendez-vous médical' },
  ];

  absencePatterns.forEach((p) => {
    const start = dayFromRef(p.startDay);
    const end = dayFromRef(p.startDay + p.duration - 1);
    absences.push(
      createAbsence({
        mediatorId: mediators[p.mediator].id,
        startDate: start,
        endDate: end,
        halfDay: p.halfDay,
        type: p.type,
        notes: p.notes,
      })
    );
  });

  data.mediators = mediators;
  data.offers = offers;
  data.schedules = [];
  data.slots = slots;
  data.absences = absences;
}
