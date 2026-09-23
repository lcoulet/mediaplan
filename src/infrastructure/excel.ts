// excel.ts — Excel import/export (stub, SheetJS to be added)

import type { AppData } from '../domain/types';

export type ExportType = 'schedule' | 'mediators' | 'offers';

export function exportExcel(_data: AppData, _type: ExportType = 'schedule'): void {
  // TODO(#excel): implement with SheetJS
  alert('Export Excel non encore implémenté. Utilisez la sauvegarde JSON pour le moment.');
}

export function importExcel(_file: File): Promise<AppData> {
  // TODO(#excel): implement with SheetJS
  alert('Import Excel non encore implémenté.');
  return Promise.reject(new Error('Not implemented'));
}
