import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '../lib/supabase';

interface DarkModeContextType {
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  setDarkMode: (value: boolean) => void;
}

const DarkModeContext = createContext<DarkModeContextType | undefined>(undefined);

interface DarkModeProviderProps {
  children: ReactNode;
}

export const DarkModeProvider: React.FC<DarkModeProviderProps> = ({ children }) => {
  const { userProfile, user } = useAuth();
  const [isDarkMode, setIsDarkModeState] = useState(false);

  // Load dark mode preference from user profile
  useEffect(() => {
    if (userProfile?.notification_preferences) {
      const prefs = userProfile.notification_preferences as any;
      const darkModePreference = prefs.darkMode ?? false;
      setIsDarkModeState(darkModePreference);

      // Apply dark mode class to document
      if (darkModePreference) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  }, [userProfile]);

  const setDarkMode = async (value: boolean) => {
    setIsDarkModeState(value);

    // Apply or remove dark mode class
    if (value) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    // Save to database
    if (user && userProfile) {
      try {
        const currentPrefs = (userProfile.notification_preferences as any) || {};
        const updatedPrefs = { ...currentPrefs, darkMode: value };

        await supabase
          .from('user_profiles')
          .update({ notification_preferences: updatedPrefs })
          .eq('id', user.id);
      } catch (error) {
        console.error('Error saving dark mode preference:', error);
      }
    }
  };

  const toggleDarkMode = () => {
    setDarkMode(!isDarkMode);
  };

  return (
    <DarkModeContext.Provider value={{ isDarkMode, toggleDarkMode, setDarkMode }}>
      {children}
    </DarkModeContext.Provider>
  );
};

export const useDarkMode = (): DarkModeContextType => {
  const context = useContext(DarkModeContext);
  if (context === undefined) {
    throw new Error('useDarkMode must be used within a DarkModeProvider');
  }
  return context;
};
