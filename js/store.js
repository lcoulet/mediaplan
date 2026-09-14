// store.js — localStorage persistence

const STORAGE_KEY = 'mediaplan_data_v1';

const defaultData = {
    mediators: [],
    offers: [],
    schedules: [],
    slots: [],
};

export function load() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return { ...defaultData };
        const parsed = JSON.parse(raw);
        return {
            mediators: parsed.mediators || [],
            offers: parsed.offers || [],
            schedules: parsed.schedules || [],
            slots: parsed.slots || [],
        };
    } catch (e) {
        console.error('Failed to load data:', e);
        return { ...defaultData };
    }
}

export function save(data) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        return true;
    } catch (e) {
        console.error('Failed to save data:', e);
        return false;
    }
}
