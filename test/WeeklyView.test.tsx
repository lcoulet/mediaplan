// WeeklyView.test.tsx — Tests pour la vue "Plan Hebdo"
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import WeeklyView from '../src/presentation/WeeklyView';
import { DataProvider } from '../src/presentation/DataContext';
import type { AppData } from '../src/domain/types';

// Mock des données de test
const mockData: AppData = {
  mediators: [
    { id: 'm1', firstName: 'Jean', lastName: 'Dupont', email: '', phone: '', notes: '', color: '#FF0000', active: true, competences: [] },
    { id: 'm2', firstName: 'Marie', lastName: 'Martin', email: '', phone: '', notes: '', color: '#00FF00', active: true, competences: [] },
  ],
  offers: [
    { id: 'o1', name: 'Visite guidée', description: '', duration: 60, capacity: 20, location: 'Salle 1', setupTime: 10, teardownTime: 10 },
  ],
  schedules: [],
  slots: [
    { id: 's1', date: '2026-09-15', startTime: '10:00', endTime: '12:00', offerId: 'o1', mediatorIds: ['m1'], status: 'planned', origin: 'manual', scheduleId: '', participantCount: 0, notes: '', importSource: '', importedAt: '', modifiedAfterImport: false },
  ],
  absences: [],
};

describe('WeeklyView', () => {
  beforeEach(() => {
    // Mock localStorage
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => JSON.stringify(mockData)),
      setItem: vi.fn(),
    });
  });

  it('should render the weekly view with the period label', () => {
    render(
      <DataProvider>
        <WeeklyView />
      </DataProvider>
    );

    expect(screen.getByText(/Plan Hebdo/i)).toBeInTheDocument();
    expect(screen.getByText(/14 sept. – 20 sept./i)).toBeInTheDocument();
  });

  it('should display mediators and slots', () => {
    render(
      <DataProvider>
        <WeeklyView />
      </DataProvider>
    );

    expect(screen.getAllByText('Jean Dupont')[1]).toBeInTheDocument(); // Le 2e élément pour éviter le select
    expect(screen.getByText('Visite guidée')).toBeInTheDocument();
  });

  it('scales the vertical hour grid to the viewport height', () => {
    // jsdom default innerHeight is 768: (768 - 220) / 11h = 49.81px/h
    const { container } = render(
      <DataProvider>
        <WeeklyView />
      </DataProvider>
    );
    const timeLabels = container.querySelectorAll('.cal-time-label');
    expect(timeLabels.length).toBe(12);
    const first = (timeLabels[0] as HTMLElement).style.height;
    expect(parseFloat(first)).toBeCloseTo(49.82, 1);

    // Day column min-height = 11h * scale
    const dayCols = container.querySelectorAll('.cal-day-col');
    const mh = parseFloat((dayCols[0] as HTMLElement).style.minHeight);
    expect(mh).toBeCloseTo(49.82 * 11, 0);
  });

  it('renders the weekly stats badge with per-status counts', () => {
    const { container } = render(
      <DataProvider>
        <WeeklyView />
      </DataProvider>
    );
    const stats = container.querySelector('#week-stats');
    expect(stats).toBeTruthy();
    // The mock has 1 slot (s1, assigned to m1 without competence) -> incompetent: 1
    const incompetent = stats!.querySelector('.week-stat-incompetent');
    expect(incompetent!.textContent).toBe('1');
  });

  it('colors slot backgrounds by planning status and shows a detailed tooltip', () => {
    const { container } = render(
      <DataProvider>
        <WeeklyView />
      </DataProvider>
    );
    // s1: mediator m1 has NO competence for the offer -> incompetent (grey)
    const slotEl = container.querySelector('.cal-slot') as HTMLElement;
    expect(slotEl).toBeTruthy();
    expect(slotEl.className).toContain('pstatus-incompetent');
    expect(slotEl.style.background).toContain('rgb(226, 227, 229)'); // #e2e3e5

    // Native tooltip carries the status and mediators
    const title = slotEl.getAttribute('title') || '';
    expect(title).toContain('État : Incompétent');
    expect(title).toContain('10:00 – 12:00');
    expect(title).toContain('Jean Dupont');
  });

  it('renders the planning status legend below the grid', () => {
    const { container } = render(
      <DataProvider>
        <WeeklyView />
      </DataProvider>
    );
    const legend = container.querySelector('.week-legend');
    expect(legend).toBeTruthy();
    const items = legend!.querySelectorAll('.week-legend-item');
    expect(items.length).toBe(5);
    expect(legend!.textContent).toContain('OK');
    expect(legend!.textContent).toContain('À assigner');
    expect(legend!.textContent).toContain('Indisponibilité');
    expect(legend!.textContent).toContain('En formation');
    expect(legend!.textContent).toContain('Incompétent');
  });
});
