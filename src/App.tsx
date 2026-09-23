// App.tsx — Root component: composes header + view router

import { useState } from 'react';
import { DataProvider, useData } from './presentation/DataContext';
import useKeyboardShortcuts from './presentation/useKeyboardShortcuts';
import Header from './presentation/Header';
import HistoryPanel from './presentation/HistoryPanel';
import WeeklyView from './presentation/WeeklyView';
import DailyView from './presentation/DailyView';
import ReservationView from './presentation/ReservationView';
import MediatorsView from './presentation/MediatorsView';
import OffersView from './presentation/OffersView';
import AbsencesView from './presentation/AbsencesView';
import StatsView from './presentation/StatsView';
import ImportExportView from './presentation/ImportExportView';
import StatusBar from './presentation/StatusBar';

function ViewRouter() {
  const { state } = useData();
  // Global keyboard shortcuts, mounted once inside the provider
  useKeyboardShortcuts();

  switch (state.currentView) {
    case 'weekly':
      return <WeeklyView />;
    case 'daily':
      return <DailyView />;
    case 'reservations':
      return <ReservationView />;
    case 'mediators':
      return <MediatorsView />;
    case 'offers':
      return <OffersView />;
    case 'absences':
      return <AbsencesView />;
    case 'stats':
      return <StatsView />;
    case 'import-export':
      return <ImportExportView />;
    default:
      return <DailyView />;
  }
}

function App() {
  // History panel open state — the Header button and the H shortcut both
  // toggle it (the shortcut clicks the button, like the N shortcut does).
  const [historyOpen, setHistoryOpen] = useState(false);

  return (
    <DataProvider>
      <Header onToggleHistory={() => setHistoryOpen((open) => !open)} />
      <main className="app-main">
        <ViewRouter />
      </main>
      {historyOpen && <HistoryPanel onClose={() => setHistoryOpen(false)} />}
      <StatusBar />
    </DataProvider>
  );
}

export default App;
