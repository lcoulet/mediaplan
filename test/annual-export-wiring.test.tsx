// annual-export-wiring.test.tsx — Annual view slice 5: Export button UI
// wiring. The button builds the export model from the DISPLAYED year and
// the columns as shown, writes the file and triggers a download named per
// the conventions.
// Spec: test/features/annual-view/annual-grid.feature (Export Excel).
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AnnualView from '../src/presentation/AnnualView';
import { DataProvider } from '../src/presentation/DataContext';
import type { AppData, CycleWeekDay, WorkCycle } from '../src/domain/types';
import { createDefaultCycle } from '../src/domain/cycles';

function mkCycle(mediatorId: string): WorkCycle {
  const cycle = createDefaultCycle(mediatorId, '2026-W06');
  const days: CycleWeekDay[] = [1, 2, 3, 4, 5, 6, 7].map((day) =>
    day <= 5 ? { day, startTime: '09:30', endTime: '18:00' } : { day }
  );
  cycle.weeks = [{ id: 'cweek_alice', name: 'S1', days }];
  cycle.id = 'cyc_alice';
  return cycle;
}

const mockData: AppData = {
  mediators: [
    {
      id: 'm_alice', firstName: 'Alice', lastName: 'Dupont', email: '', phone: '',
      notes: '', color: '#FF0000', active: true, competences: [],
      activeCycleId: 'cyc_alice', contractType: 'temps plein',
    },
    {
      id: 'm_bob', firstName: 'Bob', lastName: 'Fontaine', email: '', phone: '',
      notes: '', color: '#00FF00', active: true, competences: [],
    },
    {
      id: 'm_sofia', firstName: 'Sofia', lastName: 'Martin', email: '', phone: '',
      notes: '', color: '#0000FF', active: false, competences: [],
    },
  ],
  offers: [],
  schedules: [],
  slots: [],
  absences: [
    {
      id: 'a1', mediatorId: 'm_alice', startDate: '2026-06-10', endDate: '2026-06-10',
      halfDay: 'morning', type: 'leave', notes: 'CA',
    },
  ],
  cycles: [mkCycle('m_alice')],
  quotas: [],
  spaces: [],
};

const MOCK_DATE = new Date('2026-09-30T10:00:00.000Z');

describe('Annual view — Export button wiring', () => {
  let clickCaptured: { href: string; download: string } | null = null;

  beforeEach(() => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((key: string) => (key === 'mediaplan_data_v1' ? JSON.stringify(mockData) : null)),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    });
    vi.stubGlobal('Date', class extends Date {
      constructor(...args: any[]) {
        if (args.length === 0) super(MOCK_DATE.getTime());
        else super(...(args as [any]));
      }
      static now() { return MOCK_DATE.getTime(); }
    });
    window.history.replaceState({}, '', '/?display=tableau&date=2026-09-30');
    Element.prototype.scrollIntoView = vi.fn();

    // jsdom URL.createObjectURL is not implemented: capture the blob instead
    clickCaptured = null;
    (URL as any).createObjectURL = vi.fn(() => 'blob:mock');
    (URL as any).revokeObjectURL = vi.fn();
    // Capture the anchor click
    (HTMLAnchorElement.prototype as any).click = vi.fn(function (this: HTMLAnchorElement) {
      clickCaptured = { href: this.href, download: this.download };
    });
  });

  it('renders the Exporter Excel button in the toolbar', () => {
    render(
      <DataProvider>
        <AnnualView />
      </DataProvider>
    );
    const btn = screen.getByRole('button', { name: /Exporter Excel/ });
    expect(btn).toBeTruthy();
    expect(btn.className).toContain('annual-export-btn');
  });

  it('triggers a .xlsx download with the year-stamped filename on click', () => {
    render(
      <DataProvider>
        <AnnualView />
      </DataProvider>
    );
    fireEvent.click(screen.getByRole('button', { name: /Exporter Excel/ }));
    expect(clickCaptured).not.toBeNull();
    expect(clickCaptured!.download).toBe('tableau-fonctionnement-2026-20260930-*.xlsx'.replace('*', String(MOCK_DATE.getUTCHours()).padStart(2, '0') + String(MOCK_DATE.getUTCMinutes()).padStart(2, '0')));
    expect(clickCaptured!.href).toContain('blob:');
  });

  it('exports the DISPLAYED year (filename year segment follows the selector)', () => {
    render(
      <DataProvider>
        <AnnualView />
      </DataProvider>
    );
    fireEvent.click(screen.getByRole('button', { name: '2027' }));
    fireEvent.click(screen.getByRole('button', { name: /Exporter Excel/ }));
    expect(clickCaptured!.download).toMatch(/^tableau-fonctionnement-2027-/);
  });
});
