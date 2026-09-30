// spaces.ts — Space entity: creation, validation, rename/delete rules,
// location migration and Secutix auto-create (pure logic, no browser APIs).
//
// Spec: test/features/spaces/spaces.feature
// - A space is { id, name, color (hex) }; names are unique (trimmed,
//   case-insensitive).
// - Deletion is REFUSED while any offer or slot references the space
//   (by name) — no automatic re-attribution.
// - Legacy free-text locations are migrated one-space-per-distinct-value
//   at load; migrated colors cycle a default palette, NEVER white
//   (white is reserved for Secutix auto-created spaces).
// - A Secutix ESPACE value with no matching space auto-creates a WHITE
//   space.

import { generateId } from './models';
import type { Offer, Slot, Space } from './types';

/** Color reserved for Secutix auto-created spaces (unmapped ESPACE). */
export const SECUTIX_SPACE_COLOR = '#FFFFFF';

const NAME_REQUIRED_ERROR = "Le nom de l'espace est obligatoire";
const NAME_DUPLICATE_ERROR = 'Un espace porte déjà ce nom';
const SPACE_IN_USE_ERROR = "Cet espace est utilisé par une offre ou un créneau";
const COLOR_FORMAT_ERROR = 'La couleur doit être au format hexadécimal (#RRGGBB)';

/** Trimmed, case-insensitive comparison key for space names. */
function nameKey(name: string): string {
  return name.trim().toLowerCase();
}

/** Hex color validation: #RGB or #RRGGBB. */
export function isValidHexColor(color: string): boolean {
  return /^#[0-9a-fA-F]{3}$|^#[0-9a-fA-F]{6}$/.test(color);
}

// ---------------------------------------------------------------------------
// Creation & lookup
// ---------------------------------------------------------------------------

/** Create a space with a fresh id; the name is trimmed. */
export function createSpace(name: string, color: string): Space {
  return { id: generateId('spc'), name: name.trim(), color };
}

