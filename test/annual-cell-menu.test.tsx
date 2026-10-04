// test/annual-cell-menu.test.tsx — Annual view slice 4 (cell editing):
// the half-day cell CONTEXT MENU component — code chips, free text with
// decoded suggestions, clear (« retour au dérivé »), museum-closed alert,
// keyboard access (focusable items, Escape closes).
// Spec: test/features/annual-view/annual-editing.feature (menu contextuel,
// jours de fermeture scenarios); mockup annual-editing.html state (1)+(3).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AnnualCellMenu from '../src/presentation/AnnualCellMenu';

const baseTarget = { mediatorId: 'm_alice', mediatorName: 'Alice Dupont', date: '2026-06-09', halfDay: 'morning' as const };
const noop = () => {};

function renderMenu(props: Partial<Parameters<typeof AnnualCellMenu>[0]> = {}) {
  return render(
    <AnnualCellMenu
      target={baseTarget}
      onPickCode={noop}
      onPickFreeText={noop}
      onClear={noop}
      onPaint={noop}
      paintCode="CA"
      onClose={noop}
      {...props}
    />
  );
}

describe('AnnualCellMenu (context menu)', () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
  });

  it('renders the mediator + date + half-day in the menu head', () => {
    renderMenu();
    const menu = screen.getByRole('menu');
    expect(menu.getAttribute('aria-label')).toContain('Alice Dupont');
    expect(menu.getAttribute('aria-label')).toContain('09/06/2026');
    expect(menu.getAttribute('aria-label')).toContain('Matin');
  });

  it('offers every catalog code chip (CA, RHS, AM, TELE, amgt, Réf. WE, CEX, TPT)', () => {
    renderMenu();
    for (const code of ['CA', 'RHS', 'AM', 'TELE', 'amgt', 'Réf. WE', 'CEX', 'TPT']) {
      expect(screen.getByRole('menuitem', { name: code }), code).toBeTruthy();
    }
  });

  it('offers the « Souhait » chip storing a pending leave request (leave_request)', () => {
    renderMenu();
    expect(screen.getByRole('menuitem', { name: /Souhait/ })).toBeTruthy();
  });

  it('picks a code: onPickCode fires with the code and closes the menu', () => {
    const onPickCode = vi.fn();
    const onClose = vi.fn();
    renderMenu({ onPickCode, onClose });
    fireEvent.click(screen.getByRole('menuitem', { name: 'CA' }));
    expect(onPickCode).toHaveBeenCalledWith('CA');
    expect(onClose).toHaveBeenCalled();
  });

  it('offers free text with decoded-code suggestions', () => {
    renderMenu();
    const input = screen.getByLabelText(/Texte libre/i);
    expect(input).toBeTruthy();
    // Decoded suggestions as buttons
    expect(screen.getByTitle('Congé annuel')).toBeTruthy();
    expect(screen.getByTitle('Mission Jardins du muséum')).toBeTruthy();
  });

  it('submits free text with OK: onPickFreeText fires with the trimmed value', () => {
    const onPickFreeText = vi.fn();
    const onClose = vi.fn();
    renderMenu({ onPickFreeText, onClose });
    const input = screen.getByLabelText(/Texte libre/i);
    fireEvent.change(input, { target: { value: '  Stop Motion ' } });
    fireEvent.click(screen.getByRole('button', { name: 'OK' }));
    expect(onPickFreeText).toHaveBeenCalledWith('Stop Motion');
    expect(onClose).toHaveBeenCalled();
  });

  it('submits free text with Enter, and a suggestion click fills the input then commits', () => {
    const onPickFreeText = vi.fn();
    renderMenu({ onPickFreeText });
    const input = screen.getByLabelText(/Texte libre/i);
    fireEvent.change(input, { target: { value: 'Montréal' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onPickFreeText).toHaveBeenCalledWith('Montréal');
    // Suggestion chip = one click commits the suggestion itself
    const sugg = screen.getByTitle('Congé annuel');
    fireEvent.click(sugg);
    expect(onPickFreeText).toHaveBeenCalledWith('CA');
  });

  it('blank free text submits nothing (no commit, menu stays open)', () => {
    const onPickFreeText = vi.fn();
    const onClose = vi.fn();
    renderMenu({ onPickFreeText, onClose });
    fireEvent.click(screen.getByRole('button', { name: 'OK' }));
    expect(onPickFreeText).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('offers « Effacer (retour au dérivé) » and fires onClear', () => {
    const onClear = vi.fn();
    const onClose = vi.fn();
    renderMenu({ onClear, onClose });
    fireEvent.click(screen.getByRole('menuitem', { name: /Effacer/ }));
    expect(onClear).toHaveBeenCalledWith(baseTarget);
    expect(onClose).toHaveBeenCalled();
  });

  it('shows the non-blocking museum-closed alert on closed days, editing still possible', () => {
    const onPickCode = vi.fn();
    renderMenu({ target: { ...baseTarget, date: '2026-12-25' }, onPickCode });
    expect(screen.getByRole('alert').textContent).toContain('Le musée est fermé ce jour-là');
    // Editing remains possible: the chips are present and clickable
    fireEvent.click(screen.getAllByRole('menuitem', { name: 'CA' })[0]);
    expect(onPickCode).toHaveBeenCalledWith('CA');
  });

  it('shows no museum-closed alert on an ordinary day', () => {
    renderMenu();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('keyboard access: Escape closes the menu without committing', () => {
    const onClose = vi.fn();
    const onPickCode = vi.fn();
    renderMenu({ onClose, onPickCode });
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
    expect(onPickCode).not.toHaveBeenCalled();
  });

  it('keyboard access: menu items are focusable in order (chips, input, OK, foot items)', () => {
    const { container } = renderMenu();
    const focusables = container.querySelectorAll<HTMLElement>('.acm button, .acm input');
    expect(focusables.length).toBeGreaterThanOrEqual(12);
    for (const el of focusables) {
      expect(['BUTTON', 'INPUT']).toContain(el.tagName);
      // All items reach the keyboard: no tabIndex={-1} opt-outs
      expect(el.getAttribute('tabindex')).not.toBe('-1');
    }
  });

  // ---- UX fixes 2026-10-04 -------------------------------------------------

  it('UX fix 2: the head has a visible « Fermer le menu » button that closes without committing', () => {
    const onClose = vi.fn();
    const onPickCode = vi.fn();
    renderMenu({ onClose, onPickCode });
    const closeBtn = screen.getByRole('button', { name: 'Fermer le menu' });
    expect(closeBtn.textContent).toBe('✕');
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onPickCode).not.toHaveBeenCalled();
  });
});
