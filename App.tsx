import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './src/contexts/AuthContext';
import { DarkModeProvider } from './src/contexts/DarkModeContext';
import ProtectedRoute from './src/components/ProtectedRoute';
import PWAPrompt from './src/components/PWAPrompt';
import ErrorBoundary from './src/components/ErrorBoundary';
import LoginPage from './src/pages/LoginPage';
import SignupPage from './src/pages/SignupPage';
import MainApp from './MainApp';

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <Router>
        <AuthProvider>
          <DarkModeProvider>
            <Toaster position="top-right" />
            <PWAPrompt />
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/signup" element={<SignupPage />} />
              <Route
                path="/*"
                element={
                  <ProtectedRoute>
                    <MainApp />
                  </ProtectedRoute>
                }
              />
            </Routes>
          </DarkModeProvider>
        </AuthProvider>
      </Router>
    </ErrorBoundary>
  );
};

export default App;
