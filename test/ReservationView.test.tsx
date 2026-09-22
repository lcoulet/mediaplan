// ReservationView.test.tsx — Tests for the "Plan Accueil" view
// (chronological list of the day's reservations, no time grid)
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ReservationView from '../src/presentation/ReservationView';
import { DataProvider } from '../src/presentation/DataContext';
import type { AppData } from '../src/domain/types';

// Test data matching AppData interface
const mockData: AppData = {
  mediators: [
    { id: 'm1', firstName: 'Jean', lastName: 'Dupont', email: '', phone: '', notes: '', color: '#FF0000', active: true, competences: [] },
    { id: 'm2', firstName: 'Marie', lastName: 'Martin', email: '', phone: '', notes: '', color: '#00FF00', active: true, competences: [] },
  ],
  offers: [
    { id: 'o1', name: 'Visite guidée', description: '', duration: 60, capacity: 20, location: 'Salle 1', setupTime: 15, teardownTime: 10, welcomeType: 'Réservable encadrée par médiateur' },
    { id: 'o2', name: 'Atelier créatif', description: '', duration: 90, capacity: 15, location: 'Atelier', welcomeType: 'Réservable encadrée par médiateur' },
    { id: 'o3', name: 'Visite Libre Expo Perm', description: '', duration: 60, capacity: 60, location: 'Exposition permanente', welcomeType: 'Accueil Libre' },
  ],
  schedules: [],
  slots: [
    // Booking 10:00 on o1 with 15-min setup -> block starts 09:45 (FIRST)
    { id: 's1', scheduleId: '', date: '2026-09-19', startTime: '10:00', endTime: '11:00', offerId: 'o1', mediatorIds: ['m1'], status: 'planned', origin: 'imported', participantCount: 30, notes: '', importSource: 'Secutix', importedAt: '', modifiedAfterImport: false, groupName: 'GROUPE A', guide: '', location: '', groupNature: 'SCOLAIRES C2', contactName: '', contactPhone: '', contactEmail: '' },
    // Booking 09:50 on o2 without setup -> block starts 09:50 (SECOND)
    { id: 's2', scheduleId: '', date: '2026-09-19', startTime: '09:50', endTime: '10:20', offerId: 'o2', mediatorIds: ['m1', 'm2'], status: 'planned', origin: 'manual', participantCount: 0, notes: '', importSource: '', importedAt: '', modifiedAfterImport: false, groupName: 'GROUPE B', guide: '', location: '', groupNature: '', contactName: '', contactPhone: '', contactEmail: '' },
    // Afternoon unassigned slot (THIRD)
    { id: 's3', scheduleId: '', date: '2026-09-19', startTime: '14:00', endTime: '15:00', offerId: 'o2', mediatorIds: [], status: 'planned', origin: 'manual', participantCount: 0, notes: '', importSource: '', importedAt: '', modifiedAfterImport: false, groupName: 'GROUPE C', guide: '', location: '', groupNature: '', contactName: '', contactPhone: '', contactEmail: '' },
    // Another day: must NOT appear
    { id: 's4', scheduleId: '', date: '2026-09-20', startTime: '09:00', endTime: '10:00', offerId: 'o1', mediatorIds: ['m1'], status: 'planned', origin: 'manual', participantCount: 0, notes: '', importSource: '', importedAt: '', modifiedAfterImport: false, groupName: 'GROUPE X', guide: '', location: '', groupNature: '', contactName: '', contactPhone: '', contactEmail: '' },
    // Free visit (Accueil Libre, no mediator needed): bottom section, lane "Libre"
    { id: 's5', scheduleId: '', date: '2026-09-19', startTime: '11:00', endTime: '12:00', offerId: 'o3', mediatorIds: [], status: 'planned', origin: 'manual', participantCount: 25, notes: '', importSource: '', importedAt: '', modifiedAfterImport: false, groupName: 'GROUPE LIBRE', guide: '', location: '', groupNature: '', contactName: '', contactPhone: '', contactEmail: '' },
  ],
  absences: [],
};

// Mock Date to always return 2026-09-19
const MOCK_DATE = new Date('2026-09-19T10:00:00.000Z');

describe('ReservationView', () => {
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

  it('renders the view title with the ISO week number', () => {
    render(
      <DataProvider>
        <ReservationView />
      </DataProvider>
    );
    expect(screen.getAllByText(/Plan Accueil —/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Semaine 38 — samedi 19 septembre 2026/i).length).toBeGreaterThan(0);
  });

  it('lists the day reservations sorted by block start (setup included)', () => {
    const { container } = render(
      <DataProvider>
        <ReservationView />
      </DataProvider>
    );
    // s4 is on another day; s5 is a free visit (own section, excluded here)
    const rows = container.querySelectorAll('.res-list .res-row');
    expect(rows.length).toBe(3);
    const groups = Array.from(rows).map(r => r.textContent);
    // s1 (block 09:45) before s2 (block 09:50) before s3 (14:00)
    expect(groups[0]).toContain('GROUPE A');
    expect(groups[1]).toContain('GROUPE B');
    expect(groups[2]).toContain('GROUPE C');
  });

  it('shows free visits (Accueil Libre) in a separate bottom section with lane "Libre"', () => {
    const { container } = render(
      <DataProvider>
        <ReservationView />
      </DataProvider>
    );
    expect(screen.getByText(/Réservations visites libres/i)).toBeInTheDocument();
    const freeRows = container.querySelectorAll('.res-freevisits .res-row');
    expect(freeRows.length).toBe(1);
    expect(freeRows[0].textContent).toContain('GROUPE LIBRE');
    // Left lane shows "Libre", not "Non assigné"
    const lane = freeRows[0].querySelector('.res-mediators');
    expect(lane!.textContent).toContain('Libre');
    expect(lane!.textContent).not.toContain('Non assigné');
    // Free visits are NOT in the main mediated list
    const mainRows = container.querySelectorAll('.res-list .res-row');
    expect(Array.from(mainRows).some(r => r.textContent!.includes('GROUPE LIBRE'))).toBe(false);
  });

  it('shows the assigned mediators in the left lane', () => {
    const { container } = render(
      <DataProvider>
        <ReservationView />
      </DataProvider>
    );
    const rows = container.querySelectorAll('.res-row');
    const lane1 = rows[0].querySelector('.res-mediators');
    expect(lane1!.textContent).toContain('Dupont Jean');
    const lane2 = rows[1].querySelector('.res-mediators');
    expect(lane2!.textContent).toContain('Dupont Jean');
    expect(lane2!.textContent).toContain('Martin Marie');
    // Unassigned slot shows "Non assigné"
    const lane3 = rows[2].querySelector('.res-mediators');
    expect(lane3!.textContent).toContain('Non assigné');
  });

  it('shows the Secutix-style booking summary in the right lane', () => {
    const { container } = render(
      <DataProvider>
        <ReservationView />
      </DataProvider>
    );
    const rows = container.querySelectorAll('.res-row');
    const summary1 = rows[0].querySelector('.res-summary');
    // French hour style + headcount + group from formatSlotBookingSummary
    expect(summary1!.textContent).toContain('10h00 - 11h00');
    expect(summary1!.textContent).toContain('30 pers. SCOLAIRES C2');
    expect(summary1!.textContent).toContain('GROUPE A');
  });
});
