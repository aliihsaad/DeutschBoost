import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './src/contexts/AuthContext';
import ProtectedRoute from './src/components/ProtectedRoute';
import LoginPage from './src/pages/LoginPage';
import SignupPage from './src/pages/SignupPage';
import MainApp from './MainApp';

const App: React.FC = () => {
  return (
    <Router>
      <AuthProvider>
        <Toaster position="top-right" />
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
      </AuthProvider>
    </Router>
  );
};

export default App;
