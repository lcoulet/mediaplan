// app.js — Main application logic

import { load, save, exportJSON } from './store.js';
import { createMediator, createOffer, createSlot, createAbsence, isMediatorAvailable, hasMediatorOverlap, STATUS_LABELS, ABSENCE_TYPE_LABELS, ORIGIN_LABELS, formatImportDate } from './models.js';
import { exportExcel, importExcel } from './excel.js';
import { createHistory, DEFAULT_HISTORY_SIZE } from './history.js';

// ===== Undo/Redo History =====
const history = createHistory(DEFAULT_HISTORY_SIZE);

// ===== State =====
let state = {
    data: { mediators: [], offers: [], schedules: [], slots: [], absences: [] },
    currentView: 'calendar',
    currentWeekStart: getWeekStart(new Date()),
    filters: { mediatorId: '', offerId: '' },
    absenceFilter: { mediatorId: '' },
    locked: false,
    showAbsences: true,
};

// ===== Demo data (for first run) =====
function seedDemoData() {
    // --- 20 mediators with creative French names ---
    const mediatorDefs = [
        { lastName: 'Tempête', firstName: 'Océane', email: 'oceane.tempete@museum.fr', phone: '06 12 34 56 78', color: '#1abc9c', notes: 'Spécialiste paléontologie' },
        { lastName: 'Fortin', firstName: 'Maxime', email: 'maxime.fortin@museum.fr', phone: '06 23 45 67 89', color: '#e67e22', notes: '' },
        { lastName: 'Vermillon', firstName: 'Léonie', email: 'leonie.vermillon@museum.fr', phone: '06 34 56 78 90', color: '#e74c3c', notes: 'Historienne de l’art' },
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
    const mediators = mediatorDefs.map(d => createMediator(d));

    // --- 70 offers ---
    const offerDefs = [
        // Visites guidées classiques
        { name: 'Visite guidée Dinosauria', description: 'Découverte de la galerie des dinosaures', duration: 90, capacity: 25, location: 'Galerie Dinosauria' },
        { name: 'Visite guidée : Trésors de l’Égypte antique', description: 'Parcours dans les collections égyptiennes', duration: 90, capacity: 30, location: 'Salle Égypte' },
        { name: 'Visite guidée : La Préhistoire pas à pas', description: 'De la pierre taillée à l’art pariétal', duration: 80, capacity: 20, location: 'Galerie Préhistoire' },
        { name: 'Visite guidée : Animaux disparus', description: 'Tous les animaux éteints du musée', duration: 70, capacity: 25, location: 'Galerie de zoologie' },
        { name: 'Visite guidée : Minéraux du monde', description: 'Collection de minéraux et gemmes', duration: 60, capacity: 20, location: 'Salle Minéralogie' },
        { name: 'Visite guidée : Au temps des mammouths', description: 'Faune glaciaire et grands mammifères', duration: 80, capacity: 25, location: 'Galerie Glaciaire' },
        { name: 'Visite guidée : Les civilisations disparues', description: 'Mayas, Assyriens, Étrusques', duration: 90, capacity: 30, location: 'Salle Archéologie' },
        { name: 'Visite guidée : Oiseaux du monde', description: 'Plus de 400 espèces naturalisées', duration: 70, capacity: 20, location: 'Galerie d’ornithologie' },
        { name: 'Visite guidée : Bêtes noires et créatures mythiques', description: 'Quand la science rencontre la légende', duration: 60, capacity: 25, location: 'Galerie Temporaire' },
        { name: 'Visite guidée : L’homme et la mer', description: 'Histoire de la navigation et de la pêche', duration: 75, capacity: 30, location: 'Galerie Maritime' },
        { name: 'Visite guidée : Histoire de la Terre', description: 'Formation des continents et tectonique', duration: 60, capacity: 20, location: 'Salle Géologie' },
        { name: 'Visite guidée : La nuit des étoiles', description: 'Astronomie et observation', duration: 90, capacity: 20, location: 'Planétarium' },
        { name: 'Visite guidée : Plantes médicinales d’hier et d’aujourd’hui', description: 'Remèdes traditionnels et pharmacopée', duration: 60, capacity: 20, location: 'Jardin botanique' },
        { name: 'Visite guidée : Les fonds marins', description: 'Biodiversité océanique', duration: 70, capacity: 25, location: 'Galerie Aquatique' },
        { name: 'Visite guidée : Au cœur du volcan', description: 'Tout savoir sur les volcans', duration: 60, capacity: 20, location: 'Salle Vulcanologie' },
        // Visites nocturnes et événements
        { name: 'Visite nocturne : Le musée s’anime', description: 'Visite exceptionnelle en soirée à la lampe de poche', duration: 90, capacity: 20, location: 'Musée entier', setupTime: 30, teardownTime: 15 },
        { name: 'Visite nocturne : Contes et légendes au musée', description: 'Récits autour des collections', duration: 80, capacity: 30, location: 'Galerie principale', setupTime: 20 },
        { name: 'Visite nocturne : Dîner-spectacle', description: 'Repas au musée suivi d’une visite', duration: 180, capacity: 40, location: 'Hall d’accueil', setupTime: 60, teardownTime: 45 },
        { name: 'Visite nocturne : Chasse au trésor nocturne', description: 'Jeu de piste nocturne en équipe', duration: 120, capacity: 25, location: 'Musée entier', setupTime: 30, teardownTime: 15 },
        { name: 'Visite nocturne : Scènes nocturnes du passé', description: 'Mises en scène sonores et visuelles', duration: 90, capacity: 30, location: 'Galerie principale', setupTime: 45, teardownTime: 30 },
        // Ateliers et ateliers pédagogiques
        { name: 'Atelier paléontologie', description: 'Atelier pratique pour enfants : fouilles et moulages', duration: 120, capacity: 15, location: 'Salle pédagogique', setupTime: 30, teardownTime: 20 },
        { name: 'Atelier : Devenez un chevalier', description: 'Pour les enfants de 6 à 10 ans', duration: 90, capacity: 12, location: 'Salle pédagogique', setupTime: 20, teardownTime: 15 },
        { name: 'Atelier : Céramique néolithique', description: 'Fabriquer et décorer un pot en argile', duration: 120, capacity: 15, location: 'Salle pédagogique', setupTime: 25, teardownTime: 30 },
        { name: 'Atelier : Calligraphie égyptienne', description: 'Apprendre les hiéroglyphes', duration: 90, capacity: 12, location: 'Salle pédagogique', setupTime: 15 },
        { name: 'Atelier : Dissection de la chouette', description: 'Étude des pelotes de rejection', duration: 90, capacity: 15, location: 'Laboratoire éducatif', setupTime: 20, teardownTime: 20 },
        { name: 'Atelier : Le masque et la moue', description: 'Construire un masque de théâtre antique', duration: 100, capacity: 12, location: 'Salle pédagogique' },
        { name: 'Atelier : Couleur des pierres', description: 'Observer et dessiner les minéraux', duration: 90, capacity: 15, location: 'Salle Minéralogie', setupTime: 10 },
        { name: 'Atelier : Tisser l’histoire', description: 'Tissage de fils à la manière gallo-romaine', duration: 110, capacity: 10, location: 'Salle pédagogique', setupTime: 30, teardownTime: 30 },
        { name: 'Atelier : Le volcan expérimental', description: 'Fabrication et éruption d’un volcan en argile', duration: 90, capacity: 15, location: 'Laboratoire éducatif', setupTime: 30, teardownTime: 30 },
        { name: 'Atelier : Préparer sa valise de paléontologue', description: 'Atelier pour enfants de 8 à 12 ans', duration: 60, capacity: 15, location: 'Salle pédagogique', setupTime: 15 },
        { name: 'Atelier : Squelette en carton', description: 'Assemblage d’un squelette humain en modèle réduit', duration: 80, capacity: 15, location: 'Salle pédagogique', setupTime: 15, teardownTime: 15 },
        { name: 'Atelier : Herboristerie médiévale', description: 'Reconnaître et préparer les plantes du Moyen Âge', duration: 90, capacity: 12, location: 'Jardin botanique', setupTime: 20, teardownTime: 15 },
        { name: 'Atelier : Moulage fossile', description: 'Apprendre à mouler un fossile', duration: 100, capacity: 12, location: 'Laboratoire éducatif', setupTime: 30, teardownTime: 30 },
        { name: 'Atelier : L’art de la préhistoire', description: 'Peindre comme à Lascaux', duration: 90, capacity: 15, location: 'Salle pédagogique', setupTime: 20 },
        { name: 'Atelier : Énigmes au musée', description: 'Rallye-jeu pour enfants', duration: 90, capacity: 20, location: 'Musée entier', setupTime: 10 },
        { name: 'Atelier : Voyage au centre de la cellule', description: 'Observer au microscope', duration: 90, capacity: 12, location: 'Laboratoire éducatif', setupTime: 25, teardownTime: 15 },
        // Conférences et conférences-spectacles
        { name: 'Conférence : Les dinosaures de l’extrême', description: 'Deuxième partie : les prédateurs', duration: 60, capacity: 80, location: 'Auditorium', setupTime: 20, teardownTime: 10 },
        { name: 'Conférence : Les plantes qui guérissent', description: 'Histoire de la pharmacopée', duration: 60, capacity: 60, location: 'Auditorium', setupTime: 15 },
        { name: 'Conférence : L’art pariétal', description: 'Lascaux, Chauvet, Altamira', duration: 70, capacity: 80, location: 'Auditorium' },
        { name: 'Conférence : L’évolution en questions', description: 'Darwin et ses héritiers', duration: 60, capacity: 60, location: 'Auditorium', setupTime: 15, teardownTime: 10 },
        { name: 'Conférence : Volcans, séismes et tsunamis', description: 'Comprendre la Terre vivante', duration: 70, capacity: 80, location: 'Auditorium' },
        { name: 'Conférence : Les grands voyageurs du XVIIIe siècle', description: 'Explorations et collections', duration: 60, capacity: 60, location: 'Auditorium', setupTime: 15 },
        { name: 'Conférence : Le return des grands prédateurs', description: 'Loup, ours, lynx en France', duration: 60, capacity: 60, location: 'Auditorium' },
        { name: 'Conférence-spectacle : Le rire du mammouth', description: 'One-man-show paléontologique', duration: 80, capacity: 100, location: 'Auditorium', setupTime: 30, teardownTime: 20 },
        { name: 'Conférence-spectacle : La nuit des pôles', description: 'Récit immersif au-delà du cercle polaire', duration: 90, capacity: 80, location: 'Auditorium', setupTime: 45, teardownTime: 30 },
        { name: 'Conférence-spectacle : Aux origines de l’art', description: 'Entre science et poésie', duration: 70, capacity: 100, location: 'Auditorium', setupTime: 30, teardownTime: 15 },
        { name: 'Conférence-spectacle : La Grande Épopée de la Forêt', description: 'Drama naturaliste de la forêt primaire', duration: 90, capacity: 100, location: 'Auditorium', setupTime: 30, teardownTime: 20 },
        // Spectacles, concerts et événements
        { name: 'Spectacle : Le Concile des oiseaux', description: 'Spectacle vivant sur l’ornithologie', duration: 60, capacity: 80, location: 'Auditorium', setupTime: 40, teardownTime: 30 },
        { name: 'Spectacle : Le Maître du feu', description: 'Démonstration interactive sur les volcans', duration: 50, capacity: 60, location: 'Galerie Vulcanologie', setupTime: 30, teardownTime: 20 },
        { name: 'Concert : Musiques préhistoriques', description: 'Concert d’instruments reconstitués', duration: 70, capacity: 80, location: 'Auditorium', setupTime: 45, teardownTime: 30 },
        { name: 'Concert : Chants d’oiseaux du monde', description: 'Récital ornithologique', duration: 60, capacity: 60, location: 'Auditorium', setupTime: 30, teardownTime: 20 },
        { name: 'Spectacle jeune public : La petite fouine', description: 'Aventure sensorielle pour 3-6 ans', duration: 40, capacity: 20, location: 'Salle jeune public', setupTime: 30, teardownTime: 20 },
        { name: 'Spectacle : La rivière des castors', description: 'Conte musical naturaliste', duration: 50, capacity: 50, location: 'Auditorium', setupTime: 30, teardownTime: 20 },
        { name: 'Récit musical : Le voyage de la baleine', description: 'Récit immersif sur les cétacés', duration: 60, capacity: 80, location: 'Auditorium', setupTime: 40, teardownTime: 20 },
        { name: 'Projection-débat : Microcosmos', description: 'Film suivi d’un débat sur les insectes', duration: 100, capacity: 80, location: 'Auditorium', setupTime: 15, teardownTime: 10 },
        // Parcours thématiques
        { name: 'Parcours : Animaux de nos régions', description: 'Visite guidée des collections locales', duration: 60, capacity: 20, location: 'Galerie Faune locale' },
        { name: 'Parcours : Les plantes et leurs secrets', description: 'Botanique dans le jardin', duration: 70, capacity: 15, location: 'Jardin botanique' },
        { name: 'Parcours : Femme scientifiques, pionnières', description: 'Parcours sur les femmes en sciences', duration: 75, capacity: 25, location: 'Musée entier' },
        { name: 'Parcours : Les couleurs de la nature', description: 'Couleurs minérales, végétales, animales', duration: 60, capacity: 20, location: 'Musée entier' },
        { name: 'Parcours sensoriel : À l’aveugle', description: 'Visite à l’aveugle guidée par le toucher et l’odorat', duration: 60, capacity: 8, location: 'Galerie Tactile', setupTime: 20, teardownTime: 10 },
        { name: 'Parcours : De l’atome à la galaxie', description: 'Parcours multi-échelles', duration: 90, capacity: 25, location: 'Musée entier' },
        { name: 'Parcours : Le temps des glaciers', description: 'Climat et glaciations', duration: 70, capacity: 20, location: 'Galerie Glaciaire' },
        // Visites pour publics spécifiques
        { name: 'Visite tactile des collections', description: 'Expérience insolite : toucher les moulages et spécimens', duration: 60, capacity: 10, location: 'Galerie Tactile', setupTime: 20, teardownTime: 10 },
        { name: 'Visite en LSF : Trésors du musée', description: 'Visite guidée en langue des signes française', duration: 90, capacity: 15, location: 'Musée entier' },
        { name: 'Visite adaptée : Handicap mental', description: 'Parcours adapté et sensoriel', duration: 60, capacity: 10, location: 'Galerie Tactile', setupTime: 15, teardownTime: 15 },
        { name: 'Visite famille : Dino-aventure', description: 'Visite interactive pour les 5-10 ans', duration: 60, capacity: 20, location: 'Galerie Dinosauria' },
        { name: 'Visite groupe scolaire : Primaire', description: 'Parcours pédagogique adapté au primaire', duration: 90, capacity: 30, location: 'Musée entier' },
        { name: 'Visite groupe scolaire : Secondaire', description: 'Parcours pédagogique adapté au secondaire', duration: 90, capacity: 30, location: 'Musée entier' },
        // Événements insolites et expériences
        { name: 'Bivouac préhistorique', description: 'Bivouac et ateliers de survie préhistorique dans le parc', duration: 300, capacity: 20, location: 'Parc du musée', setupTime: 120, teardownTime: 90 },
        { name: 'Atelier taxidermie (observation)', description: 'Démonstration et initiation à la taxidermie (spécimens naturalisés)', duration: 180, capacity: 10, location: 'Laboratoire de taxidermie', setupTime: 60, teardownTime: 45 },
    ];
    const offers = offerDefs.map(d => createOffer(d));

    // --- Assign competences (skills) to mediators ---
    // Each mediator gets a varied subset of offer IDs
    const skillAssignments = [
        [0, 20, 42, 62, 64],          // Océane — paléo, ateliers, conf, tactile, bivouac
        [0, 1, 16, 34, 56],           // Maxime — visites classiques, nocturne, conf
        [2, 3, 17, 43, 57],           // Léonie — préhistoire, nocturne, conf-spectacle
        [4, 5, 21, 44, 63],           // Côme — minéraux, visites, ateliers, escape
        [18, 41, 42, 43, 44],        // Aubin — conférences-spectacles
        [12, 13, 30, 55],             // Hortense — botanique, atelier herboristerie, parcours plantes
        [6, 7, 45, 46],               // Gaspard — civilisations, oiseaux, spectacles
        [16, 17, 18, 19, 48],        // Aurore — visites nocturnes
        [8, 9, 22, 23, 58],           // Timothée — animaux disparus, mer, ateliers
        [13, 14, 26, 38, 65],        // Pénelope — fonds marins, volcan, atelier, dégustation
        [10, 14, 15, 39, 40],        // Théodore — histoire Terre, volcans, conf
        [7, 25, 47, 50, 51],          // Yseult — oiseaux, atelier, spectacle, concert
        [2, 3, 21, 24, 33],           // Médéric — préhistoire, ateliers
        [1, 11, 56, 57],              // Blanche — Égypte, étoiles, parcours
        [8, 9, 23, 24, 36],           // Éléonore — insectes, ateliers, conf
        [4, 15, 27, 31, 67],          // Hippolyte — minéraux, volcans, atelier, stage
        [5, 6, 34, 54, 61],           // Solène — mammouths, civilisations, conf, senoirs
        [3, 7, 45, 46, 49],           // Lancelot — animaux, oiseaux, spectacles
        [12, 13, 30, 55, 58],        // Margaux — botanique, atelier, parcours
        [10, 14, 39, 41, 66],        // Faustine — géologie, volcans, conf, feu de camp
    ];
    skillAssignments.forEach((skills, i) => {
        mediators[i].skills = skills.map(offIdx => offers[offIdx].id);
    });

    // Reference date: start of previous month
    // e.g. if today is Sep 14, 2026 → reference = Aug 1, 2026
    // Data spans from reference (Aug 1) to end of next month (Oct 31)
    const now = new Date();
    const refDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const fmt = d => d.toISOString().slice(0, 10);
    const dayFromRef = n => { const d = new Date(refDate); d.setDate(d.getDate() + n); return fmt(d); };

    // 3 months ≈ 90 days
    const totalDays = 90;

    const slots = [];
    const absences = [];

    // Import timestamps (relative to ref date)
    const secutixImport = new Date(refDate).toISOString();
    const coordinationImport = new Date(refDate.getTime() + 7 * 86400000).toISOString();

    // Predefined slot patterns for weekdays (Mon=1..Fri=5)
    // Each entry: [offerIdx, mediatorIdx, start, end, status, participants, origin, source?, modifiedAfterImport?, unassigned?, extraMediatorIdx?]
    const weekdayPatterns = [
        // Monday
        [0, 0, '09:00', '10:30', 'confirmed', 22, 'imported', 'Secutix'],
        [20, 2, '10:00', '12:00', 'confirmed', 14, 'imported', 'Secutix'],
        [34, 4, '14:00', '15:00', 'confirmed', 60, 'imported', 'Secutix'],
        [56, 6, '11:00', '12:00', 'planned', 18, 'imported', 'Secutix'],
        [1, 8, '15:30', '17:00', 'planned', 12, 'imported', 'Secutix'],
        [16, 7, '18:00', '19:30', 'planned', 0, 'imported', 'Secutix', null, true],
        [60, 0, '10:00', '12:00', 'planned', 10, 'manual'],
        // Tuesday
        [2, 1, '09:30', '11:00', 'confirmed', 18, 'imported', 'Secutix'],
        [22, 3, '10:00', '11:40', 'confirmed', 12, 'imported', 'Secutix'],
        [42, 4, '14:00', '15:20', 'confirmed', 80, 'imported', 'Secutix'],
        [5, 10, '11:00', '12:20', 'planned', 20, 'imported', 'Secutix'],
        [12, 5, '14:30', '15:30', 'planned', 18, 'imported', 'Secutix'],
        [61, 12, '10:00', '11:15', 'planned', 14, 'imported', 'Coordination'],
        [66, 0, '10:00', '11:30', 'planned', 12, 'manual'],
        // Wednesday
        [0, 0, '09:00', '10:30', 'confirmed', 25, 'imported', 'Secutix'],
        [20, 2, '10:00', '12:00', 'confirmed', 15, 'imported', 'Secutix'],
        [38, 3, '14:00', '15:00', 'confirmed', 60, 'imported', 'Secutix'],
        [44, 4, '15:30', '16:50', 'planned', 100, 'imported', 'Secutix'],
        [13, 5, '11:00', '12:10', 'planned', 20, 'imported', 'Secutix'],
        [57, 8, '10:00', '11:00', 'planned', 8, 'imported', 'Coordination'],
        [62, 0, '10:00', '11:00', 'planned', 10, 'imported', 'Secutix', null, true],
        // Thursday
        [3, 1, '09:30', '11:00', 'confirmed', 22, 'imported', 'Secutix'],
        [21, 12, '10:00', '11:30', 'confirmed', 12, 'imported', 'Secutix'],
        [35, 4, '14:00', '15:00', 'planned', 60, 'imported', 'Secutix'],
        [7, 6, '11:00', '12:10', 'planned', 25, 'imported', 'Secutix'],
        [46, 11, '18:00', '19:00', 'confirmed', 50, 'imported', 'Secutix'],
        [58, 8, '10:00', '12:00', 'planned', 12, 'manual'],
        [0, 2, '14:30', '16:00', 'planned', 20, 'imported', 'Secutix', null, false, 18], // training assignment
        // Friday
        [0, 0, '09:00', '10:30', 'confirmed', 25, 'imported', 'Secutix'],
        [24, 14, '10:00', '11:30', 'confirmed', 12, 'imported', 'Secutix'],
        [40, 10, '14:00', '15:00', 'planned', 60, 'imported', 'Secutix'],
        [8, 6, '11:00', '12:10', 'confirmed', 25, 'imported', 'Secutix'],
        [17, 7, '18:00', '19:20', 'planned', 30, 'imported', 'Secutix'],
        [64, 0, '10:00', '11:30', 'planned', 0, 'manual', null, true],
        [63, 16, '10:00', '11:30', 'planned', 12, 'imported', 'Coordination'],
    ];

    // Map day-of-week to a starting pattern index (7 patterns per day, 5 weekdays)
    const dayPatternOffsets = { 1: 0, 2: 7, 3: 14, 4: 21, 5: 28 }; // Mon=1..Fri=5

    // Generate slots across all 3 months
    for (let day = 0; day < totalDays; day++) {
        const date = new Date(refDate);
        date.setDate(date.getDate() + day);
        const dow = date.getDay(); // 0=Sun, 6=Sat
        if (dow === 0 || dow === 6) continue; // Skip weekends

        const patternStart = dayPatternOffsets[dow];

        // Vary which mediators get assigned based on week number
        const weekNum = Math.floor(day / 7);
        const medOffset = weekNum % mediators.length;

        // Generate ~7 slots per weekday
        for (let p = 0; p < 7; p++) {
            const patternIdx = patternStart + p;
            if (patternIdx >= weekdayPatterns.length) break;
            const pattern = weekdayPatterns[patternIdx];
            const [offIdx, medIdx, start, end, status, participants, origin, source, modified, unassigned, extraMed] = pattern;

            // Determine mediator
            let mediatorId = '';
            if (!unassigned) {
                mediatorId = mediators[(medIdx + medOffset) % mediators.length].id;
            }

            const slotData = {
                offerId: offers[offIdx].id,
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

            slots.push(createSlot(slotData));

            // Add a second mediator (training assignment) on some slots
            if (extraMed !== undefined) {
                const traineeId = mediators[(extraMed + medOffset) % mediators.length].id;
                if (traineeId !== mediatorId) {
                    const traineeSlot = createSlot({
                        ...slotData,
                        mediatorIds: [traineeId],
                        notes: 'Tutorat — formation en situation',
                    });
                    if (traineeSlot.origin === 'imported') traineeSlot.modifiedAfterImport = true;
                    slots.push(traineeSlot);
                }
            }
        }
    }

    // Mark a few slots as modified after import (scattered across the timeline)
    [10, 25, 45, 60, 80, 100, 130].forEach(idx => {
        if (slots[idx] && slots[idx].origin === 'imported') {
            slots[idx].modifiedAfterImport = true;
        }
    });

    // Add some unassigned slots (ensure a few exist)
    [5, 20, 40, 70, 90, 120, 150].forEach(idx => {
        if (slots[idx]) {
            slots[idx].mediatorIds = [];
        }
    });

    // Generate ~20 absences spread across the 3 months
    const absencePatterns = [
        { mediator: 0, startDay: 7, duration: 1, halfDay: 'morning', type: 'leave', notes: 'RTT' },
        { mediator: 1, startDay: 12, duration: 2, halfDay: 'none', type: 'mission', notes: 'Déplacement Lyon — colloque' },
        { mediator: 2, startDay: 5, duration: 1, halfDay: 'afternoon', type: 'training', notes: 'Formation accueil du public' },
        { mediator: 3, startDay: 20, duration: 3, halfDay: 'none', type: 'leave', notes: 'Congés payés' },
        { mediator: 4, startDay: 35, duration: 1, halfDay: 'morning', type: 'sick', notes: 'Maladie' },
        { mediator: 5, startDay: 3, duration: 2, halfDay: 'none', type: 'mission', notes: 'Mission Bordeaux — inventaire botanique' },
        { mediator: 6, startDay: 15, duration: 1, halfDay: 'afternoon', type: 'other', notes: 'Rendez-vous médical' },
        { mediator: 7, startDay: 28, duration: 1, halfDay: 'none', type: 'training', notes: 'Formation sécurité' },
        { mediator: 8, startDay: 42, duration: 4, halfDay: 'none', type: 'leave', notes: 'Congés d’été' },
        { mediator: 9, startDay: 50, duration: 1, halfDay: 'morning', type: 'sick', notes: 'Grippe' },
        { mediator: 10, startDay: 18, duration: 2, halfDay: 'none', type: 'mission', notes: 'Salon professionnel Paris' },
        { mediator: 11, startDay: 60, duration: 1, halfDay: 'afternoon', type: 'training', notes: 'Formation taxidermie — perfectionnement' },
        { mediator: 12, startDay: 8, duration: 1, halfDay: 'morning', type: 'other', notes: 'Administratif' },
        { mediator: 13, startDay: 33, duration: 3, halfDay: 'none', type: 'leave', notes: 'Congés sans solde' },
        { mediator: 14, startDay: 47, duration: 1, halfDay: 'afternoon', type: 'sick', notes: 'Migraine' },
        { mediator: 15, startDay: 55, duration: 2, halfDay: 'none', type: 'mission', notes: 'Fouilles archéologiques — bénévolat encadré' },
        { mediator: 16, startDay: 72, duration: 1, halfDay: 'morning', type: 'training', notes: 'Formation LSF niveau 2' },
        { mediator: 17, startDay: 80, duration: 1, halfDay: 'none', type: 'other', notes: 'Congé familial' },
        { mediator: 18, startDay: 65, duration: 2, halfDay: 'none', type: 'leave', notes: 'RTT cumulée' },
        { mediator: 19, startDay: 85, duration: 1, halfDay: 'afternoon', type: 'sick', notes: 'Rendez-vous médical' },
    ];

    absencePatterns.forEach(p => {
        const start = dayFromRef(p.startDay);
        const end = dayFromRef(p.startDay + p.duration - 1);
        absences.push(createAbsence({
            mediatorId: mediators[p.mediator].id,
            startDate: start,
            endDate: end,
            halfDay: p.halfDay,
            type: p.type,
            notes: p.notes,
        }));
    });

    state.data = { mediators, offers, schedules: [], slots, absences };
    save(state.data);
}

// ===== State commit / undo / redo =====
function commitState() {
    save(state.data);
    history.push(state.data);
    updateUndoRedoButtons();
}

function undoState() {
    const prev = history.undo();
    if (!prev) return;
    state.data = prev;
    save(state.data);
    updateUndoRedoButtons();
    renderAll();
}

function redoState() {
    const next = history.redo();
    if (!next) return;
    state.data = next;
    save(state.data);
    updateUndoRedoButtons();
    renderAll();
}

function updateUndoRedoButtons() {
    const btnUndo = document.getElementById('btn-undo');
    const btnRedo = document.getElementById('btn-redo');
    if (btnUndo) btnUndo.disabled = !history.canUndo();
    if (btnRedo) btnRedo.disabled = !history.canRedo();
}

// ===== Init =====
function init() {
    state.data = load();
    // Migrate: assign colors to mediators that don't have one
    state.data.mediators.forEach(m => {
        if (!m.color) {
            m.color = createMediator().color;
        }
    });
    if (state.data.mediators.length === 0 && state.data.offers.length === 0) {
        seedDemoData();
    }
    // Initialize history with current state
    history.init(state.data);
    updateUndoRedoButtons();
    // Default: planning is locked
    state.locked = true;
    document.getElementById('toggle-edit-mode').checked = false;
    bindEvents();
    renderAll();
}

// ===== Navigation =====
function switchView(view) {
    state.currentView = view;
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === view);
    });
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById(`view-${view}`).classList.add('active');
    if (view === 'calendar') renderCalendar();
    if (view === 'mediators') renderMediators();
    if (view === 'offers') renderOffers();
    if (view === 'absences') renderAbsences();
}

