// App.tsx — Root component: composes header + view router

import { DataProvider, useData } from './presentation/DataContext';
import Header from './presentation/Header';
import CalendarView from './presentation/CalendarView';
import MediatorsView from './presentation/MediatorsView';
import OffersView from './presentation/OffersView';
import AbsencesView from './presentation/AbsencesView';
import ImportExportView from './presentation/ImportExportView';

function ViewRouter() {
  const { state } = useData();

  switch (state.currentView) {
    case 'calendar':
      return <CalendarView />;
    case 'mediators':
      return <MediatorsView />;
    case 'offers':
      return <OffersView />;
    case 'absences':
      return <AbsencesView />;
    case 'import-export':
      return <ImportExportView />;
    default:
      return <CalendarView />;
  }
}

function App() {
  return (
    <DataProvider>
      <Header />
      <main className="app-main">
        <ViewRouter />
      </main>
    </DataProvider>
  );
}

export default App;
