import React from 'react';
import { HashRouter as Router, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import Layout from './components/Layout';
import HomeScreen from './screens/HomeScreen';
import DocumentsScreen from './screens/DocumentsScreen';
import RevisionScreen from './screens/RevisionScreen';
import ChatScreen from './screens/ChatScreen';
import StatsScreen from './screens/StatsScreen';
import { LanguageProvider } from './contexts/LanguageContext';

const AppContent: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // Map path to tab ID
  const getTabFromPath = (path: string) => {
    if (path === '/' || path === '/home') return 'home';
    return path.substring(1); // remove leading slash
  };

  const currentTab = getTabFromPath(location.pathname);

  const handleTabChange = (tab: string) => {
    if (tab === 'home') navigate('/');
    else navigate(`/${tab}`);
  };

  return (
    <Layout activeTab={currentTab} onTabChange={handleTabChange}>
      <Routes>
        <Route path="/" element={<HomeScreen onNavigate={handleTabChange} />} />
        <Route path="/docs" element={<DocumentsScreen />} />
        <Route path="/revise" element={<RevisionScreen />} />
        <Route path="/chat" element={<ChatScreen />} />
        <Route path="/stats" element={<StatsScreen />} />
      </Routes>
    </Layout>
  );
};

const App: React.FC = () => {
  return (
    <LanguageProvider>
      <Router>
        <AppContent />
      </Router>
    </LanguageProvider>
  );
};

export default App;