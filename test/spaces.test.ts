// test/spaces.test.ts — Space entity: validation, rename/delete rules,
// location migration, Secutix auto-create, offer short label fallback.
// Specs: test/features/spaces/spaces.feature, short-label.feature
import { describe, it, expect } from 'vitest';
import {
  createSpace,
  validateSpace,
  spaceByName,
  canDeleteSpace,
  renameSpace,
  defaultSpacePalette,
  migrateLocationsToSpaces,
  autoCreateSpaceForSecutix,
  offerShortLabel,
} from '../src/domain/spaces';
import { createOffer, createSlot } from '../src/domain/models';
import { applySecutixImport, normalizeSecutixRows, reconcileOffers, buildSecutixImportPlan } from '../src/domain/secutix-import';
import type { AppData, Offer, Slot } from '../src/domain/types';

function offerAt(location: string): Offer {
  return createOffer({ id: 'off_1', name: 'Visite guidée', location });
}

function slotAt(location: string): Slot {
  return createSlot({ id: 'slot_1', offerId: 'off_1', location });
}

describe('createSpace', () => {
  it('creates a space with an id, the given name and color', () => {
    const space = createSpace('Salle Bronze', '#4A90D9');
    expect(space.name).toBe('Salle Bronze');
    expect(space.color).toBe('#4A90D9');
    expect(space.id).toBeTruthy();
  });

  it('trims the name', () => {
    expect(createSpace('  Salle Bronze  ', '#4A90D9').name).toBe('Salle Bronze');
  });

  it('gives distinct ids to two spaces', () => {
    expect(createSpace('A', '#111111').id).not.toBe(createSpace('B', '#222222').id);
  });
});

describe('validateSpace', () => {
  const existing = [createSpace('Salle Bronze', '#4A90D9')];

  it('accepts a valid name and color', () => {
    const result = validateSpace([], { name: 'Salle Bronze', color: '#4A90D9' });
    expect(result.ok).toBe(true);
    expect(result.ok && result.errors).toEqual([]);
  });

  it('rejects an empty name with the spec message', () => {
    const result = validateSpace([], { name: '', color: '#4A90D9' });
    expect(result.ok).toBe(false);
    expect(!result.ok && result.errors).toContain("Le nom de l'espace est obligatoire");
  });

  it('rejects a whitespace-only name', () => {
    const result = validateSpace([], { name: '   ', color: '#4A90D9' });
    expect(result.ok).toBe(false);
    expect(!result.ok && result.errors).toContain("Le nom de l'espace est obligatoire");
  });

  it('rejects an exact duplicate with the spec message', () => {
    const result = validateSpace(existing, { name: 'Salle Bronze', color: '#111111' });
    expect(result.ok).toBe(false);
    expect(!result.ok && result.errors).toContain('Un espace porte déjà ce nom');
  });

  it('rejects a case-insensitive duplicate', () => {
    const jardin = [createSpace('Jardin', '#2E7D32')];
    const result = validateSpace(jardin, { name: 'jardin', color: '#111111' });
    expect(result.ok).toBe(false);
    expect(!result.ok && result.errors).toContain('Un espace porte déjà ce nom');
  });

  it('rejects a duplicate ignoring surrounding whitespace', () => {
    const result = validateSpace(existing, { name: '  salle bronze ', color: '#111111' });
    expect(result.ok).toBe(false);
    expect(!result.ok && result.errors).toContain('Un espace porte déjà ce nom');
  });

  it('accepts the space own name when excludeId is set (rename self)', () => {
    const result = validateSpace(existing, { name: 'Salle Bronze', color: '#4A90D9', excludeId: existing[0].id });
    expect(result.ok).toBe(true);
  });

  it('still rejects another space name when excludeId is set', () => {
    const two = [...existing, createSpace('Auditorium', '#7B1FA2')];
    const result = validateSpace(two, { name: 'Auditorium', color: '#4A90D9', excludeId: existing[0].id });
    expect(result.ok).toBe(false);
    expect(!result.ok && result.errors).toContain('Un espace porte déjà ce nom');
  });

  it('rejects a non-hex color', () => {
    const result = validateSpace([], { name: 'Salle Bronze', color: 'blue' });
    expect(result.ok).toBe(false);
    expect(!result.ok && result.errors.some((e) => e.includes('hexadécimal'))).toBe(true);
  });

  it('rejects a malformed hex code', () => {
    expect(validateSpace([], { name: 'S', color: '#12345' }).ok).toBe(false);
    expect(validateSpace([], { name: 'S', color: '#GGGGGG' }).ok).toBe(false);
    expect(validateSpace([], { name: 'S', color: '4A90D9' }).ok).toBe(false);
    expect(validateSpace([], { name: 'S', color: '' }).ok).toBe(false);
  });

  it('accepts 3- and 6-digit hex codes', () => {
    expect(validateSpace([], { name: 'S', color: '#4A90D9' }).ok).toBe(true);
    expect(validateSpace([], { name: 'S', color: '#f90' }).ok).toBe(true);
    expect(validateSpace([], { name: 'S', color: '#ABCDEF' }).ok).toBe(true);
  });
});

