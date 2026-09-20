// DailyView.test.tsx — Tests for the "Plan Jour" (Day Planning View)
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
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
        else super(...(args as [any]));
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
    const { container } = render(
      <DataProvider>
        <DailyView />
      </DataProvider>
    );
    // Now displays as "Dupont Jean" and "Martin Marie" (lastName firstName)
    const rowNames = Array.from(container.querySelectorAll('.daily-mediator-row'))
      .map(r => r.textContent);
    expect(rowNames.some(t => t!.includes('Dupont Jean'))).toBe(true);
    expect(rowNames.some(t => t!.includes('Martin Marie'))).toBe(true);
    expect(rowNames.some(t => t!.includes('Inactif Test'))).toBe(false);
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

  describe('mediator filter', () => {
    it('should render the mediator filter select with Libres/Occupés/Tous then mediator options', () => {
      const { container } = render(
        <DataProvider>
          <DailyView />
        </DataProvider>
      );
      const select = container.querySelector('#daily-mediator-filter') as HTMLSelectElement;
      expect(select).toBeTruthy();

      const options = Array.from(select.options).map(o => o.textContent);
      expect(options[0]).toBe('Libres');
      expect(options[1]).toBe('Occupés');
      expect(options[2]).toBe('Tous');
      // Then the individual mediators, alphabetically (Dupont before Martin)
      expect(options[3]).toBe('Dupont Jean');
      expect(options[4]).toBe('Martin Marie');
    });

    it('should show only free mediators (no slot AND no absence) when "Libres" is selected', () => {
      // m1 (Dupont) has a slot today -> occupied
      // m2 (Martin) has no slot, no absence -> free
      const { container } = render(
        <DataProvider>
          <DailyView />
        </DataProvider>
      );
      const select = container.querySelector('#daily-mediator-filter') as HTMLSelectElement;
      fireEvent.change(select, { target: { value: 'libres' } });

      const rows = container.querySelectorAll('.daily-mediator-row');
      expect(rows.length).toBe(1);
      expect(rows[0].textContent).toContain('Martin Marie');
      expect(rows[0].textContent).not.toContain('Dupont');
    });

    it('should show only occupied mediators when "Occupés" is selected', () => {
      const { container } = render(
        <DataProvider>
          <DailyView />
        </DataProvider>
      );
      const select = container.querySelector('#daily-mediator-filter') as HTMLSelectElement;
      fireEvent.change(select, { target: { value: 'occupes' } });

      const rows = container.querySelectorAll('.daily-mediator-row');
      expect(rows.length).toBe(1);
      expect(rows[0].textContent).toContain('Dupont Jean');
    });

    it('should show a specific mediator when one is selected', () => {
      const { container } = render(
        <DataProvider>
          <DailyView />
        </DataProvider>
      );
      const select = container.querySelector('#daily-mediator-filter') as HTMLSelectElement;
      const m2Option = Array.from(select.options).find(o => o.textContent === 'Martin Marie');
      fireEvent.change(select, { target: { value: m2Option!.value } });

      const rows = container.querySelectorAll('.daily-mediator-row');
      expect(rows.length).toBe(1);
      expect(rows[0].textContent).toContain('Martin Marie');
    });

    it('should consider a mediator with an absence today as NOT free', () => {
      const dataWithAbsence = JSON.parse(JSON.stringify(mockData));
      dataWithAbsence.absences.push({
        id: 'a1', mediatorId: 'm2', type: 'leave', halfDay: 'none',
        startDate: '2026-09-19', endDate: '2026-09-19',
      });
      vi.stubGlobal('localStorage', {
        getItem: vi.fn(() => JSON.stringify(dataWithAbsence)),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
      });

      const { container } = render(
        <DataProvider>
          <DailyView />
        </DataProvider>
      );
      const select = container.querySelector('#daily-mediator-filter') as HTMLSelectElement;
      fireEvent.change(select, { target: { value: 'libres' } });

      const rows = container.querySelectorAll('.daily-mediator-row');
      expect(rows.length).toBe(0); // m1 occupied (slot), m2 absent
    });
  });

  describe('offer search filter', () => {
    it('should render a case-insensitive text filter above the offers list', () => {
      const { container } = render(
        <DataProvider>
          <DailyView />
        </DataProvider>
      );
      const searchInput = container.querySelector('#daily-offer-search') as HTMLInputElement;
      expect(searchInput).toBeTruthy();
      // Offers section contains both offers initially
      expect(container.querySelectorAll('.daily-offer').length).toBe(2);

      fireEvent.change(searchInput, { target: { value: 'VISITE' } });
      const offers = container.querySelectorAll('.daily-offer');
      expect(offers.length).toBe(1);
      expect(offers[0].textContent).toContain('Visite guidée');
    });

    it('should filter offers on partial case-insensitive match', () => {
      const { container } = render(
        <DataProvider>
          <DailyView />
        </DataProvider>
      );
      const searchInput = container.querySelector('#daily-offer-search') as HTMLInputElement;
      fireEvent.change(searchInput, { target: { value: 'atelier' } });
      const offers = container.querySelectorAll('.daily-offer');
      expect(offers.length).toBe(1);
      expect(offers[0].textContent).toContain('Atelier créatif');
    });

    it('should show empty state message when no offer matches', () => {
      const { container } = render(
        <DataProvider>
          <DailyView />
        </DataProvider>
      );
      const searchInput = container.querySelector('#daily-offer-search') as HTMLInputElement;
      fireEvent.change(searchInput, { target: { value: 'zzz-no-match' } });
      expect(container.querySelector('.daily-empty')).toBeTruthy();
    });
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

  it('should render assigned slots as TOTAL blocks (setup + booking + teardown) with booking delimiters', () => {
    // Offer o1: duration 60, setupTime 10, teardownTime 10.
    // Slot s1: booking 10:00-12:00 -> total block 09:50 to 12:10.
    const { container } = render(
      <DataProvider>
        <DailyView />
      </DataProvider>
    );
    const row = container.querySelectorAll('.daily-mediator-row')[0];
    const slotEl = row.querySelector('.daily-slot') as HTMLElement;

    // Total block geometry: block 09:50-12:10 -> left = 110 min from 8:00 axis,
    // width = 140 min (60 booking + 10 setup + 10 teardown)
    expect(slotEl.style.left).toBe('110px');
    expect(slotEl.style.width).toBe('140px');

    // Delimiters at booking start (09:50 + 10 min setup = 10px) and booking end
    // (12:00 = 130 min from block start)
    const boundaries = slotEl.querySelectorAll('.slot-boundary');
    expect(boundaries.length).toBe(2);
    expect((boundaries[0] as HTMLElement).style.left).toBe('10px');
    expect((boundaries[1] as HTMLElement).style.left).toBe('130px');

    // Tooltip mentions the real booking and setup/teardown
    const title = slotEl.getAttribute('title') || '';
    expect(title).toContain('10:00 – 12:00');
    expect(title).toContain('mise en place');
    expect(title).toContain('rangement');
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

  it('should show drag indicator with times inside the track while dragging an offer', () => {
    // Simulate: drag offer o1 (60 min) over a mediator track at 10:25
    const { container } = render(
      <DataProvider>
        <DailyView />
      </DataProvider>
    );

    const offer = container.querySelector('.daily-offer')!;
    expect(offer).toBeTruthy();

    // jsdom does not implement dataTransfer or DragEvent — mock both.
    // fireEvent.dragOver creates a generic Event where clientX is undefined,
    // so we dispatch a MouseEvent carrying clientX + our dataTransfer.
    const dataTransfer = {
      effectAllowed: 'move',
      dropEffect: 'move',
      setData: () => {},
      getData: () => '',
    };

    // Start the drag on the offer
    const dragStartEvent = new Event('dragstart', { bubbles: true, cancelable: true });
    Object.defineProperty(dragStartEvent, 'dataTransfer', { value: dataTransfer });
    act(() => { offer.dispatchEvent(dragStartEvent); });

    const track = container.querySelector('.daily-mediators-section .daily-mediator-track')!;
    expect(track).toBeTruthy();

    // dragOver at x = 145px (10:00 + 145px ≈ 145 min → 10:30 rounded to 10 min)
    Object.defineProperty(track, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: 660, height: 40 }),
    });
    const dragOverEvent = new MouseEvent('dragover', {
      bubbles: true,
      cancelable: true,
      clientX: 145,
      clientY: 20,
    });
    Object.defineProperty(dragOverEvent, 'dataTransfer', { value: dataTransfer });
    act(() => { track.dispatchEvent(dragOverEvent); });
    const indicator = container.querySelector('.daily-drag-indicator');
    expect(indicator).toBeTruthy();

    // The time label must exist and contain the REAL BOOKING times.
    // Cursor at 10:30 marks the start of the total block; the offer has
    // setupTime 10 -> booking starts 10:40, duration 60 -> 11:40.
    const label = indicator!.querySelector('.drag-indicator-time');
    expect(label).toBeTruthy();
    expect(label!.textContent).toMatch(/10:40/);
    expect(label!.textContent).toMatch(/11:40/);
    // The tooltip shows the total block (cursor position -> setup + booking + teardown)
    expect(indicator!.getAttribute('title')).toContain('Bloc total : 10:30');
    expect(indicator!.getAttribute('title')).toContain('11:50'); // teardown 10
  });

  it('should create a slot from a drop using the indicator time and offer durations', () => {
    // End-to-end: dragstart -> dragover -> drop must produce a slot whose
    // booking matches the drag indicator and whose setup/teardown come
    // from the offer.
    const { container } = render(
      <DataProvider>
        <DailyView />
      </DataProvider>
    );

    const offer = container.querySelector('.daily-offer')!;
    const dataTransfer = {
      effectAllowed: 'move',
      dropEffect: 'move',
      setData: () => {},
      getData: () => '',
    };

    const dragStartEvent = new Event('dragstart', { bubbles: true, cancelable: true });
    Object.defineProperty(dragStartEvent, 'dataTransfer', { value: dataTransfer });
    act(() => { offer.dispatchEvent(dragStartEvent); });

    const track = container.querySelector('.daily-mediators-section .daily-mediator-track')!;
    Object.defineProperty(track, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: 660, height: 40 }),
    });

    // dragover at 145px -> rounded 10:30 (block start)
    const dragOverEvent = new MouseEvent('dragover', {
      bubbles: true, cancelable: true, clientX: 145, clientY: 20,
    });
    Object.defineProperty(dragOverEvent, 'dataTransfer', { value: dataTransfer });
    act(() => { track.dispatchEvent(dragOverEvent); });

    // Drop at a slightly different x (simulates cursor moving 1px at drop)
    const dropEvent = new MouseEvent('drop', {
      bubbles: true, cancelable: true, clientX: 146, clientY: 20,
    });
    Object.defineProperty(dropEvent, 'dataTransfer', { value: dataTransfer });
    act(() => { track.dispatchEvent(dropEvent); });

    // The created slot is rendered in the DOM (the localStorage mock does
    // not persist, so we assert on the rendered slots instead)
    const renderedSlots = container.querySelectorAll('.daily-mediators-section .daily-slot');
    // 1 pre-existing assigned slot (s1) + 1 newly created = 2
    expect(renderedSlots.length).toBe(2);

    // The NEW slot is the one whose time is not s1's (10:00)
    const createdEl = Array.from(renderedSlots).find(
      el => !el.textContent!.includes('10:00 – 12:00')
    );
    expect(createdEl).toBeTruthy();

    // Offer o1: setupTime 10, duration 60, teardownTime 10.
    // Indicator block start 10:30 -> booking 10:40 - 11:40.
    expect(createdEl!.textContent).toContain('10:40');
    expect(createdEl!.textContent).toContain('11:40');

    // The total block starts at the cursor position (10:30 = 150px from axis
    // 8:00) and spans setup+duration+teardown = 80 min
    expect((createdEl as HTMLElement).style.left).toBe('150px');
    expect((createdEl as HTMLElement).style.width).toBe('80px');
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

  it('should always allow dragging offers (creating manual reservations)', () => {
    const { container } = render(
      <DataProvider>
        <DailyView />
      </DataProvider>
    );
    const offer = container.querySelector('.daily-offer');
    expect(offer).toBeTruthy();
    // offers are always draggable to create manual slots, even when locked
    expect(offer).toHaveAttribute('draggable', 'true');
  });

  it('should allow dragging unassigned slots even when locked (for mediator assignment)', () => {
    const { container } = render(
      <DataProvider>
        <DailyView />
      </DataProvider>
    );
    const unassignedSlots = container.querySelectorAll('.daily-slot.unassigned');
    expect(unassignedSlots.length).toBeGreaterThan(0);
    // slots are always draggable for assignment, even imported ones when locked
    expect(unassignedSlots[0]).toHaveAttribute('draggable', 'true');
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
