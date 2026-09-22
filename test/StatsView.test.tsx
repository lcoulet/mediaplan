// StatsView.test.tsx — Tests for the statistics view
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import StatsView from '../src/presentation/StatsView';
import { DataProvider } from '../src/presentation/DataContext';
import type { AppData, Slot } from '../src/domain/types';

function slot(over: Partial<Slot>): Slot {
  return {
    id: 'x', scheduleId: '', date: '2026-09-10', startTime: '10:00',
    endTime: '11:00', offerId: 'o1', mediatorIds: [], participantCount: 10,
    status: 'planned', notes: '', origin: 'manual', importSource: '',
    importedAt: '', modifiedAfterImport: false, groupName: '', guide: '',
    location: '', groupNature: '', contactName: '', contactPhone: '', contactEmail: '',
    ...over,
  };
}

const mockData: AppData = {
  mediators: [
    { id: 'm1', firstName: 'Jean', lastName: 'Dupont', email: '', phone: '', notes: '', color: '#F00', active: true, competences: [] },
  ],
  offers: [
    { id: 'o1', name: 'Visite guidée', description: '', duration: 60, capacity: 20, location: '', setupTime: 0, teardownTime: 0, welcomeType: 'Réservable encadrée par médiateur' },
    { id: 'o3', name: 'Libre', description: '', duration: 60, capacity: 60, location: '', welcomeType: 'Accueil Libre' },
  ],
  schedules: [],
  absences: [],
  slots: [
    slot({ id: 's1', offerId: 'o1', mediatorIds: ['m1'], date: '2026-09-10', participantCount: 20 }),
    slot({ id: 's2', offerId: 'o3', date: '2026-09-11', participantCount: 30, groupNature: 'SCOLAIRES C2' }),
  ],
};

const MOCK_DATE = new Date('2026-09-15T10:00:00.000Z');

describe('StatsView', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => JSON.stringify(mockData)),
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
    window.history.replaceState({}, '', '/');
  });

  it('renders the period selector and the three tabs', () => {
    render(
      <DataProvider>
        <StatsView />
      </DataProvider>
    );
    expect(screen.getByText(/Statistiques/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Date début/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Date fin/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Médiateurs/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Réservations/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Visites/i })).toBeInTheDocument();
  });

  it('mediators tab shows per-mediator stats table', () => {
    render(
      <DataProvider>
        <StatsView />
      </DataProvider>
    );
    // Period must include 2026-09-10: September 2026 is the default month
    const row = screen.getByText('Dupont Jean').closest('tr')!;
    expect(row).toBeTruthy();
    // Animations column shows the bare count (no "réservation" label)
    expect(row.querySelector('td:nth-child(2)')!.textContent).toBe('1');
  });

  it('reservations tab shows aligned charts (count, duration, participants)', () => {
    const { container } = render(
      <DataProvider>
        <StatsView />
      </DataProvider>
    );
    fireEvent.click(screen.getByRole('button', { name: /Réservations/i }));
    // Three chart groups, one per offer, same X order
    const countCharts = container.querySelectorAll('.stats-bar-chart[data-chart="count"]');
    const durationCharts = container.querySelectorAll('.stats-bar-chart[data-chart="duration"]');
    const candleCharts = container.querySelectorAll('.stats-candle-chart');
    expect(countCharts.length).toBeGreaterThan(0);
    expect(durationCharts.length).toBeGreaterThan(0);
    expect(candleCharts.length).toBeGreaterThan(0);
  });

  it('visits tab shows the free vs accompanied pie chart', () => {
    render(
      <DataProvider>
        <StatsView />
      </DataProvider>
    );
    fireEvent.click(screen.getByRole('button', { name: /Visites/i }));
    expect(screen.getByText(/Libres vs accompagnées/i)).toBeInTheDocument();
    expect(screen.getByText(/Effectifs cumulés/i)).toBeInTheDocument();
  });

  it('changes the period and recomputes', () => {
    render(
      <DataProvider>
        <StatsView />
      </DataProvider>
    );
    // Default: current month (September 2026) — slot s1 visible
    expect(screen.getByText('Dupont Jean')).toBeInTheDocument();
    // Move the start date after all slots: no data left
    const start = screen.getByLabelText(/Date début/i) as HTMLInputElement;
    fireEvent.change(start, { target: { value: '2026-10-01' } });
    expect(screen.queryByText('Dupont Jean')).not.toBeInTheDocument();
  });
});