describe('spaceByName', () => {
  const spaces = [createSpace('Salle Bronze', '#4A90D9')];

  it('finds a space by exact name', () => {
    expect(spaceByName(spaces, 'Salle Bronze')?.id).toBe(spaces[0].id);
  });

  it('matches case-insensitively with trimmed input', () => {
    expect(spaceByName(spaces, '  salle BRONZE ')?.id).toBe(spaces[0].id);
  });

  it('returns undefined when no space matches', () => {
    expect(spaceByName(spaces, 'Crypte')).toBeUndefined();
    expect(spaceByName(spaces, '')).toBeUndefined();
  });
});

describe('canDeleteSpace', () => {
  it('allows deleting an unreferenced space', () => {
    const spaces = [createSpace('Auditorium', '#7B1FA2')];
    const result = canDeleteSpace(spaces, [offerAt('Salle Bronze')], [slotAt('Salle Bronze')], spaces[0].id);
    expect(result).toEqual({ ok: true });
  });

  it('refuses deletion while an offer references the space name', () => {
    const spaces = [createSpace('Salle Bronze', '#4A90D9')];
    const result = canDeleteSpace(spaces, [offerAt('Salle Bronze')], [], spaces[0].id);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.reason).toBe("Cet espace est utilisé par une offre ou un créneau");
  });

  it('refuses deletion while a slot references the space name', () => {
    const spaces = [createSpace('Salle Bronze', '#4A90D9')];
    const result = canDeleteSpace(spaces, [], [slotAt('Salle Bronze')], spaces[0].id);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.reason).toBe("Cet espace est utilisé par une offre ou un créneau");
  });

  it('matches references case-insensitively', () => {
    const spaces = [createSpace('Salle Bronze', '#4A90D9')];
    const result = canDeleteSpace(spaces, [offerAt('salle bronze')], [], spaces[0].id);
    expect(result.ok).toBe(false);
  });
});

describe('renameSpace', () => {
  const setup = () => {
    const space = createSpace('Salle Bronze', '#4A90D9');
    const other = createSpace('Auditorium', '#7B1FA2');
    const offers = [offerAt('Salle Bronze'), offerAt('Salle Bronze'), offerAt('Auditorium'), offerAt('')];
    const slots = [slotAt('Salle Bronze'), slotAt('salle bronze'), slotAt('Crypte')];
    return { space, other, spaces: [space, other], offers, slots };
  };

  it('renames the space and keeps its color', () => {
    const { space, spaces, offers, slots } = setup();
    const result = renameSpace(spaces, offers, slots, space.id, 'Salle Antiquités');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.spaces.find((s) => s.id === space.id)).toMatchObject({ name: 'Salle Antiquités', color: '#4A90D9' });
    expect(result.spaces.find((s) => s.id === space.id)?.name).toBe('Salle Antiquités');
    expect(result.spaces.map((s) => s.name)).not.toContain('Salle Bronze');
  });

  it('offers and slots referencing the old name follow the rename', () => {
    const { space, spaces, offers, slots } = setup();
    const result = renameSpace(spaces, offers, slots, space.id, 'Salle Antiquités');
    if (!result.ok) throw new Error('expected ok');
    expect(result.offers.filter((o) => o.location === 'Salle Antiquités')).toHaveLength(2);
    expect(result.offers.find((o) => o.location === 'Auditorium')).toBeTruthy();
    expect(result.offers.find((o) => o.location === '')).toBeTruthy();
    expect(result.slots.filter((s) => s.location === 'Salle Antiquités')).toHaveLength(2); // case-insensitive follow
    expect(result.slots.find((s) => s.location === 'Crypte')).toBeTruthy();
  });

  it('refuses renaming to an existing name with the spec message', () => {
    const { space, spaces, offers, slots } = setup();
    const result = renameSpace(spaces, offers, slots, space.id, 'Auditorium');
    expect(result.ok).toBe(false);
    expect(!result.ok && result.errors).toContain('Un espace porte déjà ce nom');
  });

  it('refuses renaming to an empty name', () => {
    const { space, spaces, offers, slots } = setup();
    const result = renameSpace(spaces, offers, slots, space.id, '  ');
    expect(result.ok).toBe(false);
    expect(!result.ok && result.errors).toContain("Le nom de l'espace est obligatoire");
  });

  it('does not mutate the input', () => {
    const { space, spaces, offers, slots } = setup();
    const before = JSON.stringify({ spaces, offers, slots });
    renameSpace(spaces, offers, slots, space.id, 'Salle Antiquités');
    expect(JSON.stringify({ spaces, offers, slots })).toBe(before);
  });
});

