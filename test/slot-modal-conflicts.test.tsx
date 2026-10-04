// test/slot-modal-conflicts.test.tsx — Conflict labels in the slot modal's
// mediator pills: the competence mark must NOT read as validating a conflict
// (decision 2026-10-04 follow-up). A mediator confirmed on the offer AND
// unavailable (absence / overlap / off worked period) must show the conflict
// label clean of the ✅.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DataProvider } from '../src/presentation/DataContext';
import SlotModal from '../src/presentation/SlotModal';
import type { AppData, Slot } from '../src/domain/types';

class LocalStorageMock {
  data: Record<string, string> = {};
  getItem(key: string): string | null { return this.data[key] || null; }
  setItem(key: string, value: string): void { this.data[key] = String(value); }
  removeItem(key: string): void { delete this.data[key]; }
  clear(): void { this.data = {}; }
}
vi.stubGlobal('localStorage', new LocalStorageMock());

vi.useFakeTimers();
vi.setSystemTime(new Date('2026-10-06T10:00:00'));

const baseMediator = {
  id: 'm1', firstName: 'Alice', lastName: 'Dupont', email: '', phone: '',
  notes: '', color: '#e91e63', active: true,
  competences: [{ offerId: 'o1', status: 'confirmed' as const }],
  activeCycleId: 'cyc1',
};

const baseOffer = {
  id: 'o1', name: 'Visite guidée', description: '', duration: 90,
  capacity: 20, location: 'Salle 1', setupTime: 0, teardownTime: 0,
  welcomeType: 'Réservable encadrée par médiateur' as const,
};

const baseCycle = {
  id: 'cyc1', mediatorId: 'm1', anchorIsoWeek: '2026-W40', forcedWeeks: {} as Record<string, string>,
  weeks: [{
    id: 'w1', name: 'S1',
    days: [
      { day: 1 }, { day: 2, startTime: '09:00', endTime: '18:00' }, { day: 3 },
      { day: 4 }, { day: 5 }, { day: 6 }, { day: 7 },
    ],
  }],
};

const baseSlot: Slot = {
  id: 's1', date: '2026-10-06', startTime: '07:30', endTime: '08:30',
  offerId: 'o1', mediatorIds: ['m1'], status: 'planned', origin: 'manual',
  scheduleId: '', participantCount: 0, notes: '', importSource: '', importedAt: '',
  modifiedAfterImport: false, groupName: '', guide: '', location: '',
  groupNature: '', contactName: '', contactPhone: '', contactEmail: '',
};

function seedStorage(data: Partial<AppData>): void {
  localStorage.setItem('mediaplan_data_v1', JSON.stringify({
    mediators: [baseMediator], offers: [baseOffer], schedules: [], slots: [baseSlot],
    absences: [], cycles: [baseCycle], quotas: [], spaces: [],
    ...data,
  } satisfies AppData));
}

function renderModal(slot: Slot = baseSlot) {
  return render(
    <DataProvider>
      <SlotModal slot={slot} mediatorOnly={false} defaultDate={slot.date} onClose={() => {}} />
    </DataProvider>
  );
}

describe('SlotModal — conflict labels on mediator pills', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/');
  });

  it('labels the off-worked-period conflict WITHOUT the competence ✅ glued to it', () => {
    // s1 07:30-08:30 is before the worked range 09:00-18:00; m1 is confirmed
    // on the offer. The pill must show the conflict label; the ✅ must not
    // sit immediately before « — Indisponible » (reads as validating it).
    seedStorage({});
    renderModal();
    const pill = screen.getByText(/Indisponible \(hors période travaillée\)/);
    // The ✅ must not directly precede the conflict suffix on the same pill
    expect(pill.textContent).not.toMatch(/✅\s*—\s*Indisponible/);
  });

  it('labels an absence conflict WITHOUT the ✅ glued to it', () => {
    seedStorage({
      absences: [{
        id: 'a1', mediatorId: 'm1', startDate: '2026-10-06', endDate: '2026-10-06',
        halfDay: 'none' as const, type: 'leave' as const, notes: '',
      }],
    });
    renderModal();
    const pill = screen.getByText(/— Absent/);
    expect(pill.textContent).not.toMatch(/✅\s*—\s*Absent/);
  });

  it('labels an overlap conflict WITHOUT the ✅ glued to it', () => {
    seedStorage({
      slots: [
        baseSlot,
        {
          ...baseSlot, id: 's2', startTime: '07:45', endTime: '08:15',
          mediatorIds: ['m1'],
        },
      ],
    });
    renderModal();
    const pill = screen.getByText(/— Conflit horaire/);
    expect(pill.textContent).not.toMatch(/✅\s*—\s*Conflit horaire/);
  });

  it('keeps the plain ✅ for a conflict-free confirmed mediator', () => {
    seedStorage({
      slots: [{ ...baseSlot, startTime: '10:00', endTime: '12:00' }],
    });
    renderModal({ ...baseSlot, startTime: '10:00', endTime: '12:00' });
    const pill = screen.getByText(/Alice Dupont ✅/);
    expect(pill.textContent).toBe('Alice Dupont ✅');
  });
});
