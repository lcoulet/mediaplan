// models.js — Data models and ID generation

let idCounter = 0;

export function generateId(prefix = 'id') {
    idCounter++;
    return `${prefix}_${Date.now().toString(36)}_${idCounter.toString(36)}`;
}

// Mediator
export function createMediator(data = {}) {
    return {
        id: data.id || generateId('med'),
        lastName: data.lastName || '',
        firstName: data.firstName || '',
        email: data.email || '',
        phone: data.phone || '',
        skills: data.skills || [],
        active: data.active !== undefined ? data.active : true,
        notes: data.notes || '',
    };
}

// Mediation Offer
export function createOffer(data = {}) {
    return {
        id: data.id || generateId('off'),
        name: data.name || '',
        description: data.description || '',
        duration: data.duration || 60,
        capacity: data.capacity || 30,
        location: data.location || '',
    };
}

// Schedule
export function createSchedule(data = {}) {
    return {
        id: data.id || generateId('sch'),
        title: data.title || '',
        startDate: data.startDate || '',
        endDate: data.endDate || '',
        status: data.status || 'draft',
    };
}

// Reservation / Slot
export function createSlot(data = {}) {
    return {
        id: data.id || generateId('slot'),
        scheduleId: data.scheduleId || '',
        offerId: data.offerId || '',
        mediatorId: data.mediatorId || '',
        date: data.date || '',
        startTime: data.startTime || '09:00',
        endTime: data.endTime || '10:00',
        participantCount: data.participantCount || 0,
        status: data.status || 'planned',
        notes: data.notes || '',
    };
}

// Status labels (FR)
export const STATUS_LABELS = {
    schedule: {
        draft: 'Brouillon',
        published: 'Publié',
        archived: 'Archivé',
    },
    slot: {
        planned: 'Planifié',
        confirmed: 'Confirmé',
        cancelled: 'Annulé',
        completed: 'Terminé',
    },
};
