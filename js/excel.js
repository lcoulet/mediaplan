// excel.js — Excel import/export (stub, SheetJS to be added)

export function exportExcel(data, type = 'schedule') {
    // TODO: implement with SheetJS
    console.log('Export Excel:', type, data);
    alert('Export Excel non encore implémenté. Utilisez la sauvegarde JSON pour le moment.');
}

export function importExcel(file) {
    // TODO: implement with SheetJS
    console.log('Import Excel:', file.name);
    alert('Import Excel non encore implémenté.');
    return Promise.reject(new Error('Not implemented'));
}
