// app.js — Main application logic

import { load, save, exportJSON } from './store.js';
import { createMediator, createOffer, createSlot, createAbsence, isMediatorAvailable, STATUS_LABELS, ABSENCE_TYPE_LABELS, ORIGIN_LABELS, formatImportDate } from './models.js';
import { exportExcel, importExcel } from './excel.js';

// ===== State =====
let state = {
    data: { mediators: [], offers: [], schedules: [], slots: [], absences: [] },
    currentView: 'calendar',
    currentWeekStart: getWeekStart(new Date()),
    filters: { mediatorId: '', offerId: '' },
    absenceFilter: { mediatorId: '' },
    locked: false,
};

// ===== Demo data (for first run) =====
function seedDemoData() {
    const m1 = createMediator({ lastName: 'Dupont', firstName: 'Marie', email: 'marie.dupont@museum.fr', skills: ['off_1', 'off_2'], active: true });
    const m2 = createMediator({ lastName: 'Martin', firstName: 'Paul', email: 'paul.martin@museum.fr', skills: ['off_1', 'off_3'], active: true });
    const m3 = createMediator({ lastName: 'Bernard', firstName: 'Sophie', email: 'sophie.bernard@museum.fr', skills: ['off_2'], active: true });

    const o1 = createOffer({ name: 'Visite guidée Dinosauria', description: 'Visite de la galerie des dinosaures', duration: 90, capacity: 25, location: 'Galerie Dinosauria' });
    const o2 = createOffer({ name: 'Atelier paléontologie', description: 'Atelier pratique pour enfants', duration: 120, capacity: 15, location: 'Salle pédagogique' });
    const o3 = createOffer({ name: 'Visite nocturne', description: 'Visite exceptionnelle en soirée', duration: 60, capacity: 20, location: 'Musée entier' });

    // Fix skills references
    m1.skills = [o1.id, o2.id];
    m2.skills = [o1.id, o3.id];
    m3.skills = [o2.id];

    const today = new Date();
    const fmt = d => d.toISOString().slice(0, 10);
    const offsetDay = n => { const d = new Date(today); d.setDate(d.getDate() + n); return fmt(d); };

    const slots = [
        createSlot({ offerId: o1.id, mediatorId: m1.id, date: offsetDay(0), startTime: '09:00', endTime: '10:30', status: 'confirmed', participantCount: 22, origin: 'imported', importSource: 'Secutix', importedAt: '2026-09-10T14:00:00.000Z' }),
        createSlot({ offerId: o2.id, mediatorId: m3.id, date: offsetDay(0), startTime: '14:00', endTime: '16:00', status: 'planned', participantCount: 12, origin: 'imported', importSource: 'Secutix', importedAt: '2026-09-10T14:00:00.000Z' }),
        createSlot({ offerId: o1.id, mediatorId: m2.id, date: offsetDay(1), startTime: '10:00', endTime: '11:30', status: 'planned', participantCount: 18, origin: 'manual' }),
        createSlot({ offerId: o3.id, mediatorId: m2.id, date: offsetDay(2), startTime: '18:00', endTime: '19:00', status: 'planned', participantCount: 0, origin: 'manual' }),
        createSlot({ offerId: o2.id, mediatorId: m1.id, date: offsetDay(3), startTime: '09:30', endTime: '11:30', status: 'confirmed', participantCount: 15, origin: 'imported', importSource: 'Coordination', importedAt: '2026-09-08T10:30:00.000Z', modifiedAfterImport: true }),
        createSlot({ offerId: o1.id, mediatorId: m1.id, date: offsetDay(4), startTime: '11:00', endTime: '12:30', status: 'planned', participantCount: 0, origin: 'manual' }),
    ];

    const absences = [
        createAbsence({ mediatorId: m1.id, startDate: offsetDay(2), endDate: offsetDay(2), halfDay: 'morning', type: 'leave', notes: 'RTT' }),
        createAbsence({ mediatorId: m2.id, startDate: offsetDay(3), endDate: offsetDay(4), halfDay: 'none', type: 'mission', notes: 'Déplacement Lyon' }),
        createAbsence({ mediatorId: m3.id, startDate: offsetDay(1), endDate: offsetDay(1), halfDay: 'afternoon', type: 'training', notes: 'Formation first aid' }),
    ];

    state.data = { mediators: [m1, m2, m3], offers: [o1, o2, o3], schedules: [], slots, absences };
    save(state.data);
}