// ===== Lock / Unlock =====
function toggleEditMode(checked) {
    if (checked) {
        if (!confirm('⚠️ Activer le mode modification permet de modifier les créneaux.\n\nLes offres importées pourront être éditées et seront marquées comme "modifiées après import".\n\nContinuer ?')) {
            document.getElementById('toggle-edit-mode').checked = false;
            return;
        }
        state.locked = false;
        document.body.classList.add('edit-mode');
    } else {
        state.locked = true;
        document.body.classList.remove('edit-mode');
    }
    renderCalendar();
}

// ===== Calendar =====
function getWeekStart(date) {
    const d = new Date(date);
    const day = d.getDay(); // 0=Sun
    const diff = day === 0 ? -6 : 1 - day; // Monday start
    d.setDate(d.getDate() + diff);
    d.setHours(0, 0, 0, 0);
    return d;
}

function renderCalendar() {
    const grid = document.getElementById('calendar-grid');
    const start = state.currentWeekStart;
    const days = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
    const todayStr = new Date().toISOString().slice(0, 10);

    // Header
    let html = '<div class="cal-header">';
    html += '<div></div>'; // time column header
    for (let i = 0; i < 7; i++) {
        const d = new Date(start);
        d.setDate(d.getDate() + i);
        const ds = d.toISOString().slice(0, 10);
        const isToday = ds === todayStr;
        html += `<div class="cal-day-name ${isToday ? 'cal-today' : ''}">
            <span>${days[i]}</span>
            <span class="cal-day-num">${d.getDate()}</span>
        </div>`;
    }
    html += '</div>';

    // Time rows (8:00 - 19:00, 40px per hour)
    const hours = Array.from({ length: 12 }, (_, i) => i + 8); // 8h to 19h
    html += '<div class="cal-time-col">';
    hours.forEach(h => {
        html += `<div class="cal-time-label">${h.toString().padStart(2, '0')}:00</div>`;
    });
    html += '</div>';

    // Day columns
    let slots = state.data.slots;
    if (state.filters.mediatorId) slots = slots.filter(s => s.mediatorIds.includes(state.filters.mediatorId));
    if (state.filters.offerId) slots = slots.filter(s => s.offerId === state.filters.offerId);

    for (let i = 0; i < 7; i++) {
        const d = new Date(start);
        d.setDate(d.getDate() + i);
        const ds = d.toISOString().slice(0, 10);
        const daySlots = slots.filter(s => s.date === ds).sort((a, b) => a.startTime.localeCompare(b.startTime));

        html += `<div class="cal-day-col" data-date="${ds}">`;

        // Absence banners for this day
        if (state.showAbsences) {
            const dayAbsences = state.data.absences.filter(a => {
                if (state.filters.mediatorId && a.mediatorId !== state.filters.mediatorId) return false;
                return ds >= a.startDate && ds <= a.endDate;
            });
            dayAbsences.forEach(abs => {
                const mediator = state.data.mediators.find(m => m.id === abs.mediatorId);
                const label = ABSENCE_TYPE_LABELS[abs.type] || abs.type;
                const medName = mediator ? `${mediator.firstName} ${mediator.lastName}` : '—';
                const halfLabel = abs.halfDay === 'morning' ? ' (AM)' : abs.halfDay === 'afternoon' ? ' (PM)' : '';
                const top = abs.halfDay === 'afternoon' ? 200 : 0;
                const height = abs.halfDay === 'none' ? 440 : 200;
                html += `<div class="cal-absence absence-${abs.type}" style="top:${top}px;height:${height - 4}px" title="${medName} — ${label}${halfLabel}">
                    <span class="absence-label">🚫 ${medName} — ${label}${halfLabel}</span>
                </div>`;
            });
        }

        // Compute parallel lanes for overlapping slots
        const lanes = []; // each lane is an array of slots
        daySlots.forEach(slot => {
            const startMin = parseInt(slot.startTime) * 60 + parseInt(slot.startTime.split(':')[1]);
            const endMin = parseInt(slot.endTime) * 60 + parseInt(slot.endTime.split(':')[1]);
            // Find a lane where the last slot ends before this one starts
            let placed = false;
            for (let l = 0; l < lanes.length; l++) {
                const last = lanes[l][lanes[l].length - 1];
                const lastEnd = parseInt(last.endTime) * 60 + parseInt(last.endTime.split(':')[1]);
                if (lastEnd <= startMin) {
                    lanes[l].push(slot);
                    placed = true;
                    break;
                }
            }
            if (!placed) {
                lanes.push([slot]);
            }
        });
        const laneCount = lanes.length;

        // Render slots in lanes
        lanes.forEach((laneSlots, laneIdx) => {
            laneSlots.forEach(slot => {
                const offer = state.data.offers.find(o => o.id === slot.offerId);
                const mediator = state.data.mediators.find(m => m.id === slot.mediatorIds[0]);
                const unassigned = !slot.mediatorIds.length;
                const available = mediator ? isMediatorAvailable(slot.mediatorIds[0], slot.date, slot.startTime, slot.endTime, state.data.absences) : true;
                const conflictIcon = available ? '' : ' ⚠️';
                const conflictClass = available ? '' : ' slot-conflict';
                const unassignedClass = unassigned ? ' slot-unassigned' : '';
                const originIcon = slot.origin === 'imported' ? (slot.modifiedAfterImport ? ' 📥✏' : ' 📥') : ' ✋';
                const mediatorColor = mediator ? (mediator.color || '#ccc') : '#ccc';
                const mediatorBadge = mediator ? `<span class="slot-mediator-dot" style="background:${mediatorColor}"></span>` : '';
                const top = (parseInt(slot.startTime) - 8) * 40 + (parseInt(slot.startTime.split(':')[1]) / 60) * 40;
                const height = ((parseInt(slot.endTime) - parseInt(slot.startTime)) * 40) + ((parseInt(slot.endTime.split(':')[1]) - parseInt(slot.startTime.split(':')[1])) / 60) * 40;
                const widthPct = laneCount > 1 ? (100 / laneCount) : 100;
                const leftPct = laneIdx * widthPct;
                html += `<div class="cal-slot status-${slot.status}${conflictClass}${unassignedClass} origin-${slot.origin}" style="top:${top}px;height:${height - 2}px;width:calc(${widthPct}% - 4px);left:calc(${leftPct}% + 2px);border-left-color:${mediatorColor}" data-slot-id="${slot.id}">
                    <div class="slot-time">${slot.startTime} – ${slot.endTime}</div>
                    <div class="slot-title">${offer ? offer.name : '—'}${originIcon}</div>
                    <div class="slot-mediator">${mediatorBadge}${mediator ? mediator.firstName + ' ' + mediator.lastName : 'Non assigné'}${conflictIcon}</div>
                </div>`;
            });
        });
        html += '</div>';
    }

    grid.innerHTML = html;

    // Update period label
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    const fmt = d => d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
    document.getElementById('period-label').textContent = `${fmt(start)} – ${fmt(end)}`;

    // Bind slot clicks
    grid.querySelectorAll('.cal-slot').forEach(el => {
        el.addEventListener('click', () => {
            const slotId = el.dataset.slotId;
            const slot = state.data.slots.find(s => s.id === slotId);
            if (slot) {
                if (state.locked) {
                    openSlotModal(slot, { mediatorOnly: true });
                } else {
                    openSlotModal(slot);
                }
            }
        });
    });

    // Bind day column clicks (add new slot in edit mode)
    grid.querySelectorAll('.cal-day-col').forEach(col => {
        col.addEventListener('click', e => {
            // Only trigger if clicking the column itself, not a slot
            if (e.target.closest('.cal-slot')) return;
            if (state.locked) return;
            const date = col.dataset.date;
            openSlotModal(null, { defaultDate: date });
        });
    });

    updateFilters();
}

