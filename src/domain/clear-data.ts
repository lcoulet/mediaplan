// clear-data.ts — Pure data clearing for the "Nettoyer les données" action
import type { AppData } from './types';

export interface ClearOptions {
  /** Also remove all mediators */
  clearMediators?: boolean;
  /** Also remove all offers */
  clearOffers?: boolean;
}

/**
 * Clear planning data (slots, absences, schedules). Mediators and offers
 * survive by default; pass options to remove them too. Returns a NEW
 * AppData — the input is never mutated.
 */
export function clearPlanningData(data: AppData, options: ClearOptions = {}): AppData {
  return {
    mediators: options.clearMediators ? [] : [...data.mediators],
    offers: options.clearOffers ? [] : [...data.offers],
    schedules: [],
    slots: [],
    absences: [],
    cycles: [...data.cycles],
    quotas: [...data.quotas],
    spaces: [...data.spaces],
    ...(data.valorisation ? { valorisation: data.valorisation } : {}),
    // Annual view holiday dérogations survive: they are configuration of
    // the annual grid (per-year holiday list), not planning data.
    ...(data.annualHolidayOverrides ? { annualHolidayOverrides: data.annualHolidayOverrides } : {}),
  };
}
