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
    const m1 = createMediator({ lastName: 'Dupont', firstName: 'Marie', email: 'marie.dupont@museum.fr', color: '#2c6e49' });
    const m2 = createMediator({ lastName: 'Martin', firstName: 'Paul', email: 'paul.martin@museum.fr', color: '#d68c45' });
    const m3 = createMediator({ lastName: 'Bernard', firstName: 'Sophie', email: 'sophie.bernard@museum.fr', color: '#2980b9' });
    const m4 = createMediator({ lastName: 'Lefebvre', firstName: 'Thomas', email: 'thomas.lefebvre@museum.fr', color: '#8e44ad' });
    const m5 = createMediator({ lastName: 'Moreau', firstName: 'Claire', email: 'claire.moreau@museum.fr', color: '#c0392b' });

    const o1 = createOffer({ name: 'Visite guidée Dinosauria', description: 'Visite de la galerie des dinosaures', duration: 90, capacity: 25, location: 'Galerie Dinosauria' });
    const o2 = createOffer({ name: 'Atelier paléontologie', description: 'Atelier pratique pour enfants', duration: 120, capacity: 15, location: 'Salle pédagogique' });
    const o3 = createOffer({ name: 'Visite nocturne', description: 'Visite exceptionnelle en soirée', duration: 60, capacity: 20, location: 'Musée entier' });
    const o4 = createOffer({ name: 'Visite Jardin botanique', description: 'Découverte des plantes', duration: 75, capacity: 20, location: 'Jardin botanique' });

    // Fix skills references
    m1.skills = [o1.id, o2.id, o4.id];
    m2.skills = [o1.id, o3.id];
    m3.skills = [o2.id, o4.id];
    m4.skills = [o1.id, o3.id, o4.id];
    m5.skills = [o2.id, o3.id];

    const mediators = [m1, m2, m3, m4, m5];
    const offers = [o1, o2, o3, o4];

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
    // Each entry: [offerIdx, mediatorIdx, start, end, status, participants, origin, source?, modifiedAfterImport?]
    const weekdayPatterns = [
        [0, 0, '09:00', '10:30', 'confirmed', 22, 'imported', 'Secutix'],
        [1, 2, '10:00', '12:00', 'confirmed', 15, 'imported', 'Secutix'],
        [0, 1, '11:00', '12:30', 'planned', 18, 'imported', 'Secutix'],
        [2, 1, '18:00', '19:00', 'planned', 0, 'imported', 'Secutix'],
        [3, 2, '14:00', '15:15', 'confirmed', 18, 'imported', 'Secutix'],
        [0, 3, '10:00', '11:30', 'planned', 0, 'manual'],
        [1, 0, '09:30', '11:30', 'confirmed', 15, 'imported', 'Coordination', false],
        [0, 3, '15:00', '16:30', 'planned', 12, 'imported', 'Secutix'],
        [3, 2, '11:00', '12:15', 'confirmed', 20, 'imported', 'Secutix'],
        [0, 4, '10:00', '11:30', 'planned', 0, 'manual'],
        [2, 3, '18:00', '19:00', 'confirmed', 20, 'imported', 'Secutix'],
        [1, 4, '14:00', '16:00', 'planned', 10, 'imported', 'Secutix'],
        [0, 0, '14:30', '16:00', 'confirmed', 25, 'imported', 'Secutix'],
        [3, 3, '10:00', '11:15', 'planned', 15, 'manual'],
    ];

    // Generate slots across all 3 months
    for (let day = 0; day < totalDays; day++) {
        const date = new Date(refDate);
        date.setDate(date.getDate() + day);
        const dow = date.getDay(); // 0=Sun, 6=Sat
        if (dow === 0 || dow === 6) continue; // Skip weekends

        // Use day index to pick patterns deterministically
        const patternIdx = day % weekdayPatterns.length;
        const pattern = weekdayPatterns[patternIdx];

        // Vary which mediators get assigned based on week number
        const weekNum = Math.floor(day / 7);
        const medOffset = weekNum % mediators.length;

        const [offIdx, medIdx, start, end, status, participants, origin, source, modified] = pattern;
        const mediatorId = origin === 'manual' && participants === 0 ? '' : mediators[(medIdx + medOffset) % mediators.length].id;

        const slotData = {
            offerId: offers[offIdx].id,
            mediatorId,
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
    }

    // Mark a few slots as modified after import (scattered across the timeline)
    [10, 25, 45, 60].forEach(idx => {
        if (slots[idx] && slots[idx].origin === 'imported') {
            slots[idx].modifiedAfterImport = true;
        }
    });

    // Add some unassigned slots
    [5, 20, 35, 55, 75].forEach(idx => {
        if (slots[idx]) {
            slots[idx].mediatorId = '';
        }
    });

    // Generate absences spread across the 3 months
    const absencePatterns = [
        { mediator: 0, startDay: 7, duration: 1, halfDay: 'morning', type: 'leave', notes: 'RTT' },
        { mediator: 1, startDay: 12, duration: 2, halfDay: 'none', type: 'mission', notes: 'Déplacement Lyon' },
        { mediator: 2, startDay: 5, duration: 1, halfDay: 'afternoon', type: 'training', notes: 'Formation first aid' },
        { mediator: 3, startDay: 20, duration: 3, halfDay: 'none', type: 'leave', notes: 'Congés payés' },
        { mediator: 4, startDay: 35, duration: 1, halfDay: 'morning', type: 'sick', notes: 'Maladie' },
        { mediator: 0, startDay: 45, duration: 2, halfDay: 'none', type: 'mission', notes: 'Salon professionnel' },
        { mediator: 1, startDay: 60, duration: 1, halfDay: 'afternoon', type: 'training', notes: 'Formation accueil' },
        { mediator: 2, startDay: 70, duration: 4, halfDay: 'none', type: 'leave', notes: 'Congés été' },
        { mediator: 3, startDay: 80, duration: 1, halfDay: 'morning', type: 'other', notes: 'Rendez-vous médical' },
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
    if (state.filters.mediatorId) slots = slots.filter(s => s.mediatorId === state.filters.mediatorId);
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
                const mediator = state.data.mediators.find(m => m.id === slot.mediatorId);
                const unassigned = !slot.mediatorId;
                const available = mediator ? isMediatorAvailable(slot.mediatorId, slot.date, slot.startTime, slot.endTime, state.data.absences) : true;
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
    state.data.slots = state.data.slots.filter(s => s.mediatorId !== id);
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
    const mediator = state.data.mediators.find(m => m.id === slot.mediatorId);
    const available = mediator ? isMediatorAvailable(slot.mediatorId, slot.date, slot.startTime, slot.endTime, state.data.absences) : true;
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
    function buildMediatorOptions(selectedId) {
        return state.data.mediators.map(m => {
            const overlap = hasMediatorOverlap(m.id, s.date, s.startTime, s.endTime, state.data.slots, s.id);
            const absent = !isMediatorAvailable(m.id, s.date, s.startTime, s.endTime, state.data.absences);
            let label = `${m.firstName} ${m.lastName}`;
            if (overlap) label += ' ⚠️ Conflit horaire';
            else if (absent) label += ' 🚫 Absent';
            return `<option value="${m.id}" ${m.id === selectedId ? 'selected' : ''} ${overlap ? 'disabled' : ''}>${label}</option>`;
        }).join('');
    }
    const mediatorOptions = buildMediatorOptions(s.mediatorId);
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
                    <label>Médiateur</label>
                    <select id="s-mediatorId">
                        <option value="">— Non assigné —</option>
                        ${mediatorOptions}
                    </select>
                    <div class="form-hint" id="mediator-warning"></div>
                </div>
                <div class="form-actions">
                    <button type="button" class="btn btn-secondary" id="modal-cancel">Annuler</button>
                    <button type="submit" class="btn btn-primary">Enregistrer</button>
                </div>
            </form>
        `);

        document.getElementById('modal-cancel').addEventListener('click', closeModal);
        document.getElementById('s-mediatorId').addEventListener('change', e => updateMediatorWarning(e.target.value, s));
        updateMediatorWarning(s.mediatorId, s);
        document.getElementById('form-slot').addEventListener('submit', e => {
            e.preventDefault();
            s.mediatorId = document.getElementById('s-mediatorId').value;
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
                <label>Médiateur</label>
                <select id="s-mediatorId">
                    <option value="">— Non assigné —</option>
                    ${mediatorOptions}
                </select>
                <div class="form-hint" id="mediator-warning"></div>
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
    document.getElementById('s-mediatorId').addEventListener('change', e => updateMediatorWarning(e.target.value, s));
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
        s.mediatorId = document.getElementById('s-mediatorId').value;
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
