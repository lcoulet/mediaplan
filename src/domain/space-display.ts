// space-display.ts — Space display resolution for the day and accueil
// views: effective space of a slot (override, else offer default), readable
// text color for a space-colored block, and legend entries for a day.
// Pure logic, no browser APIs.
//
// Spec: test/features/spaces/spaces.feature
// - The block/space resolution follows getSlotLocation (slot.location
//   overrides the offer default) then matches a Space by name.
// - White (#FFFFFF) spaces (Secutix auto-created) get dark text; the
//   border rule is applied by the views.

import { spaceByName } from './spaces';
import type { Offer, Slot, Space } from './types';

/**
 * The effective space of a slot: the slot's location override when set,
 * else the offer's default location, matched against the space list
 * (trimmed, case-insensitive). Undefined when no location resolves to a
 * known space.
 */
export function spaceForSlot(
  spaces: Space[],
  slot: Slot,
  offer: Offer | undefined
): Space | undefined {
  const location = slot.location || offer?.location || '';
  return spaceByName(spaces, location);
}

/**
 * Readable text color for a space-colored block: the app's
 * readableTextColor rule (white on dark, dark on light incl. white
 * #FFFFFF). Without a space (neutral light block), dark text.
 */
export function blockTextColor(space: Space | undefined): string {
  if (!space) return '#2b2b2b';
  const hex = space.color.replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return '#2b2b2b';
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? '#2b2b2b' : '#ffffff';
}

/**
 * Spaces used by a day's slots (for the day-view legend): distinct
 * spaces resolved via spaceForSlot, in first-use order. Slots resolving
 * to no space are skipped.
 */
export function legendSpacesForDay(
  spaces: Space[],
  daySlots: Slot[],
  offers: Offer[]
): Space[] {
  const offerById = new Map(offers.map((o) => [o.id, o]));
  const seen = new Set<string>();
  const legend: Space[] = [];
  for (const slot of daySlots) {
    const space = spaceForSlot(spaces, slot, offerById.get(slot.offerId));
    if (!space || seen.has(space.id)) continue;
    seen.add(space.id);
    legend.push(space);
  }
  return legend;
}
