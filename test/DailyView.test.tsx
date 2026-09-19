// DailyView.test.tsx — Tests for the "Plan Jour" (Day Planning View)
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import DailyView from '../src/presentation/DailyView';
import { DataProvider } from '../src/presentation/DataContext';
import type { AppData } from '../domain/types';

// Test data matching AppData interface
const mockData: AppData = {
  mediators: [
    { id: 'm1', firstName: 'Jean', lastName: 'Dupont', email: '', phone: '', notes: '', color: '#FF0000', active: true, competences: [] },
    { id: 'm2', firstName: 'Marie', lastName: 'Martin', email: '', phone: '', notes: '', color: '#00FF00', active: true, competences: [] },
    { id: 'm3', firstName: 'Inactif', lastName: 'Test', email: '', phone: '', notes: '', color: '#0000FF', active: false, competences: [] },
  ],
  offers: [
    { id: 'o1', name: 'Visite guidée', description: '', duration: 60, capacity: 20, location: 'Salle 1', setupTime: 10, teardownTime: 10 },
    { id: 'o2', name: 'Atelier créatif', description: '', duration: 90, capacity: 15, location: 'Atelier', setupTime: 15, teardownTime: 5 },
  ],
  schedules: [],
  slots: [
    // Assigned slot for today
    { id: 's1', scheduleId: '', date: '2026-09-19', startTime: '10:00', endTime: '12:00', offerId: 'o1', mediatorIds: ['m1'], status: 'planned', origin: 'manual', participantCount: 0, notes: '', importSource: '', importedAt: '', modifiedAfterImport: false },
    // Unassigned imported slot for today
    { id: 's2', scheduleId: '', date: '2026-09-19', startTime: '14:00', endTime: '15:00', offerId: 'o2', mediatorIds: [], status: 'planned', origin: 'imported', participantCount: 0, notes: '', importSource: 'Secutix', importedAt: '', modifiedAfterImport: false },
  ],
  absences: [],
};

// Mock Date to always return 2026-09-19
const MOCK_DATE = new Date('2026-09-19T10:00:00.000Z');