function changeWeek(delta) {
    const d = new Date(state.currentWeekStart);
    d.setDate(d.getDate() + delta * 7);
    state.currentWeekStart = d;
    renderCalendar();
}

function goToToday() {
    state.currentWeekStart = getWeekStart(new Date());
    renderCalendar();
}

function updateFilters() {
    const medFilter = document.getElementById('filter-mediator');
    const offFilter = document.getElementById('filter-offer');
    const currentMed = state.filters.mediatorId;
    const currentOff = state.filters.offerId;

    medFilter.innerHTML = '<option value="">Tous les médiateurs</option>';
    state.data.mediators.forEach(m => {
        medFilter.innerHTML += `<option value="${m.id}" ${m.id === currentMed ? 'selected' : ''}>${m.firstName} ${m.lastName}</option>`;
    });

    offFilter.innerHTML = '<option value="">Toutes les offres</option>';
    state.data.offers.forEach(o => {
        offFilter.innerHTML += `<option value="${o.id}" ${o.id === currentOff ? 'selected' : ''}>${o.name}</option>`;
    });
}

// ===== Mediators view =====
function renderMediators() {
    const tbody = document.getElementById('mediators-tbody');
    const search = (document.getElementById('search-mediator')?.value || '').toLowerCase();
    let mediators = state.data.mediators;
    if (search) {
        mediators = mediators.filter(m =>
            m.lastName.toLowerCase().includes(search) ||
            m.firstName.toLowerCase().includes(search)
        );
    }

    if (mediators.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><p>Aucun médiateur</p><button class="btn btn-primary" onclick="document.getElementById('btn-add-mediator').click()">+ Ajouter un médiateur</button></div></td></tr>`;
        return;
    }

    tbody.innerHTML = mediators.map(m => {
        const skills = m.skills.map(sid => state.data.offers.find(o => o.id === sid)?.name).filter(Boolean).join(', ');
        return `<tr>
            <td><span class="mediator-color-dot" style="background:${m.color || '#ccc'}"></span> ${m.lastName}</td>
            <td>${m.firstName}</td>
            <td>${m.email || '—'}</td>
            <td>${m.phone || '—'}</td>
            <td>${skills || '—'}</td>
            <td><span class="badge ${m.active ? 'badge-active' : 'badge-inactive'}">${m.active ? 'Actif' : 'Inactif'}</span></td>
            <td class="actions-cell">
                <button class="action-btn" title="Modifier" data-edit-mediator="${m.id}">✏</button>
                <button class="action-btn" title="Supprimer" data-del-mediator="${m.id}">🗑</button>
            </td>
        </tr>`;
    }).join('');

    tbody.querySelectorAll('[data-edit-mediator]').forEach(btn => {
        btn.addEventListener('click', () => {
            const m = state.data.mediators.find(m => m.id === btn.dataset.editMediator);
            if (m) openMediatorModal(m);
        });
    });
    tbody.querySelectorAll('[data-del-mediator]').forEach(btn => {
        btn.addEventListener('click', () => deleteMediator(btn.dataset.delMediator));
    });
}

function deleteMediator(id) {
    if (!confirm('Supprimer ce médiateur ?')) return;
    state.data.mediators = state.data.mediators.filter(m => m.id !== id);
    state.data.slots = state.data.slots.filter(s => !s.mediatorIds.includes(id));
    commitState();
    renderMediators();
}

// ===== Offers view =====
function renderOffers() {
    const tbody = document.getElementById('offers-tbody');
    if (state.data.offers.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><p>Aucune offre</p><button class="btn btn-primary" onclick="document.getElementById('btn-add-offer').click()">+ Ajouter une offre</button></div></td></tr>`;
        return;
    }

    tbody.innerHTML = state.data.offers.map(o => `<tr>
        <td><strong>${o.name}</strong></td>
        <td>${o.description || '—'}</td>
        <td>${o.duration} min</td>
        <td>${o.capacity}</td>
        <td>${o.location || '—'}</td>
        <td class="actions-cell">
            <button class="action-btn" title="Modifier" data-edit-offer="${o.id}">✏</button>
            <button class="action-btn" title="Supprimer" data-del-offer="${o.id}">🗑</button>
        </td>
    </tr>`).join('');

    tbody.querySelectorAll('[data-edit-offer]').forEach(btn => {
        btn.addEventListener('click', () => {
            const o = state.data.offers.find(o => o.id === btn.dataset.editOffer);
            if (o) openOfferModal(o);
        });
    });
    tbody.querySelectorAll('[data-del-offer]').forEach(btn => {
        btn.addEventListener('click', () => deleteOffer(btn.dataset.delOffer));
    });
}

