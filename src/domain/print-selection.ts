// print-selection.ts — what to include in a printed daily view
import type { AppData } from './types';

/**
 * Mediator ids that carry something on the given day (an active slot or an
 * absence). The printed daily view hides mediator rows with nothing to show.
 * Order follows data.mediators.
 */
export function mediatorsForPrint(data: AppData, date: string): string[] {
  const active = new Set(
    data.slots
      .filter((s) => s.date === date && s.status !== 'cancelled')
      .flatMap((s) => s.mediatorIds)
  );
  for (const a of data.absences) {
    if (a.startDate <= date && a.endDate >= date) active.add(a.mediatorId);
  }
  return data.mediators.filter((m) => active.has(m.id)).map((m) => m.id);
}
