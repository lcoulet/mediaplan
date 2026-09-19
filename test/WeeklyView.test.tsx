// WeeklyView.test.tsx — Tests pour la vue "Plan Hebdo"
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import WeeklyView from '../src/presentation/WeeklyView';
import { DataProvider } from '../src/presentation/DataContext';
import type { AppData } from '../domain/types';

// Mock des données de test
const mockData: AppData = {
  mediators: [
    { id: 'm1', firstName: 'Jean', lastName: 'Dupont', email: '', phone: '', notes: '', color: '#FF0000', active: true, skills: [] },
    { id: 'm2', firstName: 'Marie', lastName: 'Martin', email: '', phone: '', notes: '', color: '#00FF00', active: true, skills: [] },
  ],
  offers: [
    { id: 'o1', name: 'Visite guidée', description: '', duration: 60, capacity: 20, location: 'Salle 1', setupTime: 10, teardownTime: 10 },
  ],
  slots: [
    { id: 's1', date: '2026-09-15', startTime: '10:00', endTime: '12:00', offerId: 'o1', mediatorIds: ['m1'], status: 'planned', origin: 'manual', scheduleId: '', participantCount: 0, notes: '', importSource: '', importedAt: '', modifiedAfterImport: false },
  ],
  absences: [],
  schedule: { locked: false, weekStart: new Date('2026-09-14') },
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
});
