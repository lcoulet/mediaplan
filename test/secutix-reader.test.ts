// test/secutix-reader.test.ts — Secutix workbook reading (SheetJS, Node)
import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { workbookToSecutixRows } from '../src/infrastructure/secutix-reader';

// Real export layout: row 1 empty, headers on row 2 with a typographic
// apostrophe (U+2019) in some headers. Invented booking data.
const HEADERS = [
  '',
  'DATE HEURE DU PRODUIT',
  'PRODUIT',
  'NOM DU GROUPE',
  'GUIDE',
  'THÈME',
  'N° DOSSIER D\u2019ACHAT',
  'DATE DE PRODUIT',
  'DURÉE',
  'SITE',
  'ESPACE',
  'LANGUE DE VISITE',
  'TYPE OPÉRATION',
  'NATURE DU GROUPE',
  'NB TOTAL DE PERSONNES PAR GUIDE',
  'CONTACT DU DOSSIER D\u2019ACHAT',
  'TÉLÉPHONE DU CONTACT DU DOSSIER',
  'EMAIL DU CONTACT DU DOSSIER',
  'REMARQUE',
  'ETAT DE LA VISITE',
  'HEURE D\u2019ARRIVÉE PRÉVUE',
  '',
];

const DATA_ROW = [
  '',
  '22.09.2026 09:45',
  'MHN GRP - Visite Guidée Découverte',
  'ECOLE LES TOURNESOLS - CE1',
  '',
  'G/ Visite découverte',
  '3100001',
  '22.09.2026',
  '1:30',
  'DCSTI_MHN',
  'RZA_MHN_EXPOSITION PERMANENTE',
  '',
  'Vente',
  'SCOLAIRES C2',
  '28',
  '(50100421) MERLANDE, Céleste',
  '06 71 24 85 19',
  'celeste.merlande@exemple.fr',
  'Prévoir des chaises',
  'En exploitation',
  '09:45',
  '',
];

function buildWorkbook(rows: unknown[][], sheetName = 'visitPlanning'): XLSX.WorkBook {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  return wb;
}

describe('workbookToSecutixRows', () => {
  it('maps the header row (row 2) and the data rows to SecutixRow fields', () => {
    const wb = buildWorkbook([
      HEADERS.map(() => ''),
      HEADERS,
      DATA_ROW,
    ]);
    const rows = workbookToSecutixRows(wb);
    expect(rows.length).toBe(1);
    const r = rows[0];
    expect(r.productDateTime).toBe('22.09.2026 09:45');
    expect(r.product).toBe('MHN GRP - Visite Guidée Découverte');
    expect(r.groupName).toBe('ECOLE LES TOURNESOLS - CE1');
    expect(r.theme).toBe('G/ Visite découverte');
    expect(r.contractNumber).toBe('3100001');
    expect(r.duration).toBe('1:30');
    expect(r.location).toBe('RZA_MHN_EXPOSITION PERMANENTE');
    expect(r.groupNature).toBe('SCOLAIRES C2');
    expect(r.participantCount).toBe('28');
    expect(r.contactName).toBe('(50100421) MERLANDE, Céleste');
    expect(r.contactPhone).toBe('06 71 24 85 19');
    expect(r.contactEmail).toBe('celeste.merlande@exemple.fr');
    expect(r.remark).toBe('Prévoir des chaises');
    expect(r.visitState).toBe('En exploitation');
    expect(r.plannedArrivalTime).toBe('09:45');
  });

  it('converts numeric cells to strings (contract numbers, headcounts)', () => {
    const wb = buildWorkbook([
      HEADERS.map(() => ''),
      HEADERS,
      DATA_ROW.map((c, i) => (i === 6 ? 3100001 : c)), // numeric dossier
    ]);
    const rows = workbookToSecutixRows(wb);
    expect(rows[0].contractNumber).toBe('3100001');
  });

  it('reads every data row, including Total and Droit d\'accès rows (filtering is the domain job)', () => {
    const wb = buildWorkbook([
      HEADERS.map(() => ''),
      HEADERS,
      DATA_ROW,
      DATA_ROW.map((c, i) =>
        i === 5 ? "G/ Droit d'accès" : i === 3 ? 'ECOLE LES CYPRES - CM2' : c
      ),
      DATA_ROW.map((_, i) => (i === 1 ? ' Total' : '')),
    ]);
    const rows = workbookToSecutixRows(wb);
    expect(rows.length).toBe(3);
  });

  it('returns an empty array when no header row is found', () => {
    const wb = buildWorkbook([['', ''], ['problème de format']]);
    expect(workbookToSecutixRows(wb)).toEqual([]);
  });

  it('picks the visitPlanning sheet by name over other sheets', () => {
    const wb = buildWorkbook([['aucun en-tête ici']], 'Annexe');
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([HEADERS.map(() => ''), HEADERS, DATA_ROW]),
      'visitPlanning'
    );
    const rows = workbookToSecutixRows(wb);
    expect(rows.length).toBe(1);
    expect(rows[0].theme).toBe('G/ Visite découverte');
  });
});
