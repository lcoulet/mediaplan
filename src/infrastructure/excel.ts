// excel.ts — Excel import/export (stub, SheetJS to be added)

import type { AppData } from '../domain/types';

export type ExportType = 'schedule' | 'mediators' | 'offers';

export function exportExcel(_data: AppData, _type: ExportType = 'schedule'): void {
  // TODO: implement with SheetJS
  console.log('Export Excel:', _type, _data);
  alert('Export Excel non encore implémenté. Utilisez la sauvegarde JSON pour le moment.');
}

export function importExcel(file: File): Promise<AppData> {
  // TODO: implement with SheetJS
  console.log('Import Excel:', file.name);
  alert('Import Excel non encore implémenté.');
  return Promise.reject(new Error('Not implemented'));
}