function deleteOffer(id) {
    if (!confirm('Supprimer cette offre ?')) return;
    state.data.offers = state.data.offers.filter(o => o.id !== id);
    state.data.slots = state.data.slots.filter(s => s.offerId !== id);
    state.data.mediators.forEach(m => { m.skills = m.skills.filter(sid => sid !== id); });
    commitState();
    renderOffers();
}

// ===== Modals =====
function openModal(title, bodyHtml) {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML = bodyHtml;
    document.getElementById('modal-overlay').classList.add('active');
}

function closeModal() {
    document.getElementById('modal-overlay').classList.remove('active');
}

function openMediatorModal(mediator = null) {
    const isEdit = !!mediator;
    const m = mediator || createMediator();
    const offersCheckboxes = state.data.offers.map(o => `
        <label class="checkbox-line">
            <input type="checkbox" value="${o.id}" ${m.skills.includes(o.id) ? 'checked' : ''}>
            ${o.name}
        </label>`).join('');

    openModal(isEdit ? 'Modifier le médiateur' : 'Nouveau médiateur', `
        <form id="form-mediator">
            <div class="form-row">
                <div class="form-group">
                    <label>Nom *</label>
                    <input type="text" id="m-lastName" value="${m.lastName}" required>
                </div>
                <div class="form-group">
                    <label>Prénom *</label>
                    <input type="text" id="m-firstName" value="${m.firstName}" required>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Email</label>
                    <input type="email" id="m-email" value="${m.email}">
                </div>
                <div class="form-group">
                    <label>Téléphone</label>
                    <input type="tel" id="m-phone" value="${m.phone}">
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Couleur</label>
                    <div class="color-picker">
                        <input type="color" id="m-color" value="${m.color}">
                        <span class="color-preview" id="m-color-preview" style="background:${m.color}"></span>
                    </div>
                </div>
                <div class="form-group">
                    <label>Statut</label>
                    <select id="m-active">
                        <option value="true" ${m.active ? 'selected' : ''}>Actif</option>
                        <option value="false" ${!m.active ? 'selected' : ''}>Inactif</option>
                    </select>
                </div>
            </div>
            <div class="form-group">
                <label>Compétences</label>
                <div class="checkbox-group">${offersCheckboxes || '<span style="color:var(--color-text-muted)">Aucune offre définie</span>'}</div>
            </div>
            <div class="form-group">
                <label>Notes</label>
                <textarea id="m-notes">${m.notes}</textarea>
            </div>
            <div class="form-actions">
                <button type="button" class="btn btn-secondary" id="modal-cancel">Annuler</button>
                <button type="submit" class="btn btn-primary">${isEdit ? 'Enregistrer' : 'Ajouter'}</button>
            </div>
        </form>
    `);

    document.getElementById('modal-cancel').addEventListener('click', closeModal);
    const colorInput = document.getElementById('m-color');
    const colorPreview = document.getElementById('m-color-preview');
    colorInput.addEventListener('input', e => { colorPreview.style.background = e.target.value; });
    document.getElementById('form-mediator').addEventListener('submit', e => {
        e.preventDefault();
        m.lastName = document.getElementById('m-lastName').value.trim();
        m.firstName = document.getElementById('m-firstName').value.trim();
        m.email = document.getElementById('m-email').value.trim();
        m.phone = document.getElementById('m-phone').value.trim();
        m.color = document.getElementById('m-color').value;
        m.active = document.getElementById('m-active').value === 'true';
        m.notes = document.getElementById('m-notes').value.trim();
        m.skills = Array.from(document.querySelectorAll('#form-mediator input[type=checkbox]:checked')).map(cb => cb.value);

        if (!isEdit) state.data.mediators.push(m);
        commitState();
        closeModal();
        renderMediators();
    });
}

