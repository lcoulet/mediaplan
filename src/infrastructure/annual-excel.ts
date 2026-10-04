// annual-excel.ts — Annual view slice 5: SheetJS infrastructure. Turns the
// pure export model (src/domain/annual-export.ts) into a styled .xlsx file,
// generated ENTIRELY client-side (decision 2026-10-04: SheetJS, no network).
//
// SheetJS COMMUNITY edition (xlsx@0.18.5) cannot WRITE cell styles: its
// writer emits a single default font/fill styles.xml and ignores cell.s.
// This module therefore works in two passes:
//   1. SheetJS writes the workbook (values + merges + column widths) —
//      unstyled but structurally complete.
//   2. A post-processing pass rewrites the xlsx zip: a generated styles
//      part (one solid fill per palette state) and the per-cell style
//      indexes injected into the sheet XML.
// The result is a fully valid .xlsx with fills, readable by Excel, LibreOffice
// and openpyxl.

import * as XLSX from 'xlsx';
import {
  ANNUAL_PALETTE,
  type AnnualPaletteState,
} from '../domain/annual-view';
import type { AnnualExportModel } from '../domain/annual-export';

// ---- Palette → styles.xml plumbing ----------------------------------------

/** 'FF' + hex without '#': ARGB of a palette fill. */
function argb(hex: string): string {
  return `FF${hex.replace('#', '').toUpperCase()}`;
}

/**
 * Build the full styles.xml for the export: the default font, one solid
 * fill per palette state (+ the two mandatory default fills), and one xf
 * per (fill) combination. Returns the XML and the map state -> xf index.
 */
function buildStylesXml(
  palette: AnnualPaletteState[]
): { xml: string; styleIndexByState: Record<string, number> } {
  // Mandatory default fills (Excel requires indices 0 and 1)
  const fills: string[] = [
    '<fill><patternFill patternType="none"/></fill>',
    '<fill><patternFill patternType="gray125"/></fill>',
  ];
  const styleIndexByState: Record<string, number> = {};
  const xfs: string[] = [];

  // xf 0 = default (no fill)
  xfs.push('<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>');

  // One fill + one xf per palette state, deduplicated by color
  const fillIdByColor = new Map<string, number>();
  for (const state of palette) {
    const color = argb(state.fill);
    let fillId = fillIdByColor.get(color);
    if (fillId === undefined) {
      fills.push(
        `<fill><patternFill patternType="solid"><fgColor rgb="${color}"/><bgColor rgb="${color}"/></patternFill></fill>`
      );
      fillId = fills.length - 1;
      fillIdByColor.set(color, fillId);
    }
    const xfId = xfs.length;
    xfs.push(
      `<xf numFmtId="49" fontId="0" fillId="${fillId}" borderId="0" xfId="0" applyNumberFormat="1" applyFill="1"/>`
    );
    styleIndexByState[state.state] = xfId;
  }

  const xml =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
    '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
    'xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" ' +
    'mc:Ignorable="x14ac" xmlns:x14ac="http://schemas.microsoft.com/office/spreadsheetml/2009/9/ac">' +
    '<fonts count="1"><font><sz val="12"/><color theme="1"/><name val="Calibri"/><family val="2"/><scheme val="minor"/></font></fonts>' +
    `<fills count="${fills.length}">${fills.join('')}</fills>` +
    '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
    `<cellXfs count="${xfs.length}">${xfs.join('')}</cellXfs>` +
    '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
    '<dxfs count="0"/>' +
    '<tableStyles count="0" defaultTableStyle="TableStyleMedium9" defaultPivotStyle="PivotStyleLight16"/>' +
    '</styleSheet>';
  return { xml, styleIndexByState };
}

// ---- Sheet XML style injection ----------------------------------------------

/** Column letters of a 0-based column index (0 -> A, 25 -> Z, 26 -> AA). */
function colName(c: number): string {
  let s = '';
  let n = c;
  while (n >= 0) {
    s = String.fromCharCode((n % 26) + 65) + s;
    n = Math.floor(n / 26) - 1;
  }
  return s;
}

