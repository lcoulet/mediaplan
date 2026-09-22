// DailyView.test.tsx — Tests for the "Plan Jour" (Day Planning View)
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import DailyView from '../src/presentation/DailyView';
import { DataProvider } from '../src/presentation/DataContext';
import type { AppData } from '../src/domain/types';

// Test data matching AppData interface
const mockData: AppData = {
  mediators: [
    { id: 'm1', firstName: 'Jean', lastName: 'Dupont', email: '', phone: '', notes: '', color: '#FF0000', active: true, competences: [] },
    { id: 'm2', firstName: 'Marie', lastName: 'Martin', email: '', phone: '', notes: '', color: '#00FF00', active: true, competences: [] },
    { id: 'm3', firstName: 'Inactif', lastName: 'Test', email: '', phone: '', notes: '', color: '#0000FF', active: false, competences: [] },
  ],
  offers: [
    { id: 'o1', name: 'Visite guidée', description: '', duration: 60, capacity: 20, location: 'Salle 1', setupTime: 10, teardownTime: 10, welcomeType: 'Réservable encadrée par médiateur' },
    { id: 'o2', name: 'Atelier créatif', description: '', duration: 90, capacity: 15, location: 'Atelier', setupTime: 15, teardownTime: 5, welcomeType: 'Réservable encadrée par médiateur' },
    { id: 'o3', name: 'Visite Libre Expo Perm', description: '', duration: 60, capacity: 60, location: 'Exposition permanente', welcomeType: 'Accueil Libre' },
  ],
  schedules: [],
  slots: [
    // Assigned slot for today
    { id: 's1', scheduleId: '', date: '2026-09-19', startTime: '10:00', endTime: '12:00', offerId: 'o1', mediatorIds: ['m1'], status: 'planned', origin: 'manual', participantCount: 0, notes: '', importSource: '', importedAt: '', modifiedAfterImport: false, groupName: '', guide: '', location: '', groupNature: '', contactName: '', contactPhone: '', contactEmail: '' },
    // Unassigned imported slot for today
    { id: 's2', scheduleId: '', date: '2026-09-19', startTime: '14:00', endTime: '15:00', offerId: 'o2', mediatorIds: [], status: 'planned', origin: 'imported', participantCount: 0, notes: '', importSource: 'Secutix', importedAt: '', modifiedAfterImport: false, groupName: '', guide: '', location: '', groupNature: '', contactName: '', contactPhone: '', contactEmail: '' },
    // Free visit (Accueil Libre, no mediator needed) for today
    { id: 's3', scheduleId: '', date: '2026-09-19', startTime: '11:00', endTime: '12:00', offerId: 'o3', mediatorIds: [], status: 'planned', origin: 'manual', participantCount: 25, notes: '', importSource: '', importedAt: '', modifiedAfterImport: false, groupName: 'GROUPE LIBRE', guide: '', location: '', groupNature: '', contactName: '', contactPhone: '', contactEmail: '' },
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
    // Reset the URL: DataProvider's URL-sync effect persists across tests
    // (replaceState on the shared jsdom window), and getInitialState()
    // reads ?date= — a leftover date would start the next test on the
    // wrong day.
    window.history.replaceState({}, '', '/');
  });

  it('should render the daily view title with today\'s date', () => {
    render(
      <DataProvider>
        <DailyView />
      </DataProvider>
    );
    expect(screen.getAllByText(/Plan Jour —/i).length).toBeGreaterThan(0);
    // 2026-09-19 (mocked today) belongs to ISO week 38
    expect(screen.getAllByText(/Semaine 38 — samedi 19 septembre 2026/i).length).toBeGreaterThan(0);
  });

  it('should show the unassigned count next to the unassigned lane label', () => {
    const { container } = render(
      <DataProvider>
        <DailyView />
      </DataProvider>
    );
    // 3 slots on 2026-09-19: 1 assigned, 1 unassigned, 1 free visit.
    // Free visits (Accueil Libre) count as ASSIGNED (no mediator needed).
    const badge = container.querySelector('.daily-unassigned-count');
    expect(badge).toBeTruthy();
    expect(badge!.textContent).toBe('1/3');
  });

  it('should render free visits (Accueil Libre) in their own lane, not the unassigned lane', () => {
    const { container } = render(
      <DataProvider>
        <DailyView />
      </DataProvider>
    );
    expect(screen.getByText(/Réservations visites libres/i)).toBeInTheDocument();

    // The free visit block is in the free-visits section
    const freeSection = container.querySelector('.daily-freevisits-section');
    expect(freeSection).toBeTruthy();
    const freeBlocks = freeSection!.querySelectorAll('.daily-slot');
    expect(freeBlocks.length).toBe(1);
    expect(freeBlocks[0].textContent).toContain('11:00');
    // The lane label says "Libre"
    expect(freeSection!.querySelector('.daily-mediator-name')!.textContent).toContain('Libre');

    // NOT in the unassigned lane (still only the 14:00 unassigned slot)
    const unassignedSection = container.querySelector('.daily-unassigned-section');
    expect(unassignedSection!.querySelectorAll('.daily-slot').length).toBe(1);
  });

  it('places the free-visits lane below the mediators and above the draggable offers', () => {
    const { container } = render(
      <DataProvider>
        <DailyView />
      </DataProvider>
    );
    const grid = container.querySelector('.daily-grid')!;
    const classes = Array.from(grid.children).map(c => (c as HTMLElement).className);
    const unassignedIdx = classes.findIndex(c => c.includes('daily-unassigned-section'));
    const mediatorsIdx = classes.findIndex(c => c.includes('daily-mediators-section'));
    const freeIdx = classes.findIndex(c => c.includes('daily-freevisits-section'));
    const offersIdx = classes.findIndex(c => c.includes('daily-offers-section'));
    expect(unassignedIdx).toBeGreaterThanOrEqual(0);
    expect(mediatorsIdx).toBeGreaterThan(unassignedIdx);
    expect(freeIdx).toBeGreaterThan(mediatorsIdx);
    expect(offersIdx).toBeGreaterThan(freeIdx);
  });

  it('renders overlapping free-visit slots on separate lanes (no visual overlap)', () => {
    // Two free visits overlapping in time must land in two different rows
    const data: AppData = {
      ...mockData,
      slots: [
        mockData.slots[0], // s1 assigned, out of the way
        { ...mockData.slots[2], id: 'f1', startTime: '10:00', endTime: '11:00' },
        { ...mockData.slots[2], id: 'f2', startTime: '10:30', endTime: '11:30' },
      ],
    };
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => JSON.stringify(data)),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    });
    const { container } = render(
      <DataProvider>
        <DailyView />
      </DataProvider>
    );
    const freeSection = container.querySelector('.daily-freevisits-section')!;
    const rows = freeSection.querySelectorAll('.daily-unassigned-row');
    expect(rows.length).toBe(2);
    expect(rows[0].querySelectorAll('.daily-slot').length).toBe(1);
    expect(rows[1].querySelectorAll('.daily-slot').length).toBe(1);
  });

  it('renders non-overlapping free-visit slots on a single lane', () => {
    const data: AppData = {
      ...mockData,
      slots: [
        mockData.slots[0],
        { ...mockData.slots[2], id: 'f1', startTime: '10:00', endTime: '11:00' },
        { ...mockData.slots[2], id: 'f2', startTime: '11:00', endTime: '12:00' },
      ],
    };
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => JSON.stringify(data)),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    });
    const { container } = render(
      <DataProvider>
        <DailyView />
      </DataProvider>
    );
    const freeSection = container.querySelector('.daily-freevisits-section')!;
    const rows = freeSection.querySelectorAll('.daily-unassigned-row');
    expect(rows.length).toBe(1);
    expect(rows[0].querySelectorAll('.daily-slot').length).toBe(2);
  });

  it('hides totally incompetent mediators while dragging an offer', () => {
    // m1 confirmed on o1, m2 learning on o1, m3 inactive (never rendered).
    // A fourth active mediator m4 has NO competence on o1: during the drag
    // of o1 his row must be hidden; m1 and m2 stay visible.
    const data: AppData = {
      ...mockData,
      mediators: [
        ...mockData.mediators,
        { id: 'm4', firstName: 'Paul', lastName: 'Durand', email: '', phone: '', notes: '', color: '#FFFF00', active: true, competences: [{ offerId: 'o2', status: 'confirmed' as const }] },
      ],
    };
    // Give m1 and m2 a competence on o1 so they remain visible
    data.mediators = data.mediators.map(m => {
      if (m.id === 'm1') return { ...m, competences: [{ offerId: 'o1', status: 'confirmed' as const }] };
      if (m.id === 'm2') return { ...m, competences: [{ offerId: 'o1', status: 'learning' as const }] };
      return m;
    });
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => JSON.stringify(data)),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    });

    const { container } = render(
      <DataProvider>
        <DailyView />
      </DataProvider>
    );

    // Masking defaults to OFF now — turn it ON for this test
    const toggle = container.querySelector('#toggle-dynamic-masking') as HTMLInputElement;
    act(() => { fireEvent.click(toggle); });

    const mediatorRows = () =>
      Array.from(container.querySelectorAll('.daily-mediators-section .daily-mediator-row'));

    // Before the drag: 3 active mediator rows
    expect(mediatorRows().length).toBe(3);

    // jsdom does not implement dataTransfer — mock it
    const dataTransfer = {
      effectAllowed: 'move', dropEffect: 'move',
      setData: () => {}, getData: () => '',
    };
    const offer = container.querySelector('.daily-offer')!;
    // The offers lane contains all offers; pick the one for o1 (first)
    const dragStartEvent = new Event('dragstart', { bubbles: true, cancelable: true });
    Object.defineProperty(dragStartEvent, 'dataTransfer', { value: dataTransfer });
    act(() => { offer.dispatchEvent(dragStartEvent); });

    // During the drag: incompetent rows are REMOVED from the layout
    // (compact grid — the drag image offset bug is accepted)
    expect(mediatorRows().length).toBe(2);
    const names = mediatorRows().map(r => r.textContent);
    expect(names.some(n => n!.includes('Dupont'))).toBe(true);
    expect(names.some(n => n!.includes('Martin'))).toBe(true);
    expect(names.some(n => n!.includes('Durand'))).toBe(false);

    // After the drag ends: all rows visible again
    const dragEndEvent = new Event('dragend', { bubbles: true, cancelable: true });
    Object.defineProperty(dragEndEvent, 'dataTransfer', { value: dataTransfer });
    act(() => { offer.dispatchEvent(dragEndEvent); });
    expect(mediatorRows().length).toBe(3);
  });

  it('keeps all mediators visible when dragging an offer nobody is competent for', () => {
    // No mediator has any competence on o1 — hiding everyone would make the
    // drop impossible, so no row may be hidden.
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => JSON.stringify(mockData)),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    });

    const { container } = render(
      <DataProvider>
        <DailyView />
      </DataProvider>
    );

    const dataTransfer = {
      effectAllowed: 'move', dropEffect: 'move',
      setData: () => {}, getData: () => '',
    };
    const offer = container.querySelector('.daily-offer')!;
    const dragStartEvent = new Event('dragstart', { bubbles: true, cancelable: true });
    Object.defineProperty(dragStartEvent, 'dataTransfer', { value: dataTransfer });
    act(() => { offer.dispatchEvent(dragStartEvent); });

    // Nobody hidden (safety rule) — and both active mediators still rendered
    const rows = container.querySelectorAll('.daily-mediators-section .daily-mediator-row');
    expect(rows.length).toBe(2); // m1 and m2 (active mediators, m3 inactive)
  });

  it('does not hide mediators when dragging a free-visit offer (Accueil Libre)', () => {
    // Free visits need NO mediator — competence filtering does not apply.
    const data: AppData = {
      ...mockData,
      mediators: [
        ...mockData.mediators,
        { id: 'm4', firstName: 'Paul', lastName: 'Durand', email: '', phone: '', notes: '', color: '#FFFF00', active: true, competences: [{ offerId: 'o1', status: 'confirmed' as const }] },
      ],
    };
    data.mediators = data.mediators.map(m => {
      if (m.id === 'm1') return { ...m, competences: [{ offerId: 'o1', status: 'confirmed' as const }] };
      return m;
    });
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => JSON.stringify(data)),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    });

    const { container } = render(
      <DataProvider>
        <DailyView />
      </DataProvider>
    );

    // Find the o3 (Accueil Libre) offer in the offers lane
    const offers = Array.from(container.querySelectorAll('.daily-offer'));
    const freeOffer = offers.find(el => el.textContent!.includes('Visite Libre Expo Perm'))!;

    const dataTransfer = {
      effectAllowed: 'move', dropEffect: 'move',
      setData: () => {}, getData: () => '',
    };
    const dragStartEvent = new Event('dragstart', { bubbles: true, cancelable: true });
    Object.defineProperty(dragStartEvent, 'dataTransfer', { value: dataTransfer });
    act(() => { freeOffer.dispatchEvent(dragStartEvent); });

    // All 3 active mediator rows remain (m4 added below is active too)
    const rows = container.querySelectorAll('.daily-mediators-section .daily-mediator-row');
    expect(rows.length).toBe(3); // m1, m2, m4 — free visit hides nobody
  });

  it('hides incompetent mediators when dragging an unassigned slot to assign', () => {
    // Dragging slot s2 (offer o2, unassigned): only mediators competent on
    // o2 must remain — m1/m2 (competent on o1 only) are removed from layout.
    const data: AppData = {
      ...mockData,
      mediators: mockData.mediators.map(m => {
        if (m.id === 'm1') return { ...m, competences: [{ offerId: 'o1', status: 'confirmed' as const }] };
        if (m.id === 'm2') return { ...m, competences: [{ offerId: 'o1', status: 'confirmed' as const }] };
        return m;
      }),
      // Add a mediator competent on o2
      // m3 is inactive; add m4 confirmed on o2 as a valid target
    };
    data.mediators = [
      ...data.mediators,
      { id: 'm4', firstName: 'Paul', lastName: 'Durand', email: '', phone: '', notes: '', color: '#FFFF00', active: true, competences: [{ offerId: 'o2', status: 'confirmed' as const }] },
    ];
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => JSON.stringify(data)),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    });

    const { container } = render(
      <DataProvider>
        <DailyView />
      </DataProvider>
    );

    // Masking defaults to OFF — turn it ON for this test
    const toggle = container.querySelector('#toggle-dynamic-masking') as HTMLInputElement;
    act(() => { fireEvent.click(toggle); });

    // Drag the unassigned slot s2 from the unassigned lane
    const unassignedSlot = Array.from(
      container.querySelectorAll('.daily-unassigned-section .daily-slot')
    ).find(el => el.textContent!.includes('14:00'))!;
    expect(unassignedSlot).toBeTruthy();

    const dataTransfer = {
      effectAllowed: 'move', dropEffect: 'move',
      setData: () => {}, getData: () => '',
    };
    const dragStartEvent = new Event('dragstart', { bubbles: true, cancelable: true });
    Object.defineProperty(dragStartEvent, 'dataTransfer', { value: dataTransfer });
    act(() => { unassignedSlot.dispatchEvent(dragStartEvent); });

    // Incompetent mediators are REMOVED from the layout (compact grid)
    const rows = container.querySelectorAll('.daily-mediators-section .daily-mediator-row');
    expect(rows.length).toBe(1); // only m4 (competent on o2) remains
    expect(rows[0].textContent).toContain('Durand');
  });

  it('does not hide any mediator when the dynamic masking toggle is off', () => {
    // Masking now defaults to OFF (persisted) — leave the toggle untouched.
    const data: AppData = {
      ...mockData,
      mediators: [
        ...mockData.mediators,
        { id: 'm4', firstName: 'Paul', lastName: 'Durand', email: '', phone: '', notes: '', color: '#FFFF00', active: true, competences: [{ offerId: 'o1', status: 'confirmed' as const }] },
      ],
    };
    data.mediators = data.mediators.map(m => {
      if (m.id === 'm1') return { ...m, competences: [{ offerId: 'o1', status: 'confirmed' as const }] };
      return m;
    });
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => JSON.stringify(data)),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    });

    const { container } = render(
      <DataProvider>
        <DailyView />
      </DataProvider>
    );

    // Default is OFF — verify the toggle state, do NOT click it
    const toggle = container.querySelector('#toggle-dynamic-masking') as HTMLInputElement;
    expect(toggle).toBeTruthy();
    expect(toggle.checked).toBe(false); // default OFF

    const dataTransfer = {
      effectAllowed: 'move', dropEffect: 'move',
      setData: () => {}, getData: () => '',
    };
    const offer = container.querySelector('.daily-offer')!;
    const dragStartEvent = new Event('dragstart', { bubbles: true, cancelable: true });
    Object.defineProperty(dragStartEvent, 'dataTransfer', { value: dataTransfer });
    act(() => { offer.dispatchEvent(dragStartEvent); });

    // Masking off: nobody removed even though m2/m4 are incompetent on the
    // dragged offer (m1 is the only competent one)
    const rows = container.querySelectorAll('.daily-mediators-section .daily-mediator-row');
    expect(rows.length).toBe(3); // m1, m2, m4 all present
  });

  it('renders overlapping unassigned slots on separate lanes (no visual overlap)', () => {
    const data: AppData = {
      ...mockData,
      slots: [
        mockData.slots[0], // s1 assigned
        { ...mockData.slots[1], id: 'u1', startTime: '10:00', endTime: '11:00' },
        { ...mockData.slots[1], id: 'u2', startTime: '10:45', endTime: '11:45' },
      ],
    };
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => JSON.stringify(data)),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    });
    const { container } = render(
      <DataProvider>
        <DailyView />
      </DataProvider>
    );
    const unassignedSection = container.querySelector('.daily-unassigned-section')!;
    const rows = unassignedSection.querySelectorAll('.daily-unassigned-row');
    expect(rows.length).toBe(2);
    expect(rows[0].querySelectorAll('.daily-slot').length).toBe(1);
    expect(rows[1].querySelectorAll('.daily-slot').length).toBe(1);
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

  it('scales the hour axis labels to the responsive px/hour scale', () => {
    // In jsdom the container is not measured -> fallback 60px/hour
    const { container } = render(
      <DataProvider>
        <DailyView />
      </DataProvider>
    );
    const labels = container.querySelectorAll('.daily-hour-label');
    expect(labels.length).toBe(12);
    // Each label width follows the responsive scale (fallback = 60px in jsdom)
    expect((labels[0] as HTMLElement).style.width).toBe('60px');
    // The spacer aligns with the 200px mediator label column
    const spacer = container.querySelector('.daily-time-spacer') as HTMLElement;
    expect(spacer.style.width).toBe('200px');
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
      // Offers section contains all three offers initially
      expect(container.querySelectorAll('.daily-offer').length).toBe(3);

      fireEvent.change(searchInput, { target: { value: 'VISITE' } });
      const offers = container.querySelectorAll('.daily-offer');
      // 'VISITE' matches 'Visite guidée' and 'Visite Libre Expo Perm'
      expect(offers.length).toBe(2);
      expect(Array.from(offers).some(o => o.textContent!.includes('Visite guidée'))).toBe(true);
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
    expect(screen.getByText(/Offres non programmées/i)).toBeInTheDocument();
    expect(screen.getByText(/Aucune offre non programmée|Offres non programmées/i)).toBeInTheDocument();
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

    // Delimiters at booking start (09:50 + 10 min setup = 10px, minus the
    // 3px left border the absolute element is positioned after) and booking
    // end (12:00 = 130 min from block start, minus 3px border)
    const boundaries = slotEl.querySelectorAll('.slot-boundary');
    expect(boundaries.length).toBe(2);
    expect((boundaries[0] as HTMLElement).style.left).toBe('7px');
    expect((boundaries[1] as HTMLElement).style.left).toBe('127px');

    // Tooltip mentions the real booking and setup/teardown (via
    // formatSlotBookingSummary's scheduling line)
    const title = slotEl.getAttribute('title') || '';
    expect(title).toContain('Réservation : 10h00 - 12h00');
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

    // The time label must show the BOOKING the cursor aims at.
    // Cursor at 10:30 = booking start; offer setupTime 10 extends the block
    // BEFORE it (10:20), teardown 10 after (11:40).
    const label = indicator!.querySelector('.drag-indicator-time');
    expect(label).toBeTruthy();
    expect(label!.textContent).toMatch(/10:30/);
    expect(label!.textContent).toMatch(/11:30/);
    // The tooltip shows the total block (booking ± setup/teardown)
    expect(indicator!.getAttribute('title')).toContain('Bloc total : 10:20');
    expect(indicator!.getAttribute('title')).toContain('11:40');
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
    // Cursor at 10:30 aims at the BOOKING -> booking 10:30 - 11:30.
    expect(createdEl!.textContent).toContain('10:30');
    expect(createdEl!.textContent).toContain('11:30');

    // The total block starts 10 min BEFORE the cursor (10:20 = 140px from
    // axis 8:00) and spans setup+duration+teardown = 80 min
    expect((createdEl as HTMLElement).style.left).toBe('140px');
    expect((createdEl as HTMLElement).style.width).toBe('80px');
  });

  it('snaps the BOOKING start to the 10-min grid when dragging an offer with setup', () => {
    // Offer: duration 60, setupTime 15, teardownTime 5.
    // Setup extends BEFORE the booking. When the user aims at a grid time
    // (e.g. 10:00), the booking must land on the grid — the setup block
    // starts 15 min earlier (09:45), possibly before the cursor.
    const data15 = JSON.parse(JSON.stringify(mockData));
    data15.offers[0] = {
      ...data15.offers[0],
      duration: 60, setupTime: 15, teardownTime: 5,
    };
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => JSON.stringify(data15)),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    });

    const { container } = render(
      <DataProvider>
        <DailyView />
      </DataProvider>
    );

    const dataTransfer = {
      effectAllowed: 'move', dropEffect: 'move',
      setData: () => {}, getData: () => '',
    };
    const offer = container.querySelector('.daily-offer')!;
    const dragStartEvent = new Event('dragstart', { bubbles: true, cancelable: true });
    Object.defineProperty(dragStartEvent, 'dataTransfer', { value: dataTransfer });
    act(() => { offer.dispatchEvent(dragStartEvent); });

    const track = container.querySelector('.daily-mediators-section .daily-mediator-track')!;
    Object.defineProperty(track, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: 660, height: 40 }),
    });

    // Cursor at 10:00 (120px). The user aims at 10:00 -> booking at 10:00.
    const dragOverEvent = new MouseEvent('dragover', {
      bubbles: true, cancelable: true, clientX: 120, clientY: 20,
    });
    Object.defineProperty(dragOverEvent, 'dataTransfer', { value: dataTransfer });
    act(() => { track.dispatchEvent(dragOverEvent); });

    const indicator = container.querySelector('.daily-drag-indicator') as HTMLElement;
    expect(indicator).toBeTruthy();
    // Booking label: 10:00 - 11:00 (not 10:15)
    const label = indicator.querySelector('.drag-indicator-time');
    expect(label!.textContent).toContain('10:00');
    expect(label!.textContent).toContain('11:00');
    // Total block: 09:45 - 11:05 = 80 min = 80px, starting 15px BEFORE cursor
    expect(indicator.style.width).toBe('80px');
    expect(indicator.style.left).toBe('105px');
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
    // 2026-09-19 is a Saturday in French locale (toolbar + print header both show it)
    expect(screen.getAllByText(/samedi 19 septembre/i).length).toBeGreaterThan(0);
  });

  it('offers a date picker in the title to jump to any date', () => {
    const { container } = render(
      <DataProvider>
        <DailyView />
      </DataProvider>
    );
    const input = container.querySelector('.date-picker-input') as HTMLInputElement;
    expect(input).toBeTruthy();
    expect(input.type).toBe('date');
    // Current selected date as value (mocked today = 2026-09-19)
    expect(input.value).toBe('2026-09-19');
    // Changing the date updates the title (toolbar + print header)
    fireEvent.change(input, { target: { value: '2026-10-08' } });
    expect(screen.getAllByText(/jeudi 8 octobre/i).length).toBeGreaterThan(0);
  });
});