function openOfferModal(offer = null) {
    const isEdit = !!offer;
    const o = offer || createOffer();

    openModal(isEdit ? "Modifier l'offre" : 'Nouvelle offre', `
        <form id="form-offer">
            <div class="form-group">
                <label>Nom *</label>
                <input type="text" id="o-name" value="${o.name}" required>
            </div>
            <div class="form-group">
                <label>Description</label>
                <textarea id="o-description">${o.description}</textarea>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Durée (min) *</label>
                    <input type="number" id="o-duration" value="${o.duration}" min="5" step="5" required>
                </div>
                <div class="form-group">
                    <label>Capacité *</label>
                    <input type="number" id="o-capacity" value="${o.capacity}" min="1" required>
                </div>
            </div>
            <div class="form-group">
                <label>Lieu</label>
                <input type="text" id="o-location" value="${o.location}">
            </div>
            <div class="form-actions">
                <button type="button" class="btn btn-secondary" id="modal-cancel">Annuler</button>
                <button type="submit" class="btn btn-primary">${isEdit ? 'Enregistrer' : 'Ajouter'}</button>
            </div>
        </form>
    `);

    document.getElementById('modal-cancel').addEventListener('click', closeModal);
    document.getElementById('form-offer').addEventListener('submit', e => {
        e.preventDefault();
        o.name = document.getElementById('o-name').value.trim();
        o.description = document.getElementById('o-description').value.trim();
        o.duration = parseInt(document.getElementById('o-duration').value) || 60;
        o.capacity = parseInt(document.getElementById('o-capacity').value) || 30;
        o.location = document.getElementById('o-location').value.trim();

        if (!isEdit) state.data.offers.push(o);
        commitState();
        closeModal();
        renderOffers();
    });
}

