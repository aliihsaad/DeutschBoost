import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import ErrorBoundary from './src/components/ErrorBoundary';
import MainApp from './MainApp';

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <Router>
        <Toaster position="top-right" />
        <Routes>
          <Route path="/*" element={<MainApp />} />
        </Routes>
      </Router>
    </ErrorBoundary>
  );
};

export default App;
