// data-context-history.test.tsx — DataContext history metadata (labels at
// commit time) and the undo/redo contract after labeled commits
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { DataProvider, useData, useCRUD, ACTION_LABELS } from '../src/presentation/DataContext';
import type { AppData, Slot, Mediator, Offer, Absence } from '../src/domain/types';

// Minimal data set: one mediator, one offer, one slot
const mockMediator: Mediator = {
  id: 'm1', lastName: 'Dupont', firstName: 'Jean', email: '', phone: '',
  notes: '', color: '#FF0000', active: true, competences: [],
};
const mockOffer: Offer = {
  id: 'o1', name: 'Visite guidée', description: '', duration: 60, capacity: 20,
  location: 'Salle 1', setupTime: 10, teardownTime: 10,
  welcomeType: 'Réservable encadrée par médiateur',
};
const mockSlot: Slot = {
  id: 's1', scheduleId: 'sched1', offerId: 'o1', mediatorIds: ['m1'],
  date: '2026-10-12', startTime: '10:00', endTime: '11:00', participantCount: 15,
  status: 'planned', notes: '', origin: 'manual', importSource: '', importedAt: '',
  modifiedAfterImport: false, groupName: '', guide: '', location: '',
  groupNature: '', contactName: '', contactPhone: '', contactEmail: '',
};
const mockAbsence: Absence = {
  id: 'a1', mediatorId: 'm1', startDate: '2026-10-13', endDate: '2026-10-13',
  halfDay: 'none', type: 'leave', notes: '',
};

const mockData: AppData = {
  mediators: [mockMediator],
  offers: [mockOffer],
  schedules: [],
  slots: [mockSlot],
  absences: [],
};

// Probe exposing the context + CRUD to the assertions
function Probe() {
  const { state, undo, redo, getHistoryEntries, commit } = useData();
  const crud = useCRUD();
  return (
    <div>
      <div data-testid="slot-count">{state.data.slots.length}</div>
      <div data-testid="mediator-count">{state.data.mediators.length}</div>
      <div data-testid="labels">{getHistoryEntries().map((e) => e.label).join('|')}</div>
      <div data-testid="entry-count">{getHistoryEntries().length}</div>
      <button data-testid="btn-undo" onClick={undo}>undo</button>
      <button data-testid="btn-redo" onClick={redo}>redo</button>
      <button
        data-testid="btn-update-slot"
        onClick={() => crud({ type: 'UPDATE_SLOT', slot: { ...mockSlot, status: 'confirmed' } })}
      >
        update slot
      </button>
      <button
        data-testid="btn-delete-slot"
        onClick={() => crud({ type: 'DELETE_SLOT', id: mockSlot.id })}
      >
        delete slot
      </button>
      <button
        data-testid="btn-add-mediator"
        onClick={() => crud({ type: 'ADD_MEDIATOR', mediator: { ...mockMediator, id: 'm2' } })}
      >
        add mediator
      </button>
      <button
        data-testid="btn-add-offer"
        onClick={() => crud({ type: 'ADD_OFFER', offer: { ...mockOffer, id: 'o2' } })}
      >
        add offer
      </button>
      <button
        data-testid="btn-add-absence"
        onClick={() => crud({ type: 'ADD_ABSENCE', absence: mockAbsence })}
      >
        add absence
      </button>
      <button
        data-testid="btn-commit-labeled"
        onClick={() =>
          commit(
            { ...mockData, slots: [...mockData.slots, { ...mockSlot, id: 's2' }] },
            'Import Secutix'
          )
        }
      >
        labeled commit
      </button>
    </div>
  );
}

function renderApp() {
  return render(
    <DataProvider>
      <Probe />
    </DataProvider>
  );
}

describe('DataContext history metadata', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => JSON.stringify(mockData)),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    });
    window.history.replaceState({}, '', '/');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('initializes history with one unlabeled-default entry on mount', () => {
    renderApp();
    expect(screen.getByTestId('entry-count').textContent).toBe('1');
    expect(screen.getByTestId('labels').textContent).toBe('Modification');
  });

  it('commits CRUD actions with a French action label', () => {
    renderApp();
    act(() => { screen.getByTestId('btn-update-slot').click(); });
    expect(screen.getByTestId('labels').textContent).toBe('Modification|Créneau modifié');

    act(() => { screen.getByTestId('btn-delete-slot').click(); });
    expect(screen.getByTestId('labels').textContent).toBe(
      'Modification|Créneau modifié|Créneau supprimé'
    );

    act(() => { screen.getByTestId('btn-add-mediator').click(); });
    act(() => { screen.getByTestId('btn-add-offer').click(); });
    act(() => { screen.getByTestId('btn-add-absence').click(); });
    expect(screen.getByTestId('labels').textContent).toBe(
      'Modification|Créneau modifié|Créneau supprimé|Médiateur ajouté|Offre ajoutée|Absence ajoutée'
    );
  });

  it('passes an explicit label through commit', () => {
    renderApp();
    act(() => { screen.getByTestId('btn-commit-labeled').click(); });
    expect(screen.getByTestId('labels').textContent).toBe('Modification|Import Secutix');
  });

  it('undo/redo still work after labeled commits (contract)', () => {
    renderApp();
    expect(screen.getByTestId('slot-count').textContent).toBe('1');
    act(() => { screen.getByTestId('btn-delete-slot').click(); });
    expect(screen.getByTestId('slot-count').textContent).toBe('0');
    act(() => { screen.getByTestId('btn-undo').click(); });
    expect(screen.getByTestId('slot-count').textContent).toBe('1');
    act(() => { screen.getByTestId('btn-redo').click(); });
    expect(screen.getByTestId('slot-count').textContent).toBe('0');
    // Undo twice more crosses only labeled entries
    act(() => { screen.getByTestId('btn-undo').click(); });
    expect(screen.getByTestId('slot-count').textContent).toBe('1');
    expect(screen.getByTestId('entry-count').textContent).toBe('2');
  });

  it('exposes a centralized action-type to label map covering all CRUD actions', () => {
    const expected: Array<[string, string]> = [
      ['ADD_MEDIATOR', 'Médiateur ajouté'],
      ['UPDATE_MEDIATOR', 'Médiateur modifié'],
      ['DELETE_MEDIATOR', 'Médiateur supprimé'],
      ['ADD_OFFER', 'Offre ajoutée'],
      ['UPDATE_OFFER', 'Offre modifiée'],
      ['DELETE_OFFER', 'Offre supprimée'],
      ['ADD_SLOT', 'Créneau créé'],
      ['UPDATE_SLOT', 'Créneau modifié'],
      ['DELETE_SLOT', 'Créneau supprimé'],
      ['ADD_ABSENCE', 'Absence ajoutée'],
      ['UPDATE_ABSENCE', 'Absence modifiée'],
      ['DELETE_ABSENCE', 'Absence supprimée'],
    ];
    for (const [type, label] of expected) {
      expect(ACTION_LABELS[type]).toBe(label);
    }
  });
});
