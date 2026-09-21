// DemoData.ts — seedDemoData, ported from js/app.js seedDemoData()

import type { AppData } from '../domain/types';
import { createMediator, createOffer, createSlot, createAbsence, getDefaultHalfDayConfig } from '../domain/models';

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

  // --- 48 offers, derived from the real Secutix export (labels, espaces,
  // dominant durations). welcomeType: "Accueil Libre" = no mediator needed. ---
  const offerDefs = [
    // Visites encadrées — exposition permanente (90 min)
    { name: 'Découvrons le Muséum (CP à CE2)', description: 'Visite guidée de première découverte', duration: 90, capacity: 30, location: 'Exposition permanente', setupTime: 10, teardownTime: 0, secutixLabel: 'G/ CP à CE2/ Découvrons le Muséum' },
    { name: "L'Arbre à Clés (CM1 à 6e)", description: 'Parcours-jeu dans les galeries', duration: 90, capacity: 30, location: 'Exposition permanente', setupTime: 10, teardownTime: 5, secutixLabel: "G/ CM1 à 6e/ L'Arbre à Clés" },
    { name: 'Minéraux (CP à CE2)', description: 'Visite guidée sur les roches et minéraux', duration: 90, capacity: 30, location: 'Exposition permanente', setupTime: 0, teardownTime: 5, secutixLabel: 'G/ CP à CE2/ Minéraux' },
    { name: 'Minéraux (CM1 à 6e)', description: 'Visite guidée sur les roches et minéraux', duration: 90, capacity: 30, location: 'Exposition permanente', setupTime: 0, teardownTime: 5, secutixLabel: 'G/ CM1 à 6e/ Minéraux' },
    { name: 'Minéraux (2nde à Tale)', description: 'Visite guidée sur les roches et minéraux', duration: 90, capacity: 30, location: 'Exposition permanente', setupTime: 0, teardownTime: 5, secutixLabel: 'G/ 2nde à Tale/ Minéraux' },
    { name: 'Cabinet de Curiosités (CM1 à 6e)', description: 'Histoire des collections du Muséum', duration: 90, capacity: 30, location: 'Exposition permanente', setupTime: 5, teardownTime: 5, secutixLabel: 'G/ CM1 à 6e/ Cabinet de Curiosités' },
    { name: 'Les Couloirs du Temps (CM1 à 6e)', description: 'Voyage à travers les ères géologiques', duration: 90, capacity: 30, location: 'Exposition permanente', setupTime: 5, teardownTime: 0, secutixLabel: 'G/ CM1 à 6e/ Les Couloirs du Temps' },
    { name: 'Paysages de notre Région (CP à CE2)', description: 'Milieux naturels régionaux', duration: 90, capacity: 30, location: 'Exposition permanente', setupTime: 0, teardownTime: 5, secutixLabel: 'G/ CP à CE2/ Paysages de notre Région' },
    { name: 'Visite Découverte Expo Perm', description: 'Présentation générale du Muséum', duration: 90, capacity: 30, location: 'Exposition permanente', setupTime: 5, teardownTime: 0, secutixLabel: 'G/ Visite Découverte Expo Perm MHN' },
    { name: 'Visite Découverte Expo Temp', description: 'Découverte guidée de l\u2019exposition temporaire', duration: 60, capacity: 30, location: 'Exposition temporaire', setupTime: 5, teardownTime: 5, secutixLabel: 'G/ Visite Découverte Expo Temp MHN' },
    { name: "Tous l'Autre (4e à 3e)", description: 'Exposition Tous l\u2019Autre, niveau collège', duration: 90, capacity: 30, location: 'Exposition temporaire', setupTime: 0, teardownTime: 0, secutixLabel: "G/ 4e à 3e/ Tous l'Autre" },
    { name: "Tous l'Autre (2nde à Tale)", description: 'Exposition Tous l\u2019Autre, niveau lycée', duration: 90, capacity: 30, location: 'Exposition temporaire', setupTime: 0, teardownTime: 0, secutixLabel: "G/ 2nde à Tale/ Visite Tous l'Autre" },
    { name: 'Visite Géants (CP à CE2)', description: 'Autour des grands animaux du Muséum', duration: 90, capacity: 30, location: 'Exposition permanente', setupTime: 0, teardownTime: 5, secutixLabel: 'G/ CP à CE2/ Visite Géants' },
    // Ateliers des tout-petits (60 min)
    { name: 'Atelier Voyage aux Pays des Géants Disparus', description: 'Atelier maternelle', duration: 60, capacity: 22, location: 'Atelier des tout-petits', setupTime: 15, teardownTime: 15, secutixLabel: 'G/ PMGS/ Atelier Voyage aux Pays des Géants Disparus' },
    { name: 'Atelier Petite Guêpe', description: 'Atelier maternelle', duration: 60, capacity: 22, location: 'Atelier des tout-petits', setupTime: 15, teardownTime: 10, secutixLabel: 'G/ PMGS/ Atelier Petite Guêpe' },
    { name: "Atelier Madame Cro'Sensible", description: 'Atelier maternelle', duration: 60, capacity: 22, location: 'Atelier des tout-petits', setupTime: 10, teardownTime: 15, secutixLabel: "G/ PMGS/ Atelier Madame Cro'Sensible" },
    { name: 'Atelier Quand Vient la Nuit...', description: 'Atelier maternelle', duration: 60, capacity: 22, location: 'Atelier des tout-petits', setupTime: 15, teardownTime: 5, secutixLabel: 'G/ PMGS/ Quand Vient la Nuit...' },
    { name: 'Atelier MHN (PSH cognitif)', description: 'Atelier adapté, handicap cognitif', duration: 60, capacity: 12, location: 'Atelier des tout-petits', setupTime: 15, teardownTime: 15, secutixLabel: 'G/ PSH COGNITIF/ Atelier MHN' },
    { name: 'Atelier MHN (PSH visuel)', description: 'Atelier adapté, déficience visuelle', duration: 60, capacity: 12, location: 'Atelier des tout-petits', setupTime: 15, teardownTime: 15, secutixLabel: 'G/ PSH VISUEL/ Atelier MHN' },
    // Labos (60 min)
    { name: 'Labo La Vie au Paléolithique (CP à CE2)', description: 'Manipulations au laboratoire', duration: 60, capacity: 30, location: 'Laboratoire', setupTime: 15, teardownTime: 15, secutixLabel: 'G/ CE2/ Labo La Vie au Paléolithique' },
    { name: 'Labo Le Secret d\u2019un Géant Oublié', description: 'Manipulations au laboratoire', duration: 60, capacity: 30, location: 'Laboratoire', setupTime: 15, teardownTime: 10, secutixLabel: 'G/ CP à CE2/ Labo Le Secret d\u2019un Géant Oublié' },
    { name: "Labo De l'oeuf ou de la Graine ?", description: 'Manipulations au laboratoire', duration: 60, capacity: 30, location: 'Laboratoire', setupTime: 10, teardownTime: 10, secutixLabel: "G/ CP à CE2/ Labo De l'oeuf ou de la Graine ?" },
    { name: 'Labo Biodiversité et Interactions (CM1 à 6e)', description: 'Manipulations au laboratoire', duration: 60, capacity: 30, location: 'Laboratoire', setupTime: 15, teardownTime: 15, secutixLabel: 'G/ CM1 à 6e/ Labo Biodiversité et Interactions' },
    { name: 'Labo MHN (PSH cognitif)', description: 'Labo adapté, handicap cognitif', duration: 60, capacity: 12, location: 'Laboratoire', setupTime: 15, teardownTime: 15, secutixLabel: 'G/ PSH COGNITIF/ Labo MHN' },
    { name: 'Réserves Labo MHN (PSH cognitif)', description: 'Visite des réserves adaptée', duration: 60, capacity: 8, location: 'Réserves', setupTime: 10, teardownTime: 10, secutixLabel: 'G/ PSH COGNITIF/ Réserves Labo MHN' },
    // Passeur d'Histoires, auditorium (60 min)
    { name: 'Passeur d\u2019Histoires : Au Pays des Insectes', description: 'Spectacle jeune public', duration: 60, capacity: 60, location: 'Auditorium', setupTime: 15, teardownTime: 10, secutixLabel: 'G/ C1-2-3/ Passeur d\u2019Histoires Au Pays des Insectes' },
    { name: 'Passeur d\u2019Histoires : Sous l\u2019Océan', description: 'Spectacle jeune public', duration: 60, capacity: 60, location: 'Auditorium', setupTime: 15, teardownTime: 10, secutixLabel: 'G/ C1-2-3/ Passeur d\u2019Histoires Sous l\u2019Océan' },
    // Visites adaptées PSH (90 min)
    { name: 'Visite Thématique MHN (PSH cognitif)', description: 'Visite adaptée, handicap cognitif', duration: 90, capacity: 12, location: 'Exposition permanente', setupTime: 10, teardownTime: 0, secutixLabel: 'G/ PSH COGNITIF/ Visite Thématique MHN' },
    { name: 'Visite Thématique MHN (PSH visuel)', description: 'Visite adaptée, déficience visuelle', duration: 90, capacity: 8, location: 'Exposition permanente', setupTime: 10, teardownTime: 0, secutixLabel: 'G/ PSH VISUEL/ Visite Thématique MHN' },
    { name: 'Visite Thématique MHN (PSH auditif)', description: 'Visite adaptée, déficience auditive', duration: 90, capacity: 12, location: 'Exposition permanente', setupTime: 10, teardownTime: 0, secutixLabel: 'G/ PSH AUDITIF/ Visite Thématique MHN' },
    { name: 'Visite Découverte MHN (PSH cognitif)', description: 'Visite adaptée, handicap cognitif', duration: 90, capacity: 12, location: 'Exposition permanente', setupTime: 10, teardownTime: 0, secutixLabel: 'G/ PSH COGNITIF/ Visite Découverte MHN' },
    // Hors les murs (60 min)
    { name: 'Médiation Hors les Murs', description: 'Médiation hors du Muséum', duration: 60, capacity: 30, location: 'Hors les murs', setupTime: 15, teardownTime: 15, secutixLabel: 'G/ Médiation Hors les Murs' },
    { name: 'Visite Hors Les Murs (PSH cognitif)', description: 'Sortie adaptée, handicap cognitif', duration: 60, capacity: 12, location: 'Hors les murs', setupTime: 15, teardownTime: 10, secutixLabel: 'G/ PSH COGNITIF/ Visite Hors Les Murs' },
    { name: 'Mon petit Muséum Hors les Murs', description: 'Médiation hors du Muséum, jeune public', duration: 60, capacity: 30, location: 'Hors les murs', setupTime: 15, teardownTime: 15, secutixLabel: 'G/ Mon petit Muséum  Hors les Murs' },
    // Auditorium / divers (90 min)
    { name: 'Activité Encadrée', description: 'Activité encadrée en auditorium', duration: 90, capacity: 80, location: 'Auditorium', setupTime: 15, teardownTime: 10, secutixLabel: 'G/ Activité Encadrée' },
    { name: 'Séminaire-Atelier', description: 'Séminaire avec atelier', duration: 90, capacity: 40, location: 'Exposition permanente', setupTime: 15, teardownTime: 15, secutixLabel: 'G/ Séminaire-Atelier' },
    { name: 'Lecture HLM', description: 'Lecture hors les murs', duration: 60, capacity: 30, location: 'Hors les murs', setupTime: 10, teardownTime: 0, secutixLabel: 'G/ Lecture HLM' },
    { name: 'Visite Découverte JBHG', description: 'Découverte du jardin botanique', duration: 90, capacity: 30, location: 'Jardin botanique', setupTime: 5, teardownTime: 5, secutixLabel: 'G/ Visite Découverte JBHG' },
    // Accueil libre — sans médiateur
    { name: 'Visite Libre Expo Perm', description: 'Visite libre des galeries', duration: 60, capacity: 60, location: 'Exposition permanente', welcomeType: 'Accueil Libre' as const, secutixLabel: 'G/ Visite Libre Expo Perm MHN' },
    { name: 'Visite Libre Expo Temp', description: 'Visite libre de l\u2019exposition temporaire', duration: 60, capacity: 60, location: 'Exposition temporaire', welcomeType: 'Accueil Libre' as const, secutixLabel: 'G/ Visite Libre Expo Temp MHN' },
    { name: 'Visite Libre Support : La Vie sur Terre', description: 'Visite libre avec support pédagogique', duration: 60, capacity: 30, location: 'Exposition permanente', welcomeType: 'Accueil Libre' as const, secutixLabel: 'G/ CP à CE2/ Visite Libre Support/ La Vie sur Terre' },
    { name: "Visite Libre Support : L'Envol d'Anatole", description: 'Visite libre avec support, maternelle', duration: 60, capacity: 22, location: 'Exposition permanente', welcomeType: 'Accueil Libre' as const, secutixLabel: "G/ PMGS/ Visite Libre Support/ L'Envol d'Anatole" },
    { name: 'Visite Libre Support : Comment Classer le Vivant', description: 'Visite libre avec support pédagogique', duration: 60, capacity: 30, location: 'Exposition permanente', welcomeType: 'Accueil Libre' as const, secutixLabel: 'G/ CM1 à 6e/ Visite Libre Support/ Comment Classer le Vivant' },
    { name: 'Visite Libre Livret Twiga', description: 'Visite libre avec livret, loisirs maternels', duration: 60, capacity: 30, location: 'Exposition permanente', welcomeType: 'Accueil Libre' as const, secutixLabel: 'G/ LOISIRS MATER/ Visite Libre Livret Twiga' },
    { name: 'Visite Libre Mallette : Parcours interactif', description: 'Parcours interactif au 1er étage', duration: 60, capacity: 15, location: 'Exposition permanente', welcomeType: 'Accueil Libre' as const, secutixLabel: 'G/ PSH/ Visite Libre Mallette 1er ét / Parcours interactif' },
    { name: 'Pause Repas', description: 'Mise à disposition d\u2019espace pour le repas des groupes', duration: 60, capacity: 60, location: 'R&C', setupTime: 0, teardownTime: 15, welcomeType: 'Accueil Libre' as const, secutixLabel: 'G/ Pause Repas' },
    { name: 'Anniversaire 3-6 ans', description: 'Goûter et activités, 3 à 6 ans', duration: 60, capacity: 12, location: 'Atelier des tout-petits', setupTime: 15, teardownTime: 15, welcomeType: 'Accueil Libre' as const },
    { name: 'Anniversaire 7-11 ans', description: 'Goûter et activités, 7 à 11 ans', duration: 60, capacity: 12, location: 'Atelier des tout-petits', setupTime: 15, teardownTime: 15, welcomeType: 'Accueil Libre' as const },
  ];
  const offers = offerDefs.map((d) => createOffer(d));

  // --- Assign competences (skills) to mediators ---
  const skillAssignments = [
    [0, 8, 13, 25, 34],
    [1, 5, 14, 27, 31],
    [2, 6, 15, 28, 35],
    [3, 9, 19, 29, 25],
    [0, 10, 13, 20, 31],
    [4, 16, 21, 30, 26],
    [5, 17, 22, 26, 36],
    [6, 18, 23, 27, 34],
    [0, 12, 19, 28, 32],
    [1, 14, 20, 30, 33],
    [2, 9, 21, 24, 31],
    [7, 15, 22, 29, 34],
    [3, 13, 23, 25, 35],
    [8, 16, 19, 24, 26],
    [4, 12, 17, 30, 36],
    [5, 18, 20, 32, 37],
    [0, 10, 21, 28, 33],
    [1, 6, 15, 22, 34],
    [2, 11, 16, 23, 35],
    [8, 13, 17, 24, 29],
  ];
  skillAssignments.forEach((skills, i) => {
    mediators[i].competences = skills.map((offIdx) => ({ offerId: offers[offIdx].id, status: 'confirmed' as const }));
  });

  // Learning competences: for offers that actually appear in the demo
  // patterns, give one mediator WITHOUT a confirmed competence on the
  // offer a 'learning' competence. Offers are picked deterministically so
  // the weekly view shows some learning-status slots while most assigned
  // slots stay OK.
  const patternOfferIdx = [0, 2, 5, 13, 16, 19, 21, 25, 27, 31, 34, 36];
  patternOfferIdx.forEach((offIdx, k) => {
    if (offIdx >= offers.length) return;
    // Only mediators NOT confirmed on the offer can be learning on it
    const candidates = mediators.filter(
      (m) => !m.competences.some((c) => c.offerId === offers[offIdx].id)
    );
    if (candidates.length === 0) return;
    const med = candidates[(k * 3) % candidates.length];
    med.competences.push({ offerId: offers[offIdx].id, status: 'learning' as const });
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

  // ~15 months: previous month + current month + one year ahead
  const totalDays = 455;
  const slots: typeof data.slots = [];
  const absences: typeof data.absences = [];

  const secutixImport = new Date(refDate).toISOString();
  const coordinationImport = new Date(refDate.getTime() + 7 * 86400000).toISOString();

  // Booking details for imported demo slots (Secutix-like). All names,
  // phone numbers and account references are INVENTED — never reuse real
  // data from Secutix exports.
  const DEMO_GROUP_NAMES = [
    'ECOLE ELEMENTAIRE LES TOURNESOLS - CE1',
    'ECOLE MATERNELLE DES PETITS CAILLOUX - MS',
    'COLLEGE DES CYPRES - 5E2',
    'LYCEE DES HAUTES TOUPIES - 2NDE B',
    'CENTRE DE LOISIRS LA CABANE A MALICE',
    'ASSOCIATION LES AMIS DU VIEUX QUARTIER',
    'IME LA MAISON DU VENT',
    'ITEP LE CHEMIN DES ETOILES',
    'MAISON DE RETRAITE LES GLYCINES',
    'FOYER DE VIE LES BRUYERES',
  ];
  const DEMO_GROUP_NATURES = ['SCOLAIRES C1', 'SCOLAIRES C2', 'SCOLAIRES C3', 'SCOLAIRES LYCEE', 'PSH', 'LOISIRS ELEM', 'ADULTES', 'FAMILLES'];
  const DEMO_CONTACTS = [
    { name: '(50100421) MERLANDE, Céleste', phone: '06 71 24 85 19', email: 'celeste.merlande@exemple.fr' },
    { name: '(50100958) BRISSEAU, Timothée', phone: '06 83 61 40 27', email: 'timothee.brisseau@exemple.fr' },
    { name: '(50101177) LOUBIERS, Malika', phone: '07 92 15 68 03', email: 'malika.loubiers@exemple.fr' },
  ];

  const toMin = (t: string): number => {
    const [h, m] = t.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  };
  const fromMin = (min: number): string =>
    `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

  // Predefined slot patterns for weekdays (Mon=1..Fri=5)
  // Each entry: [offerIdx, mediatorIdx, start, status, participants, origin,
  //              source?, modifiedAfterImport?, unassigned?, extraMedIdx?]
  // The END time is derived from the offer's duration (booking duration
  // always equals the offer duration — demo-data-consistency test).
  // Most unassigned patterns: imported reservations without mediator.
  const weekdayPatterns: (string | number | boolean | null)[][] = [
    // Monday — 14 patterns (most unassigned)
[0, 0, '09:15', 'confirmed', 28, 'imported', 'Secutix'],
[1, 2, '10:00', 'confirmed', 26, 'imported', 'Secutix'],
[13, 4, '14:00', 'confirmed', 22, 'imported', 'Secutix'],
[19, 6, '11:00', 'planned', 24, 'imported', 'Secutix'],
[2, 8, '13:30', 'planned', 28, 'imported', 'Secutix'],
[38, null, '09:45', 'planned', 40, 'imported', 'Secutix', null, false, true],
[3, null, '09:30', 'planned', 24, 'imported', 'Secutix', null, true],
[14, null, '14:30', 'planned', 18, 'imported', 'Secutix', null, true],
[27, null, '10:15', 'planned', 12, 'imported', 'Coordination', null, true],
[25, null, '11:00', 'planned', 30, 'imported', 'Secutix', null, true],
[20, null, '15:00', 'planned', 16, 'imported', 'Secutix', null, true],
[45, null, '12:00', 'planned', 30, 'imported', 'Secutix', null, true],
[5, 0, '10:30', 'planned', 10, 'manual'],
[31, null, '14:00', 'planned', 20, 'imported', 'Secutix', null, true],
    // Tuesday — 14 patterns
[4, 1, '09:30', 'confirmed', 26, 'imported', 'Secutix'],
[15, 3, '10:15', 'confirmed', 20, 'imported', 'Secutix'],
[34, 4, '14:00', 'confirmed', 60, 'imported', 'Secutix'],
[21, 10, '11:00', 'planned', 16, 'imported', 'Secutix'],
[6, 5, '13:45', 'planned', 24, 'imported', 'Secutix'],
[26, 12, '10:00', 'planned', 28, 'imported', 'Coordination'],
[2, 0, '10:30', 'planned', 26, 'manual'],
[9, null, '09:00', 'planned', 30, 'imported', 'Secutix', null, true],
[28, null, '14:00', 'planned', 10, 'imported', 'Secutix', null, true],
[24, null, '10:30', 'planned', 8, 'imported', 'Secutix', null, true],
[7, null, '11:15', 'planned', 26, 'imported', 'Secutix', null, true],
[18, null, '16:30', 'planned', 12, 'imported', 'Secutix', null, true],
[8, null, '10:00', 'planned', 22, 'imported', 'Coordination', null, true],
[35, null, '14:30', 'planned', 14, 'imported', 'Secutix', null, true],
    // Wednesday — 14 patterns
[0, 0, '09:15', 'confirmed', 26, 'imported', 'Secutix'],
[14, 2, '10:00', 'confirmed', 18, 'imported', 'Secutix'],
[22, 3, '14:00', 'planned', 16, 'imported', 'Secutix'],
[25, 4, '15:30', 'planned', 30, 'imported', 'Secutix'],
[20, 5, '11:00', 'planned', 14, 'imported', 'Secutix'],
[29, 8, '10:15', 'planned', 10, 'imported', 'Coordination'],
[40, null, '10:00', 'planned', 20, 'imported', 'Secutix', null, true],
[2, null, '09:30', 'planned', 28, 'imported', 'Secutix', null, true],
[13, null, '14:15', 'planned', 22, 'imported', 'Secutix', null, true],
[1, null, '10:00', 'planned', 30, 'imported', 'Secutix', null, true],
[36, null, '16:00', 'planned', 40, 'imported', 'Secutix', null, true],
[23, null, '10:45', 'planned', 10, 'imported', 'Secutix', null, true],
[17, null, '15:00', 'planned', 8, 'imported', 'Secutix', null, true],
[39, null, '13:00', 'planned', 35, 'imported', 'Secutix', null, true],
    // Thursday — 14 patterns
[3, 1, '09:30', 'confirmed', 24, 'imported', 'Secutix'],
[16, 12, '10:00', 'confirmed', 18, 'imported', 'Secutix'],
[27, 4, '14:00', 'planned', 10, 'imported', 'Secutix'],
[8, 6, '11:00', 'planned', 30, 'imported', 'Secutix'],
[26, 11, '17:00', 'confirmed', 28, 'imported', 'Secutix'],
[19, 8, '10:30', 'planned', 12, 'manual'],
[12, 2, '14:30', 'planned', 26, 'imported', 'Secutix', null, false, false, 18],
[5, null, '09:00', 'planned', 22, 'imported', 'Secutix', null, true],
[15, null, '10:30', 'planned', 16, 'imported', 'Secutix', null, true],
[34, null, '14:00', 'planned', 60, 'imported', 'Secutix', null, true],
[21, null, '11:15', 'planned', 14, 'imported', 'Secutix', null, true],
[31, null, '15:30', 'planned', 18, 'imported', 'Secutix', null, true],
[30, null, '10:00', 'planned', 8, 'imported', 'Coordination', null, true],
[47, null, '13:30', 'planned', 12, 'imported', 'Secutix', null, true],
    // Friday — 14 patterns
[0, 0, '09:15', 'confirmed', 30, 'imported', 'Secutix'],
[13, 14, '10:00', 'confirmed', 24, 'imported', 'Secutix'],
[24, 10, '14:00', 'planned', 8, 'imported', 'Secutix'],
[28, 6, '11:00', 'confirmed', 10, 'imported', 'Secutix'],
[35, 7, '16:00', 'planned', 14, 'imported', 'Secutix'],
[41, 0, '10:30', 'planned', 26, 'manual'],
[32, 16, '10:00', 'planned', 10, 'imported', 'Coordination'],
[2, null, '09:00', 'planned', 24, 'imported', 'Secutix', null, true],
[14, null, '14:15', 'planned', 20, 'imported', 'Secutix', null, true],
[25, null, '11:00', 'planned', 32, 'imported', 'Secutix', null, true],
[45, null, '12:15', 'planned', 28, 'imported', 'Secutix', null, true],
[20, null, '09:45', 'planned', 16, 'imported', 'Secutix', null, true],
[12, null, '10:30', 'planned', 26, 'imported', 'Secutix', null, true],
[7, null, '11:15', 'planned', 28, 'imported', 'Secutix', null, true],
  ];

  const dayPatternOffsets: Record<number, number> = { 1: 0, 2: 14, 3: 28, 4: 42, 5: 56 };

  for (let day = 0; day < totalDays; day++) {
    const date = new Date(refDate);
    date.setDate(date.getDate() + day);
    const dow = date.getDay();
    if (dow === 0 || dow === 6) continue; // Skip weekends

    const patternStart = dayPatternOffsets[dow];
    const weekNum = Math.floor(day / 7);

    // Mediators CONFIRMED for each offer, precomputed once per offer index.
    // Patterns rotate within this pool so most assigned slots are OK.
    const confirmedPool = (offIdx: number) =>
      mediators.filter((m) =>
        m.competences.some((c) => c.offerId === offers[offIdx].id && c.status === 'confirmed')
      );
    const confirmedPools = offers.map((_, i) => confirmedPool(i));
    // Learning pool: mediators with a 'learning' competence on the offer
    const learningPools = offers.map((o) =>
      mediators.filter((m) =>
        m.competences.some((c) => c.offerId === o.id && c.status === 'learning')
      )
    );

    for (let p = 0; p < 14; p++) {
      const patternIdx = patternStart + p;
      if (patternIdx >= weekdayPatterns.length) break;
      const pattern = weekdayPatterns[patternIdx];
      const [offIdx, medIdx, start, status, participants, origin, source, modified, unassigned, extraMed] = pattern;
      const offerIdx = offIdx as number;
      const slotOffer = offers[offerIdx];
      // End derived from the offer duration (booking = offer duration)
      const endTime = fromMin(toMin(start as string) + slotOffer.duration);

      let mediatorId = '';
      if (!unassigned) {
        // Deterministic pattern rotation, mostly OK statuses:
        // - 1 slot in 7 uses a LEARNING mediator on that offer (learning pool,
        //   rotating) so the weekly view shows some learning states
        // - otherwise pick from the CONFIRMED pool, rotating weekly
        const useLearning = p % 7 === 6 && learningPools[offerIdx].length > 0;
        const pool = useLearning ? learningPools[offerIdx] : confirmedPools[offerIdx];
        const fallbackPool = pool.length > 0 ? pool : mediators;
        mediatorId = fallbackPool[(weekNum + (medIdx as number)) % fallbackPool.length].id;
      } else if ((day + p) % 2 === 0 && confirmedPools[offerIdx].length > 0) {
        // Half of the "unassigned" pattern occurrences get a CONFIRMED
        // mediator anyway (alternating deterministically): the planning is
        // mostly OK, while still showing a steady stream of slots to assign.
        const pool = confirmedPools[offerIdx];
        mediatorId = pool[(weekNum + p) % pool.length].id;
      }

      const slotData: Record<string, unknown> = {
        offerId: offers[offIdx as number].id,
        mediatorIds: [mediatorId].filter(Boolean),
        date: dayFromRef(day),
        startTime: start,
        endTime,
        status,
        participantCount: participants,
        origin,
      };
      // Per-slot logistics durations: default to the offer's values
      if (slotOffer.setupTime !== undefined) slotData.setupTime = slotOffer.setupTime;
      if (slotOffer.teardownTime !== undefined) slotData.teardownTime = slotOffer.teardownTime;
      if (source) {
        slotData.importSource = source;
        slotData.importedAt = source === 'Secutix' ? secutixImport : coordinationImport;
        // Secutix booking details (group, contact, contract, espace)
        const contact = DEMO_CONTACTS[(day + p) % DEMO_CONTACTS.length];
        slotData.groupName = DEMO_GROUP_NAMES[(day + p) % DEMO_GROUP_NAMES.length];
        slotData.groupNature = DEMO_GROUP_NATURES[(day * 3 + p) % DEMO_GROUP_NATURES.length];
        slotData.location = slotOffer.location;
        slotData.contractNumber = String(3100000 + ((day * 14 + p) % 700));
        slotData.contactName = contact.name;
        slotData.contactPhone = contact.phone;
        slotData.contactEmail = contact.email;
      }
      if (modified) slotData.modifiedAfterImport = true;

      slots.push(createSlot(slotData as Parameters<typeof createSlot>[0]));

      if (extraMed !== undefined && extraMed !== null) {
        // Tutorat: the extra mediator is LEARNING on this offer (mentorat)
        const learnPool = learningPools[offerIdx].length > 0 ? learningPools[offerIdx] : mediators;
        const traineeId = learnPool[(weekNum + (extraMed as number)) % learnPool.length].id;
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

  // Generate ~20 base absence patterns, REPEATED across the full 15-month
  // span so absences appear all year (each repetition shifted by ~3 months
  // with a deterministic day offset)
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
    // Repeat each pattern every ~95 days across the whole seed span
    for (let rep = 0; rep * 95 < totalDays; rep++) {
      const dayOffset = p.startDay + rep * 95 + (rep % 3) * 11; // deterministic jitter
      if (dayOffset >= totalDays) break;
      const start = dayFromRef(dayOffset);
      const end = dayFromRef(dayOffset + p.duration - 1);
    
    // Compute startTime and endTime based on halfDay
    let startTime: string | undefined;
    let endTime: string | undefined;

    if (p.halfDay === 'morning') {
      startTime = '00:00';
      endTime = '13:00';
    } else if (p.halfDay === 'afternoon') {
      startTime = '13:00';
      endTime = '23:59';
    } else {
      startTime = '00:00';
      endTime = '23:59';
    }

    absences.push(
      createAbsence({
        mediatorId: mediators[p.mediator].id,
        startDate: start,
        endDate: end,
        halfDay: p.halfDay,
        type: p.type,
        notes: p.notes,
        startTime,
        endTime,
      })
    );
    }
  });

  data.mediators = mediators;
  data.offers = offers;
  data.schedules = [];
  data.slots = slots;
  data.absences = absences;
  data.halfDayConfig = getDefaultHalfDayConfig();
}