function updateMediatorWarning(mediatorId, slot) {
    const el = document.getElementById('mediator-warning');
    if (!el) return;
    if (!mediatorId) { el.innerHTML = ''; return; }

    // Check absence
    const absent = !isMediatorAvailable(mediatorId, slot.date, slot.startTime, slot.endTime, state.data.absences);
    // Check overlap with other slots
    const overlap = hasMediatorOverlap(mediatorId, slot.date, slot.startTime, slot.endTime, state.data.slots, slot.id);

    if (overlap) {
        el.innerHTML = '<span class="warning-text">⚠️ Ce médiateur a déjà un créneau à cet horaire</span>';
    } else if (absent) {
        el.innerHTML = '<span class="warning-text">🚫 Ce médiateur est absent à ce créneau</span>';
    } else {
        el.innerHTML = '';
    }
}

function openSlotDetailModal(slot) {
    const offer = state.data.offers.find(o => o.id === slot.offerId);
    const mediator = state.data.mediators.find(m => m.id === slot.mediatorIds[0]);
    const available = mediator ? isMediatorAvailable(slot.mediatorIds[0], slot.date, slot.startTime, slot.endTime, state.data.absences) : true;
    const originBadge = slot.origin === 'imported'
        ? `<span class="badge origin-badge-imported">📥 ${ORIGIN_LABELS.imported}</span>${slot.modifiedAfterImport ? ' <span class="badge origin-badge-modified">✏ Modifié après import</span>' : ''}`
        : `<span class="badge origin-badge-manual">✋ ${ORIGIN_LABELS.manual}</span>`;
    const conflictWarning = available ? '' : '<div class="detail-warning">⚠️ Médiateur absent à ce créneau</div>';

    openModal('Détails du créneau', `
        <div class="detail-view">
            <div class="detail-row"><span class="detail-label">Offre</span><span class="detail-value">${offer ? offer.name : '—'}</span></div>
            ${offer?.description ? `<div class="detail-row"><span class="detail-label">Description</span><span class="detail-value">${offer.description}</span></div>` : ''}
            ${offer ? `<div class="detail-row"><span class="detail-label">Durée</span><span class="detail-value">${offer.duration} min</span></div>` : ''}
            ${offer ? `<div class="detail-row"><span class="detail-label">Capacité</span><span class="detail-value">${offer.capacity}</span></div>` : ''}
            ${offer?.location ? `<div class="detail-row"><span class="detail-label">Lieu</span><span class="detail-value">${offer.location}</span></div>` : ''}
            <hr>
            <div class="detail-row"><span class="detail-label">Médiateur</span><span class="detail-value">${mediator ? `<span class="slot-mediator-dot" style="background:${mediator.color || '#ccc'}"></span>${mediator.firstName} ${mediator.lastName}` : 'Non assigné'}</span></div>
            <div class="detail-row"><span class="detail-label">Date</span><span class="detail-value">${new Date(slot.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span></div>
            <div class="detail-row"><span class="detail-label">Horaire</span><span class="detail-value">${slot.startTime} – ${slot.endTime}</span></div>
            <div class="detail-row"><span class="detail-label">Participants</span><span class="detail-value">${slot.participantCount}</span></div>
            <div class="detail-row"><span class="detail-label">Statut</span><span class="detail-value"><span class="badge badge-${slot.status}">${STATUS_LABELS.slot[slot.status] || slot.status}</span></span></div>
            <div class="detail-row"><span class="detail-label">Origine</span><span class="detail-value">${originBadge}</span></div>
            ${slot.importSource ? `<div class="detail-row"><span class="detail-label">Source</span><span class="detail-value">${slot.importSource}</span></div>` : ''}
            ${slot.importedAt ? `<div class="detail-row"><span class="detail-label">Importé le</span><span class="detail-value">${formatImportDate(slot.importedAt)}</span></div>` : ''}
            ${slot.notes ? `<div class="detail-row"><span class="detail-label">Notes</span><span class="detail-value">${slot.notes}</span></div>` : ''}
            ${conflictWarning}
            <div class="form-actions">
                <button type="button" class="btn btn-secondary" id="modal-cancel">Fermer</button>
            </div>
        </div>
    `);
    document.getElementById('modal-cancel').addEventListener('click', closeModal);
}

