// WeeklyView.test.tsx — Tests pour la vue "Plan Hebdo"
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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
    { id: 'o1', name: 'Visite guidée', description: '', duration: 60, capacity: 20, location: 'Salle 1', setupTime: 10, teardownTime: 10, welcomeType: 'Réservable encadrée par médiateur' },
  ],
  schedules: [],
  slots: [
    { id: 's1', date: '2026-09-15', startTime: '10:00', endTime: '12:00', offerId: 'o1', mediatorIds: ['m1'], status: 'planned', origin: 'manual', scheduleId: '', participantCount: 0, notes: '', importSource: '', importedAt: '', modifiedAfterImport: false, groupName: '', guide: '', location: '', groupNature: '', contactName: '', contactPhone: '', contactEmail: '' },
  ],
  absences: [],
};

describe('WeeklyView', () => {
  beforeEach(() => {
    // Freeze time: the mock slot is on 2026-09-15, so "today" must fall in
    // the week of Monday 14 Sept 2026 for the slot to be displayed.
    // Without this the tests break as real time moves past that week.
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-17T10:00:00'));
    // Mock localStorage
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => JSON.stringify(mockData)),
      setItem: vi.fn(),
    });
    // Reset the URL: DataProvider's URL-sync effect persists across tests
    // (replaceState on the shared jsdom window), and getInitialState()
    // reads ?date= — a leftover date would start the next test on the
    // wrong week.
    window.history.replaceState({}, '', '/');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should render the weekly view with the period label', () => {
    render(
      <DataProvider>
        <WeeklyView />
      </DataProvider>
    );

    expect(screen.getByText(/Plan Hebdo/i)).toBeInTheDocument();
    // Week of 14–20 Sept 2026 = ISO week 38
    expect(screen.getByText(/Semaine 38 — 14 sept\. 2026 – 20 sept\. 2026/i)).toBeInTheDocument();
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

  it('offers a date picker on the period label to jump to any week', () => {
    const { container } = render(
      <DataProvider>
        <WeeklyView />
      </DataProvider>
    );
    const input = container.querySelector('.date-picker-input') as HTMLInputElement;
    expect(input).toBeTruthy();
    expect(input.type).toBe('date');

    // Changing the date moves the displayed week (period label updates)
    fireEvent.change(input, { target: { value: '2027-03-10' } });
    // Week containing 2027-03-10 (Wednesday) = Monday 8 → Sunday 14 March 2027
    expect(screen.getByText(/8 mars/i)).toBeInTheDocument();
    expect(screen.getByText(/14 mars/i)).toBeInTheDocument();
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
    // s1: mediator m1 has NO competence for the offer -> incompetent (amber)
    const slotEl = container.querySelector('.cal-slot') as HTMLElement;
    expect(slotEl).toBeTruthy();
    expect(slotEl.className).toContain('pstatus-incompetent');
    expect(slotEl.style.background).toContain('rgb(255, 233, 199)'); // #ffe9c7

    // Compact badges: time + title + status with the status emoji
    expect(slotEl.textContent).toContain('⚠️');
    expect(slotEl.textContent).toContain('Incompétent');

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
    // Severity order: À assigner, Indisponibilité, Incompétent, En apprentissage, OK
    const badges = Array.from(items).map((i) => i.textContent);
    expect(badges[0]).toContain('❌');
    expect(badges[0]).toContain('À assigner');
    expect(badges[1]).toContain('🚫');
    expect(badges[1]).toContain('Indisponibilité');
    expect(badges[2]).toContain('⚠️');
    expect(badges[2]).toContain('Incompétent');
    expect(badges[3]).toContain('📚');
    expect(badges[3]).toContain('En apprentissage');
    expect(badges[4]).toContain('✔️');
    expect(badges[4]).toContain('OK');
  });

  it('clamps absence banners to the visible 8:00–19:00 window', () => {
    const withAbsences = {
      ...mockData,
      absences: [
        // Full-day: 00:00–23:59 -> must clamp to 8:00–19:00 (top 0, full column)
        { id: 'a1', mediatorId: 'm1', startDate: '2026-09-15', endDate: '2026-09-15', halfDay: 'none', type: 'leave', notes: '' },
        // Morning half-day: 00:00–13:00 -> clamps to 8:00–13:00
        { id: 'a2', mediatorId: 'm2', startDate: '2026-09-16', endDate: '2026-09-16', halfDay: 'morning', type: 'training', notes: '' },
        // Afternoon half-day: 13:00–23:59 -> clamps to 13:00–19:00
        { id: 'a3', mediatorId: 'm1', startDate: '2026-09-17', endDate: '2026-09-17', halfDay: 'afternoon', type: 'mission', notes: '' },
      ],
    };
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => JSON.stringify(withAbsences)),
      setItem: vi.fn(),
    });

    const { container } = render(
      <DataProvider>
        <WeeklyView />
      </DataProvider>
    );

    const banners = container.querySelectorAll('.cal-absence');
    expect(banners.length).toBe(3);

    // jsdom default innerHeight 768 -> (768 - 220) / 11 = 49.82 px/h
    const pxPerHour = (768 - 220) / 11;
    const colHeight = pxPerHour * 11;

    for (const b of Array.from(banners) as HTMLElement[]) {
      const top = parseFloat(b.style.top);
      const height = parseFloat(b.style.height);
      expect(top).toBeGreaterThanOrEqual(0);
      expect(top + height).toBeLessThanOrEqual(colHeight + 1);
    }

    // Full-day banner spans the whole visible window
    const fullDay = banners[0] as HTMLElement;
    expect(parseFloat(fullDay.style.top)).toBe(0);
    expect(parseFloat(fullDay.style.height)).toBeCloseTo(colHeight - 4, 0);

    // Morning half-day starts at the top of the window and ends at 13:00
    const morning = banners[1] as HTMLElement;
    expect(parseFloat(morning.style.top)).toBe(0);
    expect(parseFloat(morning.style.top) + parseFloat(morning.style.height)).toBeCloseTo(5 * pxPerHour - 4, 0);

    // Afternoon half-day starts at 13:00 and reaches the bottom of the window
    const afternoon = banners[2] as HTMLElement;
    expect(parseFloat(afternoon.style.top)).toBeCloseTo(5 * pxPerHour, 0);
    expect(parseFloat(afternoon.style.top) + parseFloat(afternoon.style.height)).toBeCloseTo(colHeight - 4, 0);

    // The native tooltip keeps the REAL absence hours (00:00 – 23:59)
    expect(fullDay.getAttribute('title')).toContain('00:00');
    expect(fullDay.getAttribute('title')).toContain('23:59');
  });

  it('renders emoji-only summary in narrow parallel lanes (no origin badge)', () => {
    // Two overlapping slots on the same day -> computeLanes splits into
    // 2 parallel lanes -> compact emoji mode
    const overlapping = {
      ...mockData,
      slots: [
        ...mockData.slots,
        {
          ...mockData.slots[0],
          id: 's2',
          startTime: '10:30',
          endTime: '11:30',
          origin: 'imported' as const,
          importSource: 'Secutix',
        },
      ],
    };
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => JSON.stringify(overlapping)),
      setItem: vi.fn(),
    });

    const { container } = render(
      <DataProvider>
        <WeeklyView />
      </DataProvider>
    );

    const compactSlots = container.querySelectorAll('.slot-badges-compact');
    expect(compactSlots.length).toBe(2);

    // Each compact lane: status emoji with mediator dot BELOW (after in DOM)
    const first = compactSlots[0];
    expect(first.textContent).toMatch(/❌|🚫|⚠️|📚|✔️/);
    expect(first.textContent).not.toContain('📥');
    expect(first.textContent).not.toContain('✋');
    // No time or title text in compact mode
    expect(first.textContent).not.toContain('10:00');
    // Structure: emoji first, colored ● mediator glyph second (below)
    const children = first.children;
    expect(children.length).toBe(2);
    expect(children[0].className).toContain('slot-badge-emoji');
    expect(children[1].className).toContain('slot-mediator-glyph');
    expect(children[1].textContent).toBe('●');
  });
});
