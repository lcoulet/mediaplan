// App.tsx — Root component: composes header + view router

import { useState, useEffect } from 'react';
import { DataProvider, useData } from './presentation/DataContext';
import Header from './presentation/Header';
import WeeklyView from './presentation/WeeklyView';
import DailyView from './presentation/DailyView';
import MediatorsView from './presentation/MediatorsView';
import OffersView from './presentation/OffersView';
import AbsencesView from './presentation/AbsencesView';
import ImportExportView from './presentation/ImportExportView';
import UserGuideModal from './presentation/UserGuideModal';

function ViewRouter() {
  const { state, dispatch } = useData();

  // Handle URL routing for view changes
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const viewParam = urlParams.get('view');
    
    // Map URL view to our view names
    const viewMap: Record<string, any> = {
      'jour': 'daily',
      'journee': 'daily',
      'day': 'daily',
      'hebdo': 'weekly',
      'week': 'weekly',
      'semaine': 'weekly',
      'mediateurs': 'mediators',
      'offres': 'offers',
      'absences': 'absences',
      'import-export': 'import-export',
    };
    
    if (viewParam && viewMap[viewParam] && viewMap[viewParam] !== state.currentView) {
      dispatch({ type: 'SET_VIEW', view: viewMap[viewParam] });
    }
  }, [dispatch, state.currentView]);

  switch (state.currentView) {
    case 'weekly':
      return <WeeklyView />;
    case 'daily':
      return <DailyView />;
    case 'mediators':
      return <MediatorsView />;
    case 'offers':
      return <OffersView />;
    case 'absences':
      return <AbsencesView />;
    case 'import-export':
      return <ImportExportView />;
    default:
      return <DailyView />;
  }
}

function App() {
  const [showUserGuide, setShowUserGuide] = useState(false);

  const handleOpenUserGuide = () => {
    console.log('handleOpenUserGuide called from App');
    setShowUserGuide(true);
  };

  return (
    <DataProvider>
      <Header onOpenUserGuide={handleOpenUserGuide} />
      <main className="app-main">
        <ViewRouter />
      </main>
      {showUserGuide && <UserGuideModal onClose={() => setShowUserGuide(false)} />}
    </DataProvider>
  );
}

export default App;