function openSlotModal(slot = null, options = {}) {
    const isEdit = !!slot;
    const mediatorOnly = options.mediatorOnly || false;
    const defaultDate = options.defaultDate || new Date().toISOString().slice(0, 10);
    const s = slot || createSlot({ date: defaultDate });

    // Build mediator options with overlap/absence indicators
    function buildMediatorOptions(selectedIds) {
        const ids = Array.isArray(selectedIds) ? selectedIds : (selectedIds ? [selectedIds] : []);
        return state.data.mediators.map(m => {
            const overlap = hasMediatorOverlap(m.id, s.date, s.startTime, s.endTime, state.data.slots, s.id);
            const absent = !isMediatorAvailable(m.id, s.date, s.startTime, s.endTime, state.data.absences);
            let label = `${m.firstName} ${m.lastName}`;
            if (overlap) label += ' ⚠️ Conflit horaire';
            else if (absent) label += ' 🚫 Absent';
            return `<option value="${m.id}" ${ids.includes(m.id) ? 'selected' : ''} ${overlap ? 'disabled' : ''}>${label}</option>`;
        }).join('');
    }
    const mediatorOptions = buildMediatorOptions(s.mediatorIds);
    const offerOptions = state.data.offers.map(o =>
        `<option value="${o.id}" ${s.offerId === o.id ? 'selected' : ''}>${o.name}</option>`
    ).join('');
    const statusOptions = Object.entries(STATUS_LABELS.slot).map(([val, label]) =>
        `<option value="${val}" ${s.status === val ? 'selected' : ''}>${label}</option>`
    ).join('');

    const offer = state.data.offers.find(o => o.id === s.offerId);

    if (mediatorOnly) {
        // Read-only details + editable mediator only
        const originBadge = s.origin === 'imported'
            ? `<span class="badge origin-badge-imported">📥 ${ORIGIN_LABELS.imported}</span>${s.modifiedAfterImport ? ' <span class="badge origin-badge-modified">✏ Modifié après import</span>' : ''}`
            : `<span class="badge origin-badge-manual">✋ ${ORIGIN_LABELS.manual}</span>`;

        openModal('Assigner un médiateur', `
            <form id="form-slot">
                <div class="detail-view">
                    <div class="detail-row"><span class="detail-label">Offre</span><span class="detail-value">${offer ? offer.name : '—'}</span></div>
                    <div class="detail-row"><span class="detail-label">Date</span><span class="detail-value">${new Date(s.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</span></div>
                    <div class="detail-row"><span class="detail-label">Horaire</span><span class="detail-value">${s.startTime} – ${s.endTime}</span></div>
                    <div class="detail-row"><span class="detail-label">Statut</span><span class="detail-value"><span class="badge badge-${s.status}">${STATUS_LABELS.slot[s.status] || s.status}</span></span></div>
                    <div class="detail-row"><span class="detail-label">Origine</span><span class="detail-value">${originBadge}</span></div>
                </div>
                <hr>
                <div class="form-group">
                    <label>Médiateurs</label>
                    <select id="s-mediatorId" multiple size="5">
                        ${mediatorOptions}
                    </select>
                    <div class="form-hint" id="mediator-warning">Ctrl+clic pour sélectionner plusieurs</div>
                </div>
                <div class="form-actions">
                    <button type="button" class="btn btn-secondary" id="modal-cancel">Annuler</button>
                    <button type="submit" class="btn btn-primary">Enregistrer</button>
                </div>
            </form>
        `);

        document.getElementById('modal-cancel').addEventListener('click', closeModal);
        document.getElementById('s-mediatorId').addEventListener('change', e => {
            const selected = Array.from(e.target.selectedOptions).map(o => o.value);
            updateMediatorWarning(selected[0] || '', s);
        });
        updateMediatorWarning(s.mediatorIds[0] || '', s);
        document.getElementById('form-slot').addEventListener('submit', e => {
            e.preventDefault();
            s.mediatorIds = Array.from(document.getElementById('s-mediatorId').selectedOptions).map(o => o.value).filter(Boolean);
            if (s.origin === 'imported') {
                s.modifiedAfterImport = true;
            }
            commitState();
            closeModal();
            renderCalendar();
        });
        return;
    }

    openModal(isEdit ? 'Modifier le créneau' : 'Nouveau créneau', `
        <form id="form-slot">
            <div class="form-group">
                <label>Offre *</label>
                <select id="s-offerId" required>
                    <option value="">— Choisir —</option>
                    ${offerOptions}
                </select>
            </div>
            <div class="form-group">
                <label>Médiateurs</label>
                <select id="s-mediatorId" multiple size="5">
                    ${mediatorOptions}
                </select>
                <div class="form-hint" id="mediator-warning">Ctrl+clic pour sélectionner plusieurs</div>
            </div>
            <div class="form-group">
                <label>Date *</label>
                <input type="date" id="s-date" value="${s.date}" required>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Début *</label>
                    <input type="time" id="s-startTime" value="${s.startTime}" required>
                </div>
                <div class="form-group">
                    <label>Fin *</label>
                    <input type="time" id="s-endTime" value="${s.endTime}" required>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Participants</label>
                    <input type="number" id="s-participantCount" value="${s.participantCount}" min="0">
                </div>
                <div class="form-group">
                    <label>Statut</label>
                    <select id="s-status">${statusOptions}</select>
                </div>
            </div>
            <div class="form-group">
                <label>Origine</label>
                <div class="origin-info">
                    ${s.origin === 'imported'
                        ? `<span class="badge origin-badge-imported">📥 ${ORIGIN_LABELS.imported}</span>
                           ${s.modifiedAfterImport ? '<span class="badge origin-badge-modified">✏ Modifié après import</span>' : ''}
                           ${s.importSource ? `<div class="origin-detail">Source : <strong>${s.importSource}</strong></div>` : ''}
                           ${s.importedAt ? `<div class="origin-detail">Importé le : ${formatImportDate(s.importedAt)}</div>` : ''}`
                        : `<span class="badge origin-badge-manual">✋ ${ORIGIN_LABELS.manual}</span>`
                    }
                </div>
            </div>
            <div class="form-group">
                <label>Notes</label>
                <textarea id="s-notes">${s.notes}</textarea>
            </div>
            <div class="form-actions">
                ${isEdit ? '<button type="button" class="btn btn-danger" id="slot-delete">Supprimer</button>' : ''}
                <button type="button" class="btn btn-secondary" id="modal-cancel">Annuler</button>
                <button type="submit" class="btn btn-primary">${isEdit ? 'Enregistrer' : 'Ajouter'}</button>
            </div>
        </form>
    `);

    document.getElementById('modal-cancel').addEventListener('click', closeModal);
    document.getElementById('s-mediatorId').addEventListener('change', e => {
        const selected = Array.from(e.target.selectedOptions).map(o => o.value);
        updateMediatorWarning(selected[0] || '', s);
    });
    if (isEdit) {
        document.getElementById('slot-delete').addEventListener('click', () => {
            state.data.slots = state.data.slots.filter(x => x.id !== s.id);
            commitState();
            closeModal();
            renderCalendar();
        });
    }
    document.getElementById('form-slot').addEventListener('submit', e => {
        e.preventDefault();
        s.offerId = document.getElementById('s-offerId').value;
        s.mediatorIds = Array.from(document.getElementById('s-mediatorId').selectedOptions).map(o => o.value).filter(Boolean);
        s.date = document.getElementById('s-date').value;
        s.startTime = document.getElementById('s-startTime').value;
        s.endTime = document.getElementById('s-endTime').value;
        s.participantCount = parseInt(document.getElementById('s-participantCount').value) || 0;
        s.status = document.getElementById('s-status').value;
        s.notes = document.getElementById('s-notes').value.trim();

        // Mark imported slots as modified after import when edited
        if (isEdit && s.origin === 'imported') {
            s.modifiedAfterImport = true;
        }

        if (!isEdit) {
            s.origin = 'manual';
            state.data.slots.push(s);
        }
        commitState();
        closeModal();
        renderCalendar();
    });
}