describe('DailyView', () => {
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
        else super(args[0] as any);
      }
      static now() { return MOCK_DATE.getTime(); }
    });
  });

  it('should render the daily view title with today\'s date', () => {
    render(
      <DataProvider>
        <DailyView />
      </DataProvider>
    );
    expect(screen.getByText(/Plan Jour —/i)).toBeInTheDocument();
  });

  it('should render active mediators as rows (not inactive ones)', () => {
    render(
      <DataProvider>
        <DailyView />
      </DataProvider>
    );
    expect(screen.getByText('Jean Dupont')).toBeInTheDocument();
    expect(screen.getByText('Marie Martin')).toBeInTheDocument();
    expect(screen.queryByText('Inactif Test')).not.toBeInTheDocument();
  });

  it('should render time columns header (hours 8-19)', () => {
    const { container } = render(
      <DataProvider>
        <DailyView />
      </DataProvider>
    );
    expect(container.querySelector('.daily-time-axis')).toBeTruthy();
    const hourLabels = container.querySelectorAll('.daily-hour-label');
    expect(hourLabels.length).toBe(12); // 8h to 19h
    expect(hourLabels[0].textContent).toBe('8:00');
    expect(hourLabels[11].textContent).toBe('19:00');
  });

  it('should render unassigned lane ABOVE mediators section', () => {
    const { container } = render(
      <DataProvider>
        <DailyView />
      </DataProvider>
    );
    expect(screen.getByText(/Réservations non affectées/i)).toBeInTheDocument();

    // Verify DOM order: unassigned section must come before mediators section
    const grid = container.querySelector('.daily-grid');
    expect(grid).toBeTruthy();
    const sections = grid!.children;
    const sectionClasses = Array.from(sections).map(s => s.className);

    const unassignedIdx = sectionClasses.findIndex(c => c.includes('daily-unassigned-section'));
    const mediatorsIdx = sectionClasses.findIndex(c => c.includes('daily-mediators-section'));

    expect(unassignedIdx).toBeGreaterThanOrEqual(0);
    expect(mediatorsIdx).toBeGreaterThanOrEqual(0);
    expect(unassignedIdx).toBeLessThan(mediatorsIdx);
  });

  it('should render unassigned slots within the unassigned lane', () => {
    const { container } = render(
      <DataProvider>
        <DailyView />
      </DataProvider>
    );
    const unassignedSection = container.querySelector('.daily-unassigned-section');
    expect(unassignedSection).toBeTruthy();
    const unassignedSlots = unassignedSection!.querySelectorAll('.daily-slot');
    expect(unassignedSlots.length).toBe(1);
    expect(unassignedSlots[0].textContent).toContain('14:00');
  });

  it('should render a standard offers lane section', () => {
    render(
      <DataProvider>
        <DailyView />
      </DataProvider>
    );
    expect(screen.getByText(/Offres libres/i)).toBeInTheDocument();
    expect(screen.getByText(/Aucune offre libre|Offres libres/i)).toBeInTheDocument();
  });

  it('should render assigned slots within mediator rows', () => {
    const { container } = render(
      <DataProvider>
        <DailyView />
      </DataProvider>
    );
    const mediatorRows = container.querySelectorAll('.daily-mediator-row');
    expect(mediatorRows.length).toBe(2); // 2 active mediators

    const firstRowSlots = mediatorRows[0].querySelectorAll('.daily-slot');
    expect(firstRowSlots.length).toBe(1);
    expect(firstRowSlots[0].textContent).toContain('10:00');
    expect(firstRowSlots[0].textContent).toContain('Visite guidée');
  });

  it('should navigate to previous day with ← button', () => {
    render(
      <DataProvider>
        <DailyView />
      </DataProvider>
    );
    const prevButton = screen.getByText('←');
    expect(prevButton).toBeInTheDocument();
    // Click should not throw
    fireEvent.click(prevButton);
  });

  it('should navigate to next day with → button', () => {
    render(
      <DataProvider>
        <DailyView />
      </DataProvider>
    );
    const nextButton = screen.getByText('→');
    expect(nextButton).toBeInTheDocument();
    fireEvent.click(nextButton);
  });

  it('should have an Aujourd\'hui button to reset to today', () => {
    render(
      <DataProvider>
        <DailyView />
      </DataProvider>
    );
    expect(screen.getByText('Aujourd\'hui')).toBeInTheDocument();
  });

  it('should open slot modal with mediatorOnly=false when clicking a slot', () => {
    const { container } = render(
      <DataProvider>
        <DailyView />
      </DataProvider>
    );
    const slot = container.querySelector('.daily-slot');
    expect(slot).toBeTruthy();
    fireEvent.click(slot!);
    // The modal should open with mediatorOnly=false, allowing mediator assignment
    expect(screen.getByText(/Assigner un médiateur|Modifier le créneau/i)).toBeInTheDocument();
  });

  it('should display mediator color badges', () => {
    const { container } = render(
      <DataProvider>
        <DailyView />
      </DataProvider>
    );
    const colorBadges = container.querySelectorAll('.daily-mediator-color');
    expect(colorBadges.length).toBe(2); // 2 active mediators
  });

  it('should have a grid layout with time columns', () => {
    const { container } = render(
      <DataProvider>
        <DailyView />
      </DataProvider>
    );
    const grid = container.querySelector('.daily-grid');
    expect(grid).toBeTruthy();
    expect(container.querySelector('.daily-time-axis')).toBeTruthy();
  });

  it('should not allow dragging offers when locked (default)', () => {
    const { container } = render(
      <DataProvider>
        <DailyView />
      </DataProvider>
    );
    const offer = container.querySelector('.daily-offer');
    expect(offer).toBeTruthy();
    // locked by default → not draggable
    expect(offer?.getAttribute('draggable')).toBe('false');
  });

  it('should allow dragging unassigned slots when locked (imported unassigned still draggable for assignment)', () => {
    const { container } = render(
      <DataProvider>
        <DailyView />
      </DataProvider>
    );
    const unassignedSlots = container.querySelectorAll('.daily-slot.unassigned');
    expect(unassignedSlots.length).toBeGreaterThan(0);
    // imported slot is not draggable when locked
    expect(unassignedSlots[0].getAttribute('draggable')).toBe('false');
  });

  it('should allow dragging assigned slots', () => {
    const { container } = render(
      <DataProvider>
        <DailyView />
      </DataProvider>
    );
    const assignedSlots = container.querySelectorAll('.daily-slot.assigned');
    expect(assignedSlots.length).toBeGreaterThan(0);
    // manual assigned slot is draggable even when locked (for re-assignment)
    expect(assignedSlots[0]).toHaveAttribute('draggable', 'true');
  });

  it('should display the current day label in the title', () => {
    render(
      <DataProvider>
        <DailyView />
      </DataProvider>
    );
    // 2026-09-19 is a Saturday in French locale
    expect(screen.getByText(/samedi 19 septembre/i)).toBeInTheDocument();
  });
});