// ===== Init =====
function init() {
    state.data = load();
    if (state.data.mediators.length === 0 && state.data.offers.length === 0) {
        seedDemoData();
    }
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
        // Enabling edit mode — warn the user
        if (!confirm('⚠️ Activer le mode modification permet de modifier les créneaux.\n\nLes offres importées pourront être éditées et seront marquées comme "modifiées après import".\n\nContinuer ?')) {
            // Revert toggle
            document.getElementById('toggle-edit-mode').checked = false;
            return;
        }
        state.locked = false;
    } else {
        state.locked = true;
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

        html += '<div class="cal-day-col">';

        // Absence banners for this day
        const dayAbsences = state.data.absences.filter(a => {
            if (state.filters.mediatorId && a.mediatorId !== state.filters.mediatorId) return false;
            return ds >= a.startDate && ds <= a.endDate;
        });
        let absTop = 0;
        dayAbsences.forEach(abs => {
            const mediator = state.data.mediators.find(m => m.id === abs.mediatorId);
            const label = ABSENCE_TYPE_LABELS[abs.type] || abs.type;
            const medName = mediator ? `${mediator.firstName} ${mediator.lastName}` : '—';
            const halfLabel = abs.halfDay === 'morning' ? ' (AM)' : abs.halfDay === 'afternoon' ? ' (PM)' : '';
            const top = abs.halfDay === 'afternoon' ? 200 : 0; // afternoon starts at 12:00 = 200px
            const height = abs.halfDay === 'none' ? 440 : 200; // full day = 440px, half = 200px
            html += `<div class="cal-absence absence-${abs.type}" style="top:${top}px;height:${height - 4}px" data-absence-id="${abs.id}" title="${medName} — ${label}${halfLabel}">
                <span class="absence-label">🚫 ${medName} — ${label}${halfLabel}</span>
            </div>`;
            absTop += height;
        });

        daySlots.forEach(slot => {
            const offer = state.data.offers.find(o => o.id === slot.offerId);
            const mediator = state.data.mediators.find(m => m.id === slot.mediatorId);
            const unassigned = !slot.mediatorId;
            const available = mediator ? isMediatorAvailable(slot.mediatorId, slot.date, slot.startTime, slot.endTime, state.data.absences) : true;
            const conflictIcon = available ? '' : ' ⚠️';
            const conflictClass = available ? '' : ' slot-conflict';
            const unassignedClass = unassigned ? ' slot-unassigned' : '';
            const originIcon = slot.origin === 'imported' ? (slot.modifiedAfterImport ? ' 📥✏' : ' 📥') : ' ✋';
            const mediatorColor = mediator ? mediator.color : '#ccc';
            const mediatorBadge = mediator ? `<span class="slot-mediator-dot" style="background:${mediatorColor}"></span>` : '';
            const top = (parseInt(slot.startTime) - 8) * 40 + (parseInt(slot.startTime.split(':')[1]) / 60) * 40;
            const height = ((parseInt(slot.endTime) - parseInt(slot.startTime)) * 40) + ((parseInt(slot.endTime.split(':')[1]) - parseInt(slot.startTime.split(':')[1])) / 60) * 40;
            html += `<div class="cal-slot status-${slot.status}${conflictClass}${unassignedClass} origin-${slot.origin}" style="top:${top}px;height:${height - 2}px;border-left-color:${mediatorColor}" data-slot-id="${slot.id}">
                <div class="slot-time">${slot.startTime} – ${slot.endTime}</div>
                <div class="slot-title">${offer ? offer.name : '—'}${originIcon}</div>
                <div class="slot-mediator">${mediatorBadge}${mediator ? mediator.firstName + ' ' + mediator.lastName : 'Non assigné'}${conflictIcon}</div>
            </div>`;
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
                    openSlotDetailModal(slot);
                } else {
                    openSlotModal(slot);
                }
            }
        });
    });

    // Bind absence clicks
    grid.querySelectorAll('.cal-absence').forEach(el => {
        el.addEventListener('click', () => {
            const absId = el.dataset.absenceId;
            const abs = state.data.absences.find(a => a.id === absId);
            if (abs && !state.locked) openAbsenceModal(abs);
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
    save(state.data);
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
    save(state.data);
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
        save(state.data);
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
        save(state.data);
        closeModal();
        renderOffers();
    });
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
            <div class="detail-row"><span class="detail-label">Médiateur</span><span class="detail-value">${mediator ? `<span class="slot-mediator-dot" style="background:${mediator.color}"></span>${mediator.firstName} ${mediator.lastName}` : 'Non assigné'}</span></div>
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

function openSlotModal(slot = null) {
    const isEdit = !!slot;
    const s = slot || createSlot({ date: new Date().toISOString().slice(0, 10) });

    const mediatorOptions = state.data.mediators.map(m =>
        `<option value="${m.id}" ${s.mediatorId === m.id ? 'selected' : ''}>${m.firstName} ${m.lastName}</option>`
    ).join('');
    const offerOptions = state.data.offers.map(o =>
        `<option value="${o.id}" ${s.offerId === o.id ? 'selected' : ''}>${o.name}</option>`
    ).join('');
    const statusOptions = Object.entries(STATUS_LABELS.slot).map(([val, label]) =>
        `<option value="${val}" ${s.status === val ? 'selected' : ''}>${label}</option>`
    ).join('');

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
    if (isEdit) {
        document.getElementById('slot-delete').addEventListener('click', () => {
            state.data.slots = state.data.slots.filter(x => x.id !== s.id);
            save(state.data);
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
        save(state.data);
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
            renderAll();
        }
    });

    // Import/Export
    document.getElementById('btn-export-json').addEventListener('click', () => exportJSON());
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
    save(state.data);
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
            save(state.data);
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
        save(state.data);
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