// ===== Event bindings =====
function bindEvents() {
    // Navigation
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => switchView(btn.dataset.view));
    });

    // Calendar
    document.getElementById('btn-prev-week').addEventListener('click', () => changeWeek(-1));
    document.getElementById('btn-next-week').addEventListener('click', () => changeWeek(1));
    document.getElementById('btn-today').addEventListener('click', goToToday);
    document.getElementById('filter-mediator').addEventListener('change', e => {
        state.filters.mediatorId = e.target.value;
        renderCalendar();
    });
    document.getElementById('filter-offer').addEventListener('change', e => {
        state.filters.offerId = e.target.value;
        renderCalendar();
    });
    document.getElementById('toggle-edit-mode').addEventListener('change', e => toggleEditMode(e.target.checked));
    document.getElementById('toggle-absences').addEventListener('change', e => {
        state.showAbsences = e.target.checked;
        renderCalendar();
    });

    // Mediators
    document.getElementById('btn-add-mediator').addEventListener('click', () => openMediatorModal());
    document.getElementById('search-mediator').addEventListener('input', () => renderMediators());

    // Offers
    document.getElementById('btn-add-offer').addEventListener('click', () => openOfferModal());

    // Absences
    document.getElementById('btn-add-absence').addEventListener('click', () => openAbsenceModal());
    document.getElementById('filter-absence-mediator').addEventListener('change', e => {
        state.absenceFilter.mediatorId = e.target.value;
        renderAbsences();
    });

    // Reset demo data
    document.getElementById('btn-reset-data').addEventListener('click', () => {
        if (confirm('⚠️ Cela va supprimer TOUTES les données actuelles et les remplacer par les données de démonstration.\n\nContinuer ?')) {
            localStorage.removeItem('mediaplan_data_v1');
            state.data = { mediators: [], offers: [], schedules: [], slots: [], absences: [] };
            seedDemoData();
            history.init(state.data);
            updateUndoRedoButtons();
            renderAll();
        }
    });

    // Import/Export
    document.getElementById('btn-export-json').addEventListener('click', () => {
        exportJSON().catch(err => alert('Erreur lors de l\'export : ' + err.message));
    });
    document.getElementById('btn-export-schedule').addEventListener('click', () => exportExcel(state.data, 'schedule'));
    document.getElementById('btn-export-mediators').addEventListener('click', () => exportExcel(state.data, 'mediators'));

    const importFile = document.getElementById('import-file');
    importFile.addEventListener('change', e => {
        const file = e.target.files[0];
        document.getElementById('import-filename').textContent = file ? file.name : 'Aucun fichier sélectionné';
        document.getElementById('btn-import-execute').disabled = !file;
    });
    document.getElementById('btn-import-execute').addEventListener('click', async () => {
        const file = importFile.files[0];
        if (!file) return;
        try {
            await importExcel(file);
            state.data = load();
            history.init(state.data);
            updateUndoRedoButtons();
            renderAll();
        } catch (e) {
            alert('Erreur import: ' + e.message);
        }
    });

    // Modal close
    document.getElementById('modal-close').addEventListener('click', closeModal);
    document.getElementById('modal-overlay').addEventListener('click', e => {
        if (e.target === e.currentTarget) closeModal();
    });

    // Undo/Redo
    document.getElementById('btn-undo').addEventListener('click', undoState);
    document.getElementById('btn-redo').addEventListener('click', redoState);
    document.addEventListener('keydown', e => {
        // Ctrl+Z = undo, Ctrl+Shift+Z or Ctrl+Y = redo
        if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
            e.preventDefault();
            undoState();
        } else if ((e.ctrlKey || e.metaKey) && (e.key === 'Z' || (e.key === 'z' && e.shiftKey) || e.key === 'y')) {
            e.preventDefault();
            redoState();
        }
    });
}

// ===== Absences view =====
function renderAbsences() {
    const tbody = document.getElementById('absences-tbody');
    const filterMed = state.absenceFilter.mediatorId;
    let absences = state.data.absences || [];
    if (filterMed) absences = absences.filter(a => a.mediatorId === filterMed);

    // Update filter dropdown
    const medFilter = document.getElementById('filter-absence-mediator');
    medFilter.innerHTML = '<option value="">Tous les médiateurs</option>';
    state.data.mediators.forEach(m => {
        medFilter.innerHTML += `<option value="${m.id}" ${m.id === filterMed ? 'selected' : ''}>${m.firstName} ${m.lastName}</option>`;
    });

    if (absences.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><p>Aucune absence enregistrée</p><button class="btn btn-primary" onclick="document.getElementById('btn-add-absence').click()">+ Ajouter une absence</button></div></td></tr>`;
        return;
    }

    const halfDayLabels = { none: 'Journée complète', morning: 'Matin', afternoon: 'Après-midi' };

    tbody.innerHTML = absences.map(a => {
        const mediator = state.data.mediators.find(m => m.id === a.mediatorId);
        const medName = mediator ? `${mediator.firstName} ${mediator.lastName}` : '—';
        return `<tr>
            <td>${medName}</td>
            <td><span class="badge absence-badge-${a.type}">${ABSENCE_TYPE_LABELS[a.type] || a.type}</span></td>
            <td>${a.startDate}</td>
            <td>${a.endDate}</td>
            <td>${halfDayLabels[a.halfDay] || a.halfDay}</td>
            <td>${a.notes || '—'}</td>
            <td class="actions-cell">
                <button class="action-btn" title="Modifier" data-edit-absence="${a.id}">✏</button>
                <button class="action-btn" title="Supprimer" data-del-absence="${a.id}">🗑</button>
            </td>
        </tr>`;
    }).join('');

    tbody.querySelectorAll('[data-edit-absence]').forEach(btn => {
        btn.addEventListener('click', () => {
            const a = state.data.absences.find(a => a.id === btn.dataset.editAbsence);
            if (a) openAbsenceModal(a);
        });
    });
    tbody.querySelectorAll('[data-del-absence]').forEach(btn => {
        btn.addEventListener('click', () => deleteAbsence(btn.dataset.delAbsence));
    });
}

function deleteAbsence(id) {
    if (!confirm('Supprimer cette absence ?')) return;
    state.data.absences = state.data.absences.filter(a => a.id !== id);
    commitState();
    renderAbsences();
}

function openAbsenceModal(absence = null) {
    const isEdit = !!absence;
    const a = absence || createAbsence({ startDate: new Date().toISOString().slice(0, 10), endDate: new Date().toISOString().slice(0, 10) });

    const mediatorOptions = state.data.mediators.map(m =>
        `<option value="${m.id}" ${a.mediatorId === m.id ? 'selected' : ''}>${m.firstName} ${m.lastName}</option>`
    ).join('');
    const typeOptions = Object.entries(ABSENCE_TYPE_LABELS).map(([val, label]) =>
        `<option value="${val}" ${a.type === val ? 'selected' : ''}>${label}</option>`
    ).join('');
    const halfDayOptions = [
        { val: 'none', label: 'Journée complète' },
        { val: 'morning', label: 'Matin' },
        { val: 'afternoon', label: 'Après-midi' },
    ].map(o => `<option value="${o.val}" ${a.halfDay === o.val ? 'selected' : ''}>${o.label}</option>`).join('');

    openModal(isEdit ? "Modifier l'absence" : 'Nouvelle absence', `
        <form id="form-absence">
            <div class="form-group">
                <label>Médiateur *</label>
                <select id="a-mediatorId" required>
                    <option value="">— Choisir —</option>
                    ${mediatorOptions}
                </select>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Du *</label>
                    <input type="date" id="a-startDate" value="${a.startDate}" required>
                </div>
                <div class="form-group">
                    <label>Au *</label>
                    <input type="date" id="a-endDate" value="${a.endDate}" required>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Type</label>
                    <select id="a-type">${typeOptions}</select>
                </div>
                <div class="form-group">
                    <label>Demi-journée</label>
                    <select id="a-halfDay">${halfDayOptions}</select>
                </div>
            </div>
            <div class="form-group">
                <label>Notes</label>
                <textarea id="a-notes">${a.notes}</textarea>
            </div>
            <div class="form-actions">
                ${isEdit ? '<button type="button" class="btn btn-danger" id="absence-delete">Supprimer</button>' : ''}
                <button type="button" class="btn btn-secondary" id="modal-cancel">Annuler</button>
                <button type="submit" class="btn btn-primary">${isEdit ? 'Enregistrer' : 'Ajouter'}</button>
            </div>
        </form>
    `);

    document.getElementById('modal-cancel').addEventListener('click', closeModal);
    if (isEdit) {
        document.getElementById('absence-delete').addEventListener('click', () => {
            state.data.absences = state.data.absences.filter(x => x.id !== a.id);
            commitState();
            closeModal();
            renderAbsences();
        });
    }
    document.getElementById('form-absence').addEventListener('submit', e => {
        e.preventDefault();
        a.mediatorId = document.getElementById('a-mediatorId').value;
        a.startDate = document.getElementById('a-startDate').value;
        a.endDate = document.getElementById('a-endDate').value;
        a.type = document.getElementById('a-type').value;
        a.halfDay = document.getElementById('a-halfDay').value;
        a.notes = document.getElementById('a-notes').value.trim();

        if (!isEdit) state.data.absences.push(a);
        commitState();
        closeModal();
        renderAbsences();
    });
}

// ===== Render all =====
function renderAll() {
    renderCalendar();
    renderMediators();
    renderOffers();
    renderAbsences();
}

// ===== Start =====
document.addEventListener('DOMContentLoaded', init);
