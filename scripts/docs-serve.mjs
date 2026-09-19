#!/usr/bin/env node

/**
 * Script: docs:serve
 * Génère la documentation utilisateur (captures + markdown) et lance un serveur local
 * pour consulter la doc.
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ROOT = path.join(__dirname, '..');
const DOCS_DIR = path.join(ROOT, 'docs');
const CAPTURES_DIR = path.join(DOCS_DIR, 'captures');
const USER_GUIDE_PATH = path.join(DOCS_DIR, 'user-guide.md');

// 1. Créer le dossier captures s'il n'existe pas
if (!fs.existsSync(CAPTURES_DIR)) {
  fs.mkdirSync(CAPTURES_DIR, { recursive: true });
  console.log('✅ Dossier docs/captures créé');
}

// 2. Lancer le serveur Vite en arrière-plan
console.log('🚀 Démarrage du serveur Vite (port 5173)...');
const devServer = execSync('npm run dev -- --port 5173', {
  cwd: ROOT,
  stdio: 'ignore',
  detached: true,
});

// 3. Attendre que le serveur soit prêt (simple sleep pour éviter de complexifier)
console.log('⏳ Attente du serveur (5s)...');
setTimeout(() => {
  // 4. Captures avec un browser headless (ici on simule, en vrai utiliser puppeteer/playwright)
  console.log('📸 Captures en cours... (simulé)');
  // TODO: intégrer puppeteer/playwright pour les vraies captures

  // 5. Générer le markdown de la doc utilisateur
  const userGuideContent = `# Documentation utilisateur — MediaPlan

## 📌 Accès rapide

- Bouton "?" dans le header → ouvre la documentation dans un nouvel onglet
- Fichier : docs/user-guide.md (mis à jour automatiquement)

## 📱 Fonctionnalités principales

### Planning
- Vue hebdomadaire des réservations
- Filtres : médiateurs, offres, dates
- Verrouillage : par défaut, cliquez sur le cadenas pour verrouiller/déverrouiller
- Création de réservation : cliquez sur une case vide → sélectionnez un médiateur et une offre
- Modification : cliquez sur une réservation existante
- Suppression : cliquez sur une réservation → Supprimer

### Médiateurs
- Liste des médiateurs avec leurs couleurs
- Ajouter / modifier / supprimer un médiateur
- Couleur : chaque médiateur a une couleur visible dans le planning et les réservations

### Offres
- Liste des offres de médiation (visites guidées, ateliers…)
- Chaque offre a une couleur visible dans le planning et les réservations
- Ajouter / modifier / supprimer une offre
- Couleur : choisissez une couleur via le sélecteur dans le formulaire d'offre

### Absences
- Liste des absences (congés, missions, formations…)
- Ajouter / modifier / supprimer une absence
- Les absences sont affichées en gris sur le planning (non cliquables)

### Import / Export
- Export : sauvegarde JSON + Excel (stub)
- Import : restauration depuis JSON
- Reset : 🔄 → réinitialise avec les données de démonstration

### Raccourcis clavier
- Ctrl+Z : Annuler
- Ctrl+Shift+Z : Rétablir

---

## 🎨 Couleurs

- Médiateurs : chaque médiateur a une couleur unique (visible dans les pills)
- Offres : chaque offre a une couleur unique (visible dans les pills)
- Absences : affichées en gris

---

## 🔧 Administration

- Verrouillage : le planning est verrouillé par défaut. Déverrouillez pour modifier.
- Réservations modifiées après import : marquées comme modifiées
- Recouvrement : les réservations qui se chevauchent sont affichées côte à côte

---

*Documentation générée automatiquement. Dernaine mise à jour : aujourd'hui.*
`;

  fs.writeFileSync(USER_GUIDE_PATH, userGuideContent);
  console.log('✅ docs/user-guide.md généré');

  // 6. Ouvrir le navigateur sur la doc
  console.log('📖 Documentation disponible sur : http://localhost:5173/user-guide');
  try {
    execSync('xdg-open http://localhost:5173/user-guide || open http://localhost:5173/user-guide', { stdio: 'ignore' });
  } catch {
    console.log('💡 Ouvrez manuellement : http://localhost:5173/user-guide');
  }

  // 7. Instructions pour intégrer les vraies captures (puppeteer/playwright)
  console.log('\n📌 Prochaine étape : intégrer puppeteer/playwright pour les captures automatiques.');
  console.log('   Exemple de commande : npx puppeteer screenshot --url http://localhost:5173 --path docs/captures/home.png');

}, 5000);
