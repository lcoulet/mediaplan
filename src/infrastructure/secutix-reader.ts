// secutix-reader.ts — Read the Secutix "visitPlanning" export with SheetJS
//
// Browser-side wrapper around the pure header mapping: the reader extracts
// raw rows (one entry per mapped column, cell strings); filtering, dedup and
// planning live in src/domain/secutix-import.ts.
//
// The real export uses a typographic apostrophe (U+2019) in some headers
// ("N° DOSSIER D'ACHAT"); header matching normalizes apostrophes and
// whitespace on both sides.

import * as XLSX from 'xlsx';
import type { SecutixRow } from '../domain/secutix-import';

export const SECUTIX_SHEET_NAME = 'visitPlanning';

// Export header (normalized) → SecutixRow field. Unknown columns are ignored.
const COLUMN_MAP: Record<string, keyof SecutixRow> = {
  'DATE HEURE DU PRODUIT': 'productDateTime',
  'PRODUIT': 'product',
  'NOM DU GROUPE': 'groupName',
  'GUIDE': 'guide',
  'THÈME': 'theme',
  "N° DOSSIER D'ACHAT": 'contractNumber',
  'DURÉE': 'duration',
  'SITE': 'site',
  'ESPACE': 'location',
  'LANGUE DE VISITE': 'visitLanguage',
  'TYPE OPÉRATION': 'operationType',
  'NATURE DU GROUPE': 'groupNature',
  'NB TOTAL DE PERSONNES PAR GUIDE': 'participantCount',
  "CONTACT DU DOSSIER D'ACHAT": 'contactName',
  'TÉLÉPHONE DU CONTACT DU DOSSIER': 'contactPhone',
  'EMAIL DU CONTACT DU DOSSIER': 'contactEmail',
  'REMARQUE': 'remark',
  'ETAT DE LA VISITE': 'visitState',
  "HEURE D'ARRIVÉE PRÉVUE": 'plannedArrivalTime',
};

function normalizeHeader(cell: unknown): string {
  return String(cell ?? '')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function cellToString(cell: unknown): string {
  // raw: false gives formatted strings; numbers still arrive as numbers
  // when a cell carries no format — normalize everything to text
  return String(cell ?? '').trim();
}

function emptyRow(): SecutixRow {
  return {
    productDateTime: '',
    product: '',
    groupName: '',
    guide: '',
    theme: '',
    contractNumber: '',
    duration: '',
    site: '',
    location: '',
    visitLanguage: '',
    operationType: '',
    groupNature: '',
    participantCount: '',
    contactName: '',
    contactPhone: '',
    contactEmail: '',
    remark: '',
    visitState: '',
    plannedArrivalTime: '',
  };
}

/**
 * Convert a sheet read as an array-of-arrays into raw Secutix rows.
 * The header row is located by its "DATE HEURE DU PRODUIT" column (the real
 * export puts it on row 2, row 1 being empty) — no fixed index.
 */
export function matrixToSecutixRows(matrix: unknown[][]): SecutixRow[] {
  const headerRowIndex = matrix.findIndex((r) =>
    Array.isArray(r) && r.some((c) => normalizeHeader(c) === 'DATE HEURE DU PRODUIT')
  );
  if (headerRowIndex === -1) return [];

  const fieldByCol = new Map<number, keyof SecutixRow>();
  (matrix[headerRowIndex] as unknown[]).forEach((cell, col) => {
    const field = COLUMN_MAP[normalizeHeader(cell)];
    if (field) fieldByCol.set(col, field);
  });

  const rows: SecutixRow[] = [];
  for (let r = headerRowIndex + 1; r < matrix.length; r++) {
    const cells = matrix[r] as unknown[];
    if (!Array.isArray(cells)) continue;
    const row = emptyRow();
    for (const [col, field] of fieldByCol) {
      row[field] = cellToString(cells[col]);
    }
    rows.push(row);
  }
  return rows;
}

/** Extract raw rows from a parsed Secutix workbook (visitPlanning sheet). */
export function workbookToSecutixRows(wb: XLSX.WorkBook): SecutixRow[] {
  const sheetName =
    wb.SheetNames.find((n) => n === SECUTIX_SHEET_NAME) || wb.SheetNames[0];
  const sheet = sheetName ? wb.Sheets[sheetName] : undefined;
  if (!sheet) return [];
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    raw: false,
    defval: '',
  });
  return matrixToSecutixRows(matrix);
}

/** Read a Secutix export file (browser only — uses File.arrayBuffer). */
export async function readSecutixFile(file: File): Promise<SecutixRow[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  return workbookToSecutixRows(wb);
}