/** Find a space by name (trimmed, case-insensitive match). */
export function spaceByName(spaces: Space[], name: string): Space | undefined {
  const key = nameKey(name);
  if (!key) return undefined;
  return spaces.find((s) => nameKey(s.name) === key);
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export interface SpaceValidationInput {
  name: string;
  color: string;
  /** Exclude a space from the duplicate check (rename self). */
  excludeId?: string;
}

export type SpaceValidation =
  | { ok: true; errors: [] }
  | { ok: false; errors: string[] };

/**
 * Validate a space's name and color against the existing list:
 * - name required (non-empty after trim)
 * - name unique (trimmed, case-insensitive), except the excluded space
 * - color must be a hex code (#RGB or #RRGGBB)
 * French messages per test/features/spaces/spaces.feature.
 */
export function validateSpace(
  spaces: Space[],
  input: SpaceValidationInput
): SpaceValidation {
  const errors: string[] = [];

  if (!input.name.trim()) {
    errors.push(NAME_REQUIRED_ERROR);
  } else {
    const key = nameKey(input.name);
    const duplicate = spaces.some(
      (s) => nameKey(s.name) === key && s.id !== input.excludeId
    );
    if (duplicate) errors.push(NAME_DUPLICATE_ERROR);
  }

  if (!isValidHexColor(input.color)) {
    errors.push(COLOR_FORMAT_ERROR);
  }

  return errors.length ? { ok: false, errors } : { ok: true, errors: [] };
}

// ---------------------------------------------------------------------------
// Rename
// ---------------------------------------------------------------------------

export type RenameSpaceResult =
  | {
      ok: true;
      spaces: Space[];
      offers: Offer[];
      slots: Slot[];
    }
  | { ok: false; errors: string[] };

/**
 * Rename a space and make every offer/slot referencing the old name
 * (by its location field, case-insensitive) follow the rename. Pure:
 * inputs are not mutated. Validation errors block the rename.
 */
export function renameSpace(
  spaces: Space[],
  offers: Offer[],
  slots: Slot[],
  spaceId: string,
  newName: string
): RenameSpaceResult {
  const space = spaces.find((s) => s.id === spaceId);
  if (!space) {
    return { ok: false, errors: ['Espace introuvable'] };
  }
  const validation = validateSpace(spaces, {
    name: newName,
    color: space.color,
    excludeId: spaceId,
  });
  if (!validation.ok) {
    return { ok: false, errors: validation.errors };
  }

  const oldKey = nameKey(space.name);
  const target = newName.trim();

  const follows = <T extends { location: string }>(item: T): T =>
    nameKey(item.location) === oldKey ? { ...item, location: target } : item;

  return {
    ok: true,
    spaces: spaces.map((s) =>
      s.id === spaceId ? { ...s, name: target } : s
    ),
    offers: offers.map(follows),
    slots: slots.map(follows),
  };
}

// ---------------------------------------------------------------------------
// Deletion
// ---------------------------------------------------------------------------

export type DeleteSpaceCheck =
  | { ok: true }
  | { ok: false; reason: string };

/**
 * Whether a space can be deleted: REFUSED while any offer.location or
 * slot.location references the space name (trimmed, case-insensitive).
 * No automatic re-attribution (spec decision 3, 2026-09-29).
 */
export function canDeleteSpace(
  spaces: Space[],
  offers: Offer[],
  slots: Slot[],
  spaceId: string
): DeleteSpaceCheck {
  const space = spaces.find((s) => s.id === spaceId);
  if (!space) {
    return { ok: false, reason: 'Espace introuvable' };
  }
  const key = nameKey(space.name);
  const referenced =
    offers.some((o) => o.location && nameKey(o.location) === key) ||
    slots.some((s) => s.location && nameKey(s.location) === key);
  return referenced
    ? { ok: false, reason: SPACE_IN_USE_ERROR }
    : { ok: true };
}

// ---------------------------------------------------------------------------
// Default palette (migration colors — never white)
// ---------------------------------------------------------------------------

/**
 * Pleasant default colors for migrated spaces, cycling by index.
 * #FFFFFF is NOT in the palette: white marks Secutix auto-created spaces.
 */
const DEFAULT_SPACE_PALETTE = [
  '#4A90D9', // blue
  '#7B1FA2', // purple
  '#2E7D32', // green
  '#E65100', // deep orange
  '#C0392B', // red
  '#00838F', // teal
  '#8D6E63', // brown
  '#F9A825', // yellow
  '#4527A0', // deep purple
  '#0277BD', // light blue
  '#558B2F', // light green
  '#AD1457', // pink
  '#37474F', // blue grey
  '#00695C', // dark teal
  '#6D4C41', // coffee
  '#283593', // indigo
  '#EF6C00', // orange
  '#1B5E20', // dark green
  '#B71C1C', // dark red
  '#4E342E', // espresso
  '#01579B', // dark blue
  '#33691E', // olive
  '#6A1B9A', // violet
  '#5D4037', // dark brown
];

export function defaultSpacePalette(index: number): string {
  return DEFAULT_SPACE_PALETTE[index % DEFAULT_SPACE_PALETTE.length];
}

// ---------------------------------------------------------------------------
// Location migration (legacy free-text locations -> spaces)
// ---------------------------------------------------------------------------

export interface LocationMigration {
  spaces: Space[];
  offers: Offer[];
  slots: Slot[];
}

/**
 * Turn the distinct non-empty location values across offers and slots
 * into spaces, colored via the default palette. Locations matching an
 * EXISTING space (case-insensitive) reuse it instead of creating a
 * duplicate — re-running on migrated data changes nothing (idempotent).
 * Empty locations are untouched. Pure: inputs are not mutated.
 */
export function migrateLocationsToSpaces(
  offers: Offer[],
  slots: Slot[],
  existingSpaces: Space[] = []
): LocationMigration {
  const spaces: Space[] = [...existingSpaces];
  const seen = new Set(spaces.map((s) => nameKey(s.name)));

  const collect = (location: string | undefined): void => {
    const key = nameKey(location || '');
    if (!key || seen.has(key)) return;
    seen.add(key);
    spaces.push(createSpace((location || '').trim(), defaultSpacePalette(spaces.length - existingSpaces.length)));
  };
  offers.forEach((o) => collect(o.location));
  slots.forEach((s) => collect(s.location));

  return { spaces, offers, slots };
}

// ---------------------------------------------------------------------------
// Secutix auto-create
// ---------------------------------------------------------------------------

export interface SecutixSpaceResult {
  spaces: Space[];
  space: Space;
}

/**
 * Resolve a Secutix ESPACE value to a space: an existing space with the
 * same name (trimmed, case-insensitive) is reused as-is; an unknown
 * value AUTO-CREATES a WHITE space (#FFFFFF = auto-created, unmapped).
 */
export function autoCreateSpaceForSecutix(
  spaces: Space[],
  espaceValue: string
): SecutixSpaceResult {
  const existing = spaceByName(spaces, espaceValue);
  if (existing) {
    return { spaces, space: existing };
  }
  const space = createSpace(espaceValue.trim(), SECUTIX_SPACE_COLOR);
  return { spaces: [...spaces, space], space };
}

// ---------------------------------------------------------------------------
// Offer short label
// ---------------------------------------------------------------------------

/**
 * The display label of an offer: its optional short label ("label
 * court") when non-empty, else the full offer name (spec short-label.feature).
 */
export function offerShortLabel(offer: Offer): string {
  return offer.shortLabel?.trim() || offer.name;
}