describe('defaultSpacePalette', () => {
  it('never returns white', () => {
    for (let i = 0; i < 40; i++) {
      expect(defaultSpacePalette(i).toUpperCase()).not.toBe('#FFFFFF');
    }
  });

  it('returns distinct colors for consecutive indices', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 24; i++) {
      const color = defaultSpacePalette(i);
      expect(seen.has(color)).toBe(false);
      seen.add(color);
    }
  });

  it('cycles: index N (palette length) equals index 0', () => {
    const first = defaultSpacePalette(0);
    expect(typeof first).toBe('string');
    expect(defaultSpacePalette(24 + 24)).toBe(defaultSpacePalette(24));
  });
});

describe('migrateLocationsToSpaces', () => {
  it('creates one space per distinct non-empty location across offers and slots', () => {
    const offers = [offerAt('Salle Bronze'), offerAt('Exposition permanente'), offerAt('')];
    const slots = [slotAt('Auditorium'), slotAt('')];
    const { spaces } = migrateLocationsToSpaces(offers, slots);
    const names = spaces.map((s) => s.name).sort();
    expect(names).toEqual(['Auditorium', 'Exposition permanente', 'Salle Bronze']);
  });

  it('creates a single space for a location shared by several offers', () => {
    const offers = [offerAt('Salle Bronze'), offerAt('Salle Bronze'), offerAt('Salle Bronze')];
    const { spaces } = migrateLocationsToSpaces(offers, []);
    expect(spaces).toHaveLength(1);
    expect(spaces[0].name).toBe('Salle Bronze');
  });

  it('leaves empty locations untouched and creates no space for them', () => {
    const offers = [offerAt(''), offerAt('Salle Bronze')];
    const slots = [slotAt('')];
    const { spaces, offers: outOffers, slots: outSlots } = migrateLocationsToSpaces(offers, slots);
    expect(spaces.map((s) => s.name)).toEqual(['Salle Bronze']);
    expect(outOffers.find((o) => o.location === '')).toBeTruthy();
    expect(outSlots.find((s) => s.location === '')).toBeTruthy();
  });

  it('colors migrated spaces from the default palette, never white', () => {
    const offers = [offerAt('Salle Bronze'), offerAt('Auditorium')];
    const { spaces } = migrateLocationsToSpaces(offers, []);
    expect(spaces[0].color).toBe(defaultSpacePalette(0));
    expect(spaces[1].color).toBe(defaultSpacePalette(1));
    expect(spaces.map((s) => s.color.toUpperCase())).not.toContain('#FFFFFF');
  });

  it('reuses existing spaces instead of duplicating them (idempotent)', () => {
    const offers = [offerAt('Salle Bronze'), offerAt('Auditorium')];
    const first = migrateLocationsToSpaces(offers, []);
    // Second run on the migrated data: same spaces back, offers/slots unchanged
    const second = migrateLocationsToSpaces(offers, [], first.spaces);
    expect(second.spaces).toEqual(first.spaces);
    expect(second.offers).toBe(offers);
    expect(second.slots).toEqual([]);
  });

  it('returns no spaces when no location exists anywhere', () => {
    const offers = [offerAt(''), offerAt('')];
    const slots = [slotAt('')];
    expect(migrateLocationsToSpaces(offers, slots).spaces).toEqual([]);
  });

  it('does not mutate the input', () => {
    const offers = [offerAt('Salle Bronze')];
    const slots = [slotAt('Auditorium')];
    const before = JSON.stringify({ offers, slots });
    migrateLocationsToSpaces(offers, slots);
    expect(JSON.stringify({ offers, slots })).toBe(before);
  });
});

describe('autoCreateSpaceForSecutix', () => {
  it('finds an existing space by name (case-insensitive, trimmed) without creating', () => {
    const existing = [createSpace('Salle Bronze', '#4A90D9')];
    const { spaces, space } = autoCreateSpaceForSecutix(existing, ' salle bronze ');
    expect(space.id).toBe(existing[0].id);
    expect(space.color).toBe('#4A90D9'); // keeps its color
    expect(spaces).toBe(existing); // no new list content
    expect(spaces).toHaveLength(1);
  });

  it('creates an unknown ESPACE value as a white space', () => {
    const { spaces, space } = autoCreateSpaceForSecutix([], 'Crypte');
    expect(space.name).toBe('Crypte');
    expect(space.color).toBe('#FFFFFF');
    expect(spaces).toEqual([space]);
  });

  it('appends the new space to the existing list', () => {
    const existing = [createSpace('Salle Bronze', '#4A90D9')];
    const { spaces } = autoCreateSpaceForSecutix(existing, 'Crypte');
    expect(spaces.map((s) => s.name)).toEqual(['Salle Bronze', 'Crypte']);
  });
});