/**
 * Inject s="<xf>" attributes into the cells of the written sheet XML.
 * `styles` maps "A1"-style refs to a style index. The written cells look
 * like <c r="C162" t="str"><v>…</v></c> (or <c r="C162" s="1"/>); the
 * attribute is inserted right after the ref.
 */
function injectCellStyles(sheetXml: string, styles: Map<string, number>): string {
  return sheetXml.replace(/<c r="([A-Z]+\d+)"/g, (match, ref: string) => {
    const s = styles.get(ref);
    return s === undefined ? match : `<c r="${ref}" s="${s}"`;
  });
}

// ---- Zip post-processing ------------------------------------------------

/**
 * Minimal zip READER for the STORED (uncompressed) archives the SheetJS
 * community edition writes: parses the end-of-central-directory record
 * and every local file header, returning each entry's name, data and
 * offsets. Throws on any entry using the DEFLATE method (not produced by
 * SheetJS CE with default options).
 */
interface ZipEntry {
  name: string;
  data: Uint8Array;
}

function readStoredZip(bytes: Uint8Array): ZipEntry[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  // Find the EOCD record (search backwards for the signature)
  let eocd = -1;
  for (let i = bytes.length - 22; i >= 0; i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('annual-excel: EOCD record not found (not a zip?)');
  const count = view.getUint16(eocd + 10, true);
  let offset = view.getUint32(eocd + 16, true);
  const entries: ZipEntry[] = [];
  for (let i = 0; i < count; i++) {
    if (view.getUint32(offset, true) !== 0x02014b50) {
      throw new Error(`annual-excel: central directory entry ${i} signature mismatch`);
    }
    const method = view.getUint16(offset + 10, true);
    const nameLen = view.getUint16(offset + 28, true);
    const extraLen = view.getUint16(offset + 30, true);
    const commentLen = view.getUint16(offset + 32, true);
    const localOffset = view.getUint32(offset + 42, true);
    const name = new TextDecoder().decode(bytes.subarray(offset + 46, offset + 46 + nameLen));
    // Local header: name len may differ from the central one
    const lNameLen = view.getUint16(localOffset + 26, true);
    const lExtraLen = view.getUint16(localOffset + 28, true);
    const dataStart = localOffset + 30 + lNameLen + lExtraLen;
    const lMethod = view.getUint16(localOffset + 8, true);
    const lCompressed = view.getUint32(localOffset + 18, true);
    if (method !== 0 || lMethod !== 0) {
      throw new Error(`annual-excel: zip entry "${name}" is compressed — only STORED archives are supported`);
    }
    entries.push({ name, data: bytes.subarray(dataStart, dataStart + lCompressed) });
    offset += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

/** CRC-32 (IEEE 802.3, right-shifted polynomial). */
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc = CRC_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// Exposed for tests only (round-trip re-zip control)
export const __testHooks = { readStoredZip, writeStoredZip, crc32 };

/** Write a STORED zip from entries (name + UTF-8 text or raw bytes). */
function writeStoredZip(files: { name: string; data: Uint8Array }[]): Uint8Array {
  const encoder = new TextEncoder();
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const f of files) {
    const nameBytes = encoder.encode(f.name);
    const crc = crc32(f.data);
    // Local file header
    const local = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true); // version needed
    lv.setUint16(6, 0x0800, true); // UTF-8 flag
    lv.setUint16(8, 0, true); // STORED
    lv.setUint32(14, crc, true);
    lv.setUint32(18, f.data.length, true); // compressed
    lv.setUint32(22, f.data.length, true); // uncompressed
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true); // extra len
    local.set(nameBytes, 30);
    parts.push(local, f.data);
    // Central directory entry
    const centralEntry = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(centralEntry.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true); // version made by
    cv.setUint16(6, 20, true); // version needed
    cv.setUint16(8, 0x0800, true); // UTF-8 flag
    cv.setUint16(10, 0, true); // STORED
    cv.setUint32(16, crc, true);
    cv.setUint32(20, f.data.length, true);
    cv.setUint32(24, f.data.length, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint16(30, 0, true); // extra
    cv.setUint16(32, 0, true); // comment
    cv.setUint16(34, 0, true); // disk number
    cv.setUint16(36, 0, true); // internal attrs
    cv.setUint32(38, 0, true); // external attrs
    cv.setUint32(42, offset, true); // local header offset
    centralEntry.set(nameBytes, 46);
    central.push(centralEntry);
    offset += local.length + f.data.length;
  }
  const centralBytes = central.reduce((acc, p) => {
    const next = new Uint8Array(acc.length + p.length);
    next.set(acc);
    next.set(p, acc.length);
    return next;
  }, new Uint8Array(0));
  // EOCD
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, centralBytes.length, true);
  ev.setUint32(16, offset, true);
  const total = [...parts, centralBytes, eocd];
  const size = total.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(size);
  let at = 0;
  for (const p of total) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

// ---- The writer ------------------------------------------------------------

/**
 * Write the annual export model to .xlsx BYTES (Uint8Array), with the
 * palette fills of the app's legend (decision 2026-10-03: colors of the
 * legend). Pass 1: SheetJS writes values/merges/widths; pass 2 rewrites
 * the styles part and injects the per-cell style indexes.
 */
export function writeAnnualExcel(model: AnnualExportModel): Uint8Array {
  // ---- Pass 1: plain SheetJS workbook ------------------------------------
  const aoa: (string | number)[][] = [];
  aoa.push(model.headerRows[0].map((c) => c.value));
  aoa.push(model.headerRows[1].map((c) => c.value));
  for (const row of model.dayRows) {
    aoa.push([row.weekLabel, row.dateLabel, ...row.cells.map((c) => c.value)]);
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa.map((row) =>
    // Numeric cells (Saturday counters) export as NUMBERS, not text
    row.map((v) => (typeof v === 'string' && /^\d+$/.test(v) ? Number(v) : v))
  ));
  ws['!merges'] = model.merges.map((m) => ({
    s: { r: m.from.r, c: m.from.c },
    e: { r: m.to.r, c: m.to.c },
  }));
  // Column widths: narrow week + date columns, narrow half-day cells
  ws['!cols'] = [
    { wch: 6 }, // Sem.
    { wch: 14 }, // Date
    ...model.mediators.flatMap(() => [{ wch: 10 }, { wch: 10 }]),
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, `Tableau ${model.year}`);
  const bytes = XLSX.write(wb, {
    bookType: 'xlsx',
    type: 'array',
  }) as ArrayBuffer;

  // ---- Pass 2: styles -----------------------------------------------------
  const { xml: stylesXml, styleIndexByState } = buildStylesXml(ANNUAL_PALETTE);

  // Map every styled cell of the model to its A1 ref + style index
  const styles = new Map<string, number>();
  const stateIndex = (state: string | null): number | undefined =>
    state === null ? undefined : styleIndexByState[state];

  model.dayRows.forEach((row, dayIdx) => {
    const r = dayIdx + 3; // rows 1-2 are the headers
    // Date cell fill (férié / museum-closed)
    const dateS = stateIndex(row.dateCell.state);
    if (dateS !== undefined) styles.set(`B${r}`, dateS);
    row.cells.forEach((cell, i) => {
      const s = stateIndex(cell.state);
      if (s !== undefined) styles.set(`${colName(2 + i)}${r}`, s);
    });
  });

  // Rebuild the zip: same entries, with the patched styles part and the
  // style-injected sheet XML
  const entries = readStoredZip(new Uint8Array(bytes));
  const encoder = new TextEncoder();
  const files: { name: string; data: Uint8Array }[] = entries.map((e) => {
    if (e.name === 'xl/styles.xml') {
      return { name: e.name, data: encoder.encode(stylesXml) };
    }
    if (e.name === 'xl/worksheets/sheet1.xml') {
      const xml = new TextDecoder().decode(e.data);
      return { name: e.name, data: encoder.encode(injectCellStyles(xml, styles)) };
    }
    return { name: e.name, data: e.data };
  });
  return writeStoredZip(files);
}
