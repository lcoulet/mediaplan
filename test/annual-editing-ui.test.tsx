// test/annual-editing-ui.test.tsx — Annual view slice 4 (cell editing):
// grid WIRING of the context menu + paint mode in AnnualView — menu opens
// on cell click, code/free-text/clear commits dispatch + persist (undoable,
// one operation per cell), paint banner, click-by-click duplication (no
// drag), Escape / click-outside exit, per-cell undo.
// Spec: test/features/annual-view/annual-editing.feature (edition + mode
// peinture scenarios); mockup annual-editing.html states (1)(2)(3)(5).
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AnnualView from '../src/presentation/AnnualView';
import App from '../src/App';
import { DataProvider } from '../src/presentation/DataContext';
import type { AppData, WorkCycle, CycleWeekDay } from '../src/domain/types';
import { createDefaultCycle } from '../src/domain/cycles';

// ---- Test data (mirrors annual-view-wiring.test.tsx) --------------------

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
  ],
  offers: [],
  schedules: [],
  slots: [],
  absences: [
    // CA on Alice's morning of Wednesday June 10 2026 (clearable entry)
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

function cellSelector(container: any, iso: string, mediatorIndex: number, halfIndex: 0 | 1) {
  const row = container.querySelector(`#annual-row-${iso}`)!;
  const cells = row.querySelectorAll('td.c');
  return cells[mediatorIndex * 2 + halfIndex];
}

describe('AnnualView cell editing (slice 4)', () => {
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
    window.history.replaceState({}, '', '/?display=tableau');
    Element.prototype.scrollIntoView = vi.fn();
  });

  // ---- Context menu ------------------------------------------------------

  it('opens the context menu on a cell click with the target context', () => {
    const { container } = renderAnnual();
    const cell = cellSelector(container, '2026-06-09', 0, 0);
    fireEvent.click(cell);
    const menu = screen.getByRole('menu');
    expect(menu.textContent).toContain('Alice Dupont');
    expect(menu.textContent).toContain('09/06/2026');
    expect(menu.textContent).toContain('Matin');
  });

  it('picking CA stores the absence for that half-day only (afternoon unchanged)', () => {
    const { container } = renderAnnual();
    fireEvent.click(cellSelector(container, '2026-06-09', 0, 0));
    fireEvent.click(screen.getByRole('menuitem', { name: 'CA' }));
    const morning = cellSelector(container, '2026-06-09', 0, 0);
    const afternoon = cellSelector(container, '2026-06-09', 0, 1);
    expect(morning.className).toContain('st-absence');
    expect(morning.textContent).toContain('CA');
    expect(afternoon.className).toContain('st-presence');
  });

  it('persists the edit to localStorage (undoable commit)', () => {
    const { container } = renderAnnual();
    fireEvent.click(cellSelector(container, '2026-06-09', 0, 0));
    fireEvent.click(screen.getByRole('menuitem', { name: 'CA' }));
    // The data payload is the LAST 'mediaplan_data_v1' save
    const savedRaw = vi.mocked(localStorage.setItem).mock.calls
      .filter((c) => c[0] === 'mediaplan_data_v1' && c[1])
      .map((c) => c[1] as string)
      .pop();
    const saved = JSON.parse(savedRaw!);
    expect(saved.absences.some((a: any) => a.mediatorId === 'm_alice' && a.startDate === '2026-06-09' && a.halfDay === 'morning' && a.notes === 'CA')).toBe(true);
  });

  it('picking TELE shows the pink remote cell', () => {
    const { container } = renderAnnual();
    fireEvent.click(cellSelector(container, '2026-06-09', 0, 0));
    fireEvent.click(screen.getByRole('menuitem', { name: 'TELE' }));
    const cell = cellSelector(container, '2026-06-09', 0, 0);
    expect(cell.className).toContain('st-remote');
    expect(cell.textContent).toContain('TELE');
  });

  it('picking Souhait shows the blue pending-request cell (souhait CA)', () => {
    const { container } = renderAnnual();
    fireEvent.click(cellSelector(container, '2026-06-09', 0, 0));
    fireEvent.click(screen.getByRole('menuitem', { name: /Souhait/ }));
    const cell = cellSelector(container, '2026-06-09', 0, 0);
    expect(cell.className).toContain('st-leaveRequest');
    expect(cell.textContent).toContain('souhait CA');
  });

  it('free text commits an orange mission cell', () => {
    const { container } = renderAnnual();
    fireEvent.click(cellSelector(container, '2026-06-09', 0, 0));
    const input = screen.getByLabelText(/Texte libre/i);
    fireEvent.change(input, { target: { value: 'Stop Motion' } });
    fireEvent.click(screen.getByRole('button', { name: 'OK' }));
    const cell = cellSelector(container, '2026-06-09', 0, 0);
    expect(cell.className).toContain('st-mission');
    expect(cell.textContent).toContain('Stop Motion');
  });

  it('clear reverts the cell to the derived presence and drops the stored entry', () => {
    const { container } = renderAnnual();
    // Wednesday June 10 morning holds the seeded CA
    fireEvent.click(cellSelector(container, '2026-06-10', 0, 0));
    fireEvent.click(screen.getByRole('menuitem', { name: /Effacer/ }));
    const cell = cellSelector(container, '2026-06-10', 0, 0);
    expect(cell.className).toContain('st-presence');
    expect(cell.textContent).not.toContain('CA');
  });

  it('shows the museum-closed alert when editing 25/12 and the edit still commits', () => {
    const { container } = renderAnnual();
    fireEvent.click(cellSelector(container, '2026-12-25', 0, 0));
    expect(screen.getByRole('alert').textContent).toContain('Le musée est fermé ce jour-là');
    fireEvent.click(screen.getByRole('menuitem', { name: 'CA' }));
    const cell = cellSelector(container, '2026-12-25', 0, 0);
    expect(cell.className).toContain('st-absence');
  });

  it('Escape closes the menu without committing; a click outside closes it too', () => {
    const { container } = renderAnnual();
    fireEvent.click(cellSelector(container, '2026-06-09', 0, 0));
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
    // Click outside: open again, click the toolbar title
    fireEvent.click(cellSelector(container, '2026-06-09', 0, 0));
    fireEvent.mouseDown(screen.getByRole('heading', { name: /Tableau de fonctionnement/ }));
    expect(screen.queryByRole('menu')).toBeNull();
  });

  // ---- Paint mode -------------------------------------------------------

  // Paint mode tests: the paint toggle duplicates the LAST code picked in
  // the view — the realistic flow is pick code -> commit -> reopen menu ->
  // « Peindre ce code » (the feature: paint is activated FROM the menu).

  it('activating paint from the menu shows the banner and paints click-by-click', () => {
    const { container } = renderAnnual();
    // Pick CA (commits), then activate paint from a menu reopening
    fireEvent.click(cellSelector(container, '2026-06-09', 0, 0));
    fireEvent.click(screen.getByRole('menuitem', { name: 'CA' }));
    fireEvent.click(cellSelector(container, '2026-06-09', 0, 0));
    fireEvent.click(screen.getByRole('menuitem', { name: /Peindre ce code/ }));
    const banner = screen.getByRole('status');
    expect(banner.textContent).toContain('Peinture');
    expect(banner.textContent).toContain('CA');
    // Click two other cells: each receives CA, no menu opens
    fireEvent.click(cellSelector(container, '2026-06-10', 0, 1));
    expect(screen.queryByRole('menu')).toBeNull();
    let cell = cellSelector(container, '2026-06-10', 0, 1);
    expect(cell.className).toContain('st-absence');
    // Another mediator paints too
    fireEvent.click(cellSelector(container, '2026-06-10', 1, 0));
    cell = cellSelector(container, '2026-06-10', 1, 0);
    expect(cell.className).toContain('st-absence');
    expect(cell.textContent).toContain('CA');
  });

  it('Escape exits paint mode; the next click opens the menu again', () => {
    const { container } = renderAnnual();
    fireEvent.click(cellSelector(container, '2026-06-09', 0, 0));
    fireEvent.click(screen.getByRole('menuitem', { name: 'RHS' }));
    fireEvent.click(cellSelector(container, '2026-06-09', 0, 0));
    fireEvent.click(screen.getByRole('menuitem', { name: /Peindre ce code/ }));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('status')).toBeNull();
    fireEvent.click(cellSelector(container, '2026-06-11', 0, 0));
    expect(screen.getByRole('menu')).toBeTruthy();
  });

  it('a click outside the grid exits paint mode', () => {
    const { container } = renderAnnual();
    fireEvent.click(cellSelector(container, '2026-06-09', 0, 0));
    fireEvent.click(screen.getByRole('menuitem', { name: 'CA' }));
    fireEvent.click(cellSelector(container, '2026-06-09', 0, 0));
    fireEvent.click(screen.getByRole('menuitem', { name: /Peindre ce code/ }));
    fireEvent.mouseDown(screen.getByRole('heading', { name: /Tableau de fonctionnement/ }));
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('the banner ✕ Quitter button exits paint mode', () => {
    const { container } = renderAnnual();
    fireEvent.click(cellSelector(container, '2026-06-09', 0, 0));
    fireEvent.click(screen.getByRole('menuitem', { name: 'CA' }));
    fireEvent.click(cellSelector(container, '2026-06-09', 0, 0));
    fireEvent.click(screen.getByRole('menuitem', { name: /Peindre ce code/ }));
    fireEvent.click(screen.getByTitle(/Quitter le mode peinture/));
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('UX fix 4: exiting paint mode is side-effect free — the next cell click opens the menu, no stale paint', () => {
    const { container } = renderAnnual();
    // Enter paint mode with CA
    fireEvent.click(cellSelector(container, '2026-06-09', 0, 0));
    fireEvent.click(screen.getByRole('menuitem', { name: 'CA' }));
    fireEvent.click(cellSelector(container, '2026-06-09', 0, 0));
    fireEvent.click(screen.getByRole('menuitem', { name: /Peindre ce code/ }));
    expect(screen.getByRole('status')).toBeTruthy();
    // Exit via the banner button
    fireEvent.click(screen.getByTitle(/Quitter le mode peinture/));
    expect(screen.queryByRole('status')).toBeNull();
    // The very next click must OPEN THE MENU (paint cleared, nothing sticky)
    fireEvent.click(cellSelector(container, '2026-06-15', 0, 0));
    expect(screen.getByRole('menu')).toBeTruthy();
    // And that cell was NOT painted
    const cell = cellSelector(container, '2026-06-15', 0, 0);
    expect(cell.textContent).not.toContain('CA');
  });

  it('UX fix 4: the banner names the action (« Quitter la peinture ») and the painted code', () => {
    const { container } = renderAnnual();
    fireEvent.click(cellSelector(container, '2026-06-09', 0, 0));
    fireEvent.click(screen.getByRole('menuitem', { name: 'RHS' }));
    fireEvent.click(cellSelector(container, '2026-06-09', 0, 0));
    fireEvent.click(screen.getByRole('menuitem', { name: /Peindre ce code/ }));
    const banner = screen.getByRole('status');
    expect(banner.textContent).toContain('Peinture');
    expect(banner.textContent).toContain('RHS');
    expect(banner.textContent).toContain('Quitter la peinture');
  });

  it('each painted cell is one undoable operation (undo reverts cells one by one)', () => {
    // Full app: the ↶ undo button lives in the Header
    window.history.replaceState({}, '', '/?display=tableau');
    const { container } = render(<App />);
    const clickCell = (iso: string, mi: number, hi: 0 | 1) =>
      fireEvent.click(cellSelector(container, iso, mi, hi));
    clickCell('2026-06-09', 0, 0);
    fireEvent.click(screen.getByRole('menuitem', { name: 'CA' }));
    clickCell('2026-06-09', 0, 0);
    fireEvent.click(screen.getByRole('menuitem', { name: /Peindre ce code/ }));
    clickCell('2026-06-10', 0, 1);
    clickCell('2026-06-11', 0, 1);
    const undoBtn = document.getElementById('btn-undo') as HTMLButtonElement;
    expect(undoBtn.disabled).toBe(false);
    // Undo twice: both painted cells revert one by one
    fireEvent.click(undoBtn);
    let cell = cellSelector(container, '2026-06-11', 0, 1);
    expect(cell.className).not.toContain('st-absence');
    fireEvent.click(undoBtn);
    cell = cellSelector(container, '2026-06-10', 0, 1);
    expect(cell.className).not.toContain('st-absence');
    // The initial CA (pre-paint) is still there
    cell = cellSelector(container, '2026-06-09', 0, 0);
    expect(cell.textContent).toContain('CA');
  });
});