describe('offerShortLabel', () => {
  it('returns the short label when defined', () => {
    expect(offerShortLabel({ ...offerAt('X'), shortLabel: 'VG' })).toBe('VG');
  });

  it('falls back to the offer name when shortLabel is undefined', () => {
    const offer = offerAt('X');
    expect(offer.shortLabel).toBeUndefined();
    expect(offerShortLabel(offer)).toBe('Visite guidée');
  });

  it('falls back to the offer name when shortLabel is empty or blank', () => {
    expect(offerShortLabel({ ...offerAt('X'), shortLabel: '' })).toBe('Visite guidée');
    expect(offerShortLabel({ ...offerAt('X'), shortLabel: '   ' })).toBe('Visite guidée');
  });
});

// ---------------------------------------------------------------------------
// Secutix import integration (domain level)
// ---------------------------------------------------------------------------

describe('Secutix import — spaces auto-creation', () => {
  function row(espace: string, overrides: Record<string, string> = {}) {
    return {
      productDateTime: '22.09.2026 10:45',
      product: 'VISITE',
      groupName: 'ECOLE PRIMAIRE',
      guide: '',
      theme: "G/ CP à CE2/ Découvrons le Muséum",
      contractNumber: '2456008',
      duration: '1:00',
      site: 'DCSTI_MHN',
      location: espace,
      visitLanguage: '',
      operationType: '',
      groupNature: 'SCOLAIRES C2',
      participantCount: '30',
      contactName: 'DUPONT Jean',
      contactPhone: '',
      contactEmail: '',
      remark: '',
      visitState: '',
      plannedArrivalTime: '',
      ...overrides,
    };
  }

  it('auto-creates an unknown ESPACE value as a white space on import', () => {
    const offer = { ...createOffer({ id: 'off_1', name: 'Découvrons', secutixLabel: "G/ CP à CE2/ Découvrons le Muséum" }) };
    const bookings = normalizeSecutixRows([row('Crypte')]).bookings;
    const matched = reconcileOffers(bookings, [offer]).matched;
    const plan = buildSecutixImportPlan(matched, [offer], [], new Date('2026-09-20T10:00:00Z'));
    const data: AppData = {
      mediators: [], offers: [offer], schedules: [], slots: [], absences: [],
      cycles: [], quotas: [], spaces: [],
    };
    const result = applySecutixImport(data, plan, []);
    expect(result.spaces).toHaveLength(1);
    expect(result.spaces[0].name).toBe('Crypte');
    expect(result.spaces[0].color).toBe('#FFFFFF');
    // The imported slot references the space
    expect(result.slots[0].location).toBe('Crypte');
  });

  it('reuses a known space without creating or recoloring it', () => {
    const offer = { ...createOffer({ id: 'off_1', name: 'Découvrons', secutixLabel: "G/ CP à CE2/ Découvrons le Muséum" }) };
    const spaces = [createSpace('Salle Bronze', '#4A90D9')];
    const bookings = normalizeSecutixRows([row('Salle Bronze')]).bookings;
    const matched = reconcileOffers(bookings, [offer]).matched;
    const plan = buildSecutixImportPlan(matched, [offer], [], new Date('2026-09-20T10:00:00Z'));
    const data: AppData = {
      mediators: [], offers: [offer], schedules: [], slots: [], absences: [],
      cycles: [], quotas: [], spaces,
    };
    const result = applySecutixImport(data, plan, []);
    expect(result.spaces).toEqual(spaces); // still exactly 1, color kept
    expect(result.slots[0].location).toBe('Salle Bronze');
  });

  it('reuses a known space case-insensitively', () => {
    const offer = { ...createOffer({ id: 'off_1', name: 'Découvrons', secutixLabel: "G/ CP à CE2/ Découvrons le Muséum" }) };
    const spaces = [createSpace('salle bronze', '#4A90D9')];
    const bookings = normalizeSecutixRows([row('Salle Bronze')]).bookings;
    const matched = reconcileOffers(bookings, [offer]).matched;
    const plan = buildSecutixImportPlan(matched, [offer], [], new Date('2026-09-20T10:00:00Z'));
    const data: AppData = {
      mediators: [], offers: [offer], schedules: [], slots: [], absences: [],
      cycles: [], quotas: [], spaces,
    };
    const result = applySecutixImport(data, plan, []);
    expect(result.spaces).toEqual(spaces);
  });
});
