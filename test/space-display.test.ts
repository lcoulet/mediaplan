// space-display.test.ts — Space display resolution for day/accueil blocks:
// effective space (slot override, else offer default), readable block text
// color, legend entries (spaces used by a day's slots).
// Spec: test/features/spaces/spaces.feature (day + accueil rendering part)
import { describe, it, expect } from 'vitest';
import {
  spaceForSlot,
  blockTextColor,
  legendSpacesForDay,
} from '../src/domain/space-display';
import { spaceByName } from '../src/domain/spaces';
import { createOffer, createSlot } from '../src/domain/models';
import type { Offer, Slot, Space } from '../src/domain/types';

const spaces: Space[] = [
  { id: 'spc_1', name: 'Salle Bronze', color: '#4A90D9' },
  { id: 'spc_2', name: 'Auditorium', color: '#7B1FA2' },
  { id: 'spc_3', name: 'Crypte', color: '#FFFFFF' }, // white (auto Secutix)
];

const offerAt = (location: string): Offer =>
  createOffer({ id: 'off_1', name: 'Visite guidée', location });

const slotAt = (location: string): Slot =>
  createSlot({ id: 'slot_1', offerId: 'off_1', location });

describe('spaceForSlot', () => {
  it('resolves the offer default space when the slot has no location', () => {
    const offer = offerAt('Salle Bronze');
    const slot = slotAt('');
    expect(spaceForSlot(spaces, slot, offer)?.name).toBe('Salle Bronze');
  });

  it('uses the slot.location override when set (spec: surcharge prime)', () => {
    const offer = offerAt('Salle Bronze');
    const slot = slotAt('Auditorium');
    const space = spaceForSlot(spaces, slot, offer);
    expect(space?.name).toBe('Auditorium');
    expect(space?.color).toBe('#7B1FA2');
  });

  it('matches names case-insensitively with surrounding whitespace', () => {
    const offer = offerAt('Salle Bronze');
    const slot = slotAt('  auditoRIUM ');
    expect(spaceForSlot(spaces, slot, offer)?.name).toBe('Auditorium');
  });

  it('returns undefined when no location resolves to a known space', () => {
    const offer = offerAt('');
    const slot = slotAt('');
    expect(spaceForSlot(spaces, slot, offer)).toBeUndefined();
  });

  it('returns undefined when the location names no existing space', () => {
    const offer = offerAt('Nulle part');
    const slot = slotAt('');
    expect(spaceForSlot(spaces, slot, offer)).toBeUndefined();
  });

  it('returns undefined when the offer is missing', () => {
    const slot = slotAt('');
    expect(spaceForSlot(spaces, slot, undefined)).toBeUndefined();
  });
});

describe('blockTextColor', () => {
  it('gives white text on dark space colors', () => {
    expect(blockTextColor(spaceByName(spaces, 'Auditorium'))).toBe('#ffffff');
    expect(blockTextColor(spaceByName(spaces, 'Salle Bronze'))).toBe('#ffffff');
  });

  it('gives dark text on light space colors', () => {
    expect(blockTextColor(spaceByName(spaces, 'Crypte'))).toBe('#2b2b2b');
  });

  it('falls back to dark text without a space (no space = neutral light block)', () => {
    expect(blockTextColor(undefined)).toBe('#2b2b2b');
  });
});

describe('legendSpacesForDay', () => {
  const offer = offerAt('Salle Bronze');

  it('lists the distinct spaces used by the day slots, in first-use order', () => {
    const daySlots = [
      slotAt(''),            // Salle Bronze (offer default)
      slotAt('Auditorium'),  // override
      slotAt(''),            // Salle Bronze again (no duplicate)
    ];
    const legend = legendSpacesForDay(spaces, daySlots, [offer]);
    expect(legend.map((s) => s.name)).toEqual(['Salle Bronze', 'Auditorium']);
  });

  it('skips slots that resolve to no space', () => {
    const daySlots = [slotAt(''), slotAt('')];
    const noSpaceOffer = offerAt('');
    const legend = legendSpacesForDay(spaces, daySlots, [noSpaceOffer]);
    expect(legend).toEqual([]);
  });

  it('resolves each slot against its own offer', () => {
    const offerB = createOffer({ id: 'off_2', name: 'Atelier', location: 'Crypte' });
    const slotB = createSlot({ id: 'slot_2', offerId: 'off_2', location: '' });
    const daySlots = [slotAt(''), slotB];
    const legend = legendSpacesForDay(spaces, daySlots, [offer, offerB]);
    expect(legend.map((s) => s.name)).toEqual(['Salle Bronze', 'Crypte']);
  });
});
