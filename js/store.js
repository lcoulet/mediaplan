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

export function exportJSON() {
    const data = load();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mediaplan_backup_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

export function importJSON(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                save(data);
                resolve(data);
            } catch (err) {
                reject(err);
            }
        };
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsText(file);
    });
}
