// test/annual-view-wiring.test.tsx — Annual view slice 3 (grid UI):
// Tableau nav entry, route/display param binding, inactive toggle, route
// focus row, week/day navigation, férié panel, legend presence.
// Spec: test/features/annual-view/annual-grid.feature (navigation +
// inactive-mediator scenarios, decisions 2026-10-04).
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AnnualView from '../src/presentation/AnnualView';
import Header from '../src/presentation/Header';
import App from '../src/App';
import { DataProvider } from '../src/presentation/DataContext';
import { SHORTCUT_VIEWS } from '../src/presentation/useKeyboardShortcuts';
import type { AppData, WorkCycle, CycleWeekDay } from '../src/domain/types';
import { createDefaultCycle } from '../src/domain/cycles';

// ---- Test data ---------------------------------------------------------

// Alice: active, cycle S1 Mon-Fri 09:30-18:00 anchored on 2026-W06
function mkCycle(mediatorId: string): WorkCycle {
  const cycle = createDefaultCycle(mediatorId, '2026-W06');
  const days: CycleWeekDay[] = [1, 2, 3, 4, 5, 6, 7].map((day) =>
    // Monday to SATURDAY worked — so the worked-Saturday counter counts
    // presence cells (spec fix 2026-10-04: grid presence, not slots)
    day <= 6 ? { day, startTime: '09:30', endTime: '18:00' } : { day }
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
  slots: [
    // One slot on a Wednesday for Alice (presence via slot not needed —
    // the counter only matters on Saturdays)
    {
      id: 's1', scheduleId: '', date: '2026-06-13', startTime: '10:00', endTime: '12:00',
      offerId: 'o1', mediatorIds: ['m_alice'], status: 'planned', origin: 'manual',
      participantCount: 0, notes: '', importSource: '', importedAt: '',
      modifiedAfterImport: false, groupName: '', guide: '', location: '',
      groupNature: '', contactName: '', contactPhone: '', contactEmail: '',
    },
  ],
  absences: [
    // CA on Alice's morning of June 10 2026 (Wednesday)
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

function renderAnnual() {
  return render(
    <DataProvider>
      <AnnualView />
    </DataProvider>
  );
}

function renderApp() {
  return render(<App />);
}

describe('AnnualView (Tableau de fonctionnement)', () => {
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
    window.history.replaceState({}, '', '/');
    // jsdom lacks scrollIntoView
    Element.prototype.scrollIntoView = vi.fn();
  });

  // ---- Structure ----

  it('lists every day of the year, weekends included, one row per day', () => {
    const { container } = renderAnnual();
    const rows = container.querySelectorAll('tbody tr[id^="annual-row-"]');
    expect(rows.length).toBe(365); // 2026 is not a leap year
    expect(container.querySelector('#annual-row-2026-12-25')).toBeTruthy();
    expect(container.querySelector('#annual-row-2026-01-01')).toBeTruthy();
  });

  it('renders 2 half-day cells per mediator per day', () => {
    const { container } = renderAnnual();
    const row = container.querySelector('#annual-row-2026-06-10')!;
    // Alice + Bob visible (Sofia inactive, hidden by default)
    expect(row.querySelectorAll('td.c').length).toBe(4);
  });

  it('shows the ISO week label in its own leftmost column, spanning its week rows', () => {
    const { container } = renderAnnual();
    // Monday 2026-09-28 starts ISO week 40 (7 rows)
    const monday = container.querySelector('#annual-row-2026-09-28')!;
    const wk = monday.querySelector('th.wkcol') as HTMLTableCellElement;
    expect(wk).toBeTruthy();
    expect(wk.getAttribute('rowspan')).toBe('7');
    expect(wk.textContent).toBe('S 40');
    // Sunday of the same week carries no week cell (the rowspan covers it)
    const sunday = container.querySelector('#annual-row-2026-10-04')!;
    expect(sunday.querySelector('th.wkcol')).toBeNull();
    // No week label in the date column
    expect(monday.querySelector('th.date')!.textContent).not.toContain('S 40');
  });

  it('labels the partial first week of 2026 (Jan 1-4) as S 1', () => {
    const { container } = renderAnnual();
    const jan1 = container.querySelector('#annual-row-2026-01-01')!;
    const wk = jan1.querySelector('th.wkcol') as HTMLTableCellElement;
    expect(wk).toBeTruthy();
    expect(wk.textContent).toBe('S 1');
    // Partial week: spans only its 4 rows of 2026
    expect(wk.getAttribute('rowspan')).toBe('4');
    // The next group starts on Monday Jan 5 as S 2
    const jan5 = container.querySelector('#annual-row-2026-01-05')!;
    expect(jan5.querySelector('th.wkcol')!.textContent).toBe('S 2');
  });

  it('labels the last week of 2026 as S 53 (53 ISO weeks)', () => {
    const { container } = renderAnnual();
    const monday = container.querySelector('#annual-row-2026-12-28')!;
    expect(monday.querySelector('th.wkcol')!.textContent).toBe('S 53');
    // 2027 starts mid-week in S 53 of 2026: Fri Jan 1 2027 is labeled S 53
    fireEvent.click(screen.getByRole('button', { name: '2027' }));
    const jan1_2027 = container.querySelector('#annual-row-2027-01-01')!;
    expect(jan1_2027.querySelector('th.wkcol')!.textContent).toBe('S 53');
  });

  // ---- Cycle pills, derived presence, codes ----

  it('derives orange presence from the cycle and shows the cycle pill on Mondays only', () => {
    const { container } = renderAnnual();
    // Alice works Mon 2026-06-08 (cycle S1): presence cells, pill in the
    // morning cell zone of the Monday row
    const monday = container.querySelector('#annual-row-2026-06-08')!;
    const aliceCells = monday.querySelectorAll('td.c');
    expect(aliceCells[0].className).toContain('st-presence');
    expect(aliceCells[0].textContent).toContain('S1');
    // Tuesday: presence but no repeated pill
    const tuesday = container.querySelector('#annual-row-2026-06-09')!;
    const tueAlice = tuesday.querySelectorAll('td.c');
    expect(tueAlice[0].className).toContain('st-presence');
    expect(tueAlice[0].textContent).not.toContain('S1');
    // Bob has no cycle: neutral cells, no pill
    expect(tueAlice[2].className).toContain('st-neutral');
    // Alice's Sunday: no derived presence (cycle is Mon-Sat); her Saturday
    // IS worked now (cycle Mon-Sat — feeds the worked-Saturday counter)
    const saturday = container.querySelector('#annual-row-2026-06-13')!;
    const satAlice = saturday.querySelectorAll('td.c');
    expect(satAlice[0].className).toContain('st-presence');
    const sunday = container.querySelector('#annual-row-2026-06-14')!;
    const sunAlice = sunday.querySelectorAll('td.c');
    expect(sunAlice[0].className).not.toContain('st-presence');
  });

  it('displays stored absences over the derived presence with their palette state', () => {
    const { container } = renderAnnual();
    const row = container.querySelector('#annual-row-2026-06-10')!;
    const alice = row.querySelectorAll('td.c');
    expect(alice[0].className).toContain('st-absence');
    expect(alice[0].textContent).toContain('CA');
    // Afternoon keeps the derived presence
    expect(alice[1].className).toContain('st-presence');
  });

  // ---- Saturday counters ----

  it('shows a computed worked-Saturday counter on Saturday rows only', () => {
    const { container } = renderAnnual();
    const saturday = container.querySelector('#annual-row-2026-06-13')!;
    const alice = saturday.querySelectorAll('td.c');
    // Alice's cycle works Saturdays: by Jun 13 she has worked every Saturday
    // of the year (Jan 3 → Jun 13 = 24) — the counter counts GRID PRESENCE
    // (spec fix 2026-10-04), not slots.
    expect(alice[0].textContent).toContain('×24');
    // The Wednesday row carries no counter
    const wednesday = container.querySelector('#annual-row-2026-06-10')!;
    expect(wednesday.querySelectorAll('.ct').length).toBe(0);
  });

  it('marks the counter valued from the configured threshold (default 12)', () => {
    const { container } = renderAnnual();
    // Alice's cycle works Saturdays — her 24 worked Saturdays exceed the
    // default threshold 12 → the counter is VALUED on 2026-06-13.
    const saturday = container.querySelector('#annual-row-2026-06-13')!;
    const alice = saturday.querySelectorAll('td.c');
    expect(alice[0].textContent).toContain('×24');
    expect(alice[0].querySelector('.ct')!.className).toContain('valued');
    // Bob has no cycle: counter 0, not valued, zero class
    expect(alice[2].textContent).toContain('×0');
    expect(alice[2].querySelector('.ct')!.className).toContain('zero');
  });

  // ---- Férié rows + panel ----

  it('marks férié and museum-closed rows', () => {
    const { container } = renderAnnual();
    const jan1 = container.querySelector('#annual-row-2026-01-01')!;
    expect(jan1.className).toContain('closed');
    expect(jan1.textContent).toContain('Fermé');
    const bastille = container.querySelector('#annual-row-2026-07-14')!;
    expect(bastille.className).toContain('ferie');
    expect(bastille.textContent).toContain('Férié');
  });

  it('lists the férié panel chips with add/remove dérogations', () => {
    renderAnnual();
    // Panel is collapsed by default: open it
    fireEvent.click(screen.getByText(/Fériés 2026 — dérogations par année/));
    expect(screen.getByText('14 Juillet')).toBeTruthy();
    expect(screen.getByText("Jour de l'An")).toBeTruthy();
    // Remove 14 juillet (default chip -> strike-through, reset button)
    fireEvent.click(screen.getByTitle('Retirer 14 Juillet des fériés de 2026'));
    const chip = screen.getByText('14 Juillet').closest('.annual-chip')!;
    expect(chip.className).toContain('removed');
  });

  // ---- Route focus + navigation ----

  it('highlights and focuses the row of the global date (route sync)', () => {
    const { container } = renderAnnual();
    const row = container.querySelector('#annual-row-2026-09-30')!;
    expect(row.className).toContain('route-focus');
    expect(row.querySelector('.route-chip')).toBeTruthy();
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
  });

  it('navigates to the daily view when clicking a day label', () => {
    renderAnnual();
    fireEvent.click(screen.getByTitle('Ouvrir la vue jour — 2026-06-10'));
    const params = new URLSearchParams(window.location.search);
    expect(params.get('display')).toBe('day');
    expect(params.get('date')).toBe('2026-06-10');
  });

  it('navigates to the weekly view when clicking a week label', () => {
    renderAnnual();
    fireEvent.click(screen.getByTitle('Ouvrir la vue hebdo — S 40'));
    const params = new URLSearchParams(window.location.search);
    expect(params.get('display')).toBe('week');
    expect(params.get('date')).toBe('2026-09-28');
  });

  // ---- Inactive mediators ----

  it('hides inactive mediators by default and reveals them with the toggle', () => {
    const { container } = renderAnnual();
    expect(screen.queryByText('Sofia Martin')).toBeNull();
    const toggle = screen.getByLabelText('Médiateurs désactivés');
    fireEvent.click(toggle);
    expect(screen.getByText(/Sofia Martin/)).toBeTruthy();
    // Muted header + (désactivé) chip + neutral cells (no derived presence
    // even though she has no cycle anyway)
    const header = container.querySelector('th.mh.inactive')!;
    expect(header).toBeTruthy();
    expect(header.textContent).toContain('(désactivé)');
    fireEvent.click(toggle);
    expect(screen.queryByText(/Sofia Martin/)).toBeNull();
  });

  it('keeps inactive cells neutral without derived presence', () => {
    const { container } = renderAnnual();
    fireEvent.click(screen.getByLabelText('Médiateurs désactivés'));
    const monday = container.querySelector('#annual-row-2026-06-08')!;
    const sofiaCells = monday.querySelectorAll('td.c');
    // Sofia is the third column group: cells 4 and 5
    expect(sofiaCells[4].className).toContain('st-neutral');
    expect(sofiaCells[4].className).not.toContain('st-presence');
  });

  // ---- Year switching ----

  it('switches years while preserving other years\' data', () => {
    const { container } = renderAnnual();
    fireEvent.click(screen.getByRole('button', { name: '2027' }));
    expect(container.querySelectorAll('tbody tr[id^="annual-row-"]').length).toBe(365);
    // 2027 starts on S 1 anchored on Mon 2027-01-04
    const monday = container.querySelector('#annual-row-2027-01-04')!;
    expect(monday.querySelector('th.wkcol')!.textContent).toBe('S 1');
    // Back to 2026: the absence is still there
    fireEvent.click(screen.getByRole('button', { name: '2026' }));
    const row = container.querySelector('#annual-row-2026-06-10')!;
    expect(row.querySelectorAll('td.c')[0].textContent).toContain('CA');
  });

  // ---- Legend ----

  it('renders the collapsible legend with the palette swatches', () => {
    renderAnnual();
    expect(screen.getByText('Légende (couleurs et codes)')).toBeTruthy();
    fireEvent.click(screen.getByText('Légende (couleurs et codes)'));
    expect(screen.getByText(/présence dérivée du cycle/i)).toBeTruthy();
    expect(screen.getByText(/télétravail/i)).toBeTruthy();
    expect(screen.getByText(/souhait en attente/i)).toBeTruthy();
  });

  // ---- UX fixes 2026-10-04 ----------------------------------------------

  it('UX fix 5: rich hover tooltip — mediator, date, half-day and legend wording, not the bare code', () => {
    const { container } = renderAnnual();
    // Stored absence: tooltip carries the full context + legend + code
    const caCell = container.querySelector('#annual-row-2026-06-10')!.querySelectorAll('td.c')[0];
    const title = caCell.getAttribute('title')!;
    expect(title).toContain('Alice Dupont');
    expect(title).toContain('2026-06-10');
    expect(title).toContain('Matin');
    expect(title).toContain('absence');
    expect(title).toContain('CA');
    // Derived presence: explicitly says so (never stored)
    const presenceCell = container.querySelector('#annual-row-2026-06-09')!.querySelectorAll('td.c')[0];
    expect(presenceCell.getAttribute('title')).toContain('présence dérivée du cycle');
    // Neutral cell (Bob, no cycle): says non-worked
    const neutralCell = container.querySelector('#annual-row-2026-06-13')!.querySelectorAll('td.c')[2];
    expect(neutralCell.getAttribute('title')).toContain('non travaillé');
  });

  it('UX fix 3: half-day cells are focusable with a visible focus outline class hook', () => {
    const { container } = renderAnnual();
    const cell = container.querySelector('#annual-row-2026-06-10')!.querySelectorAll('td.c')[0];
    expect(cell.getAttribute('role')).toBe('button');
    expect(cell.getAttribute('tabindex')).toBe('0');
  });
});

describe('Annual view wiring (nav + route)', () => {
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
    window.history.replaceState({}, '', '/');
    Element.prototype.scrollIntoView = vi.fn();
  });

  it('exposes a Tableau nav entry in the Header', () => {
    render(
      <DataProvider>
        <Header onToggleHistory={() => {}} />
      </DataProvider>
    );
    const btn = screen.getByRole('button', { name: /Tableau/ });
    expect(btn).toBeTruthy();
  });

  it('opens the annual view from the ?display=tableau route param', () => {
    window.history.replaceState({}, '', '/?display=tableau&date=2026-09-30');
    const { container } = renderApp();
    expect(screen.getByText('Tableau de fonctionnement')).toBeTruthy();
    const row = container.querySelector('#annual-row-2026-09-30')!;
    expect(row.className).toContain('route-focus');
  });

  it('syncs the display param to "tableau" while the view is open', () => {
    renderApp();
    fireEvent.click(screen.getByRole('button', { name: /Tableau/ }));
    const params = new URLSearchParams(window.location.search);
    expect(params.get('display')).toBe('tableau');
  });

  it('includes the annual view in the digit shortcut order', () => {
    expect(SHORTCUT_VIEWS).toContain('annual');
  });
});
