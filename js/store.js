// store.js — localStorage persistence

import { generateExportFilename, buildExportMetadata } from './export-utils.js';

const STORAGE_KEY = 'mediaplan_data_v1';
const LAST_MODIFIED_KEY = 'mediaplan_last_modified';

const defaultData = {
    mediators: [],
    offers: [],
    schedules: [],
    slots: [],
    absences: [],
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
            absences: parsed.absences || [],
        };
    } catch (e) {
        console.error('Failed to load data:', e);
        return { ...defaultData };
    }
}

export function save(data) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        localStorage.setItem(LAST_MODIFIED_KEY, new Date().toISOString());
        return true;
    } catch (e) {
        console.error('Failed to save data:', e);
        return false;
    }
}

export function getLastModified() {
    return localStorage.getItem(LAST_MODIFIED_KEY);
}

async function gzipCompress(text) {
    const stream = new CompressionStream('gzip');
    const writer = stream.writable.getWriter();
    writer.write(new TextEncoder().encode(text));
    writer.close();
    const reader = stream.readable.getReader();
    const chunks = [];
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
    }
    return new Blob(chunks);
}

export async function exportJSON() {
    const data = load();
    const lastModified = getLastModified();
    const meta = buildExportMetadata(lastModified);
    const payload = JSON.stringify({ ...meta, data }, null, 2);
    const filename = generateExportFilename(lastModified);
    const compressed = await gzipCompress(payload);
    const url = URL.createObjectURL(compressed);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

export function importJSON(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                let text;
                // Detect gzip by file extension or magic bytes (0x1f 0x8b)
                const isGz = file.name.endsWith('.gz') ||
                    (e.target.result instanceof Uint8Array &&
                     e.target.result[0] === 0x1f && e.target.result[1] === 0x8b);
                if (isGz) {
                    const stream = new DecompressionStream('gzip');
                    const writer = stream.writable.getWriter();
                    writer.write(new Uint8Array(e.target.result));
                    writer.close();
                    const reader2 = stream.readable.getReader();
                    const chunks = [];
                    while (true) {
                        const { done, value } = await reader2.read();
                        if (done) break;
                        chunks.push(value);
                    }
                    text = new TextDecoder().decode(
                        new Uint8Array(chunks.reduce((acc, c) => [...acc, ...c], []))
                    );
                } else {
                    text = e.target.result;
                }
                const parsed = JSON.parse(text);
                // Support both old format (raw data) and new format ({ metadata, data })
                const data = parsed.data || parsed;
                save(data);
                resolve(data);
            } catch (err) {
                reject(err);
            }
        };
        reader.onerror = () => reject(new Error('Failed to read file'));
        // Read as ArrayBuffer to support both gzip and plain JSON
        reader.readAsArrayBuffer(file);
    });
}
