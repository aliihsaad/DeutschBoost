import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session, AuthError } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { Database } from '../types/database.types';

type UserProfile = Database['public']['Tables']['user_profiles']['Row'];
type UserData = Database['public']['Tables']['users']['Row'];

interface AuthContextType {
  user: User | null;
  userData: UserData | null;
  userProfile: UserProfile | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, fullName?: string) => Promise<{ error: AuthError | null }>;
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signInWithGoogle: () => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<{ error: AuthError | null }>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<{ error: Error | null }>;
  updateUserData: (updates: Partial<UserData>) => Promise<{ error: Error | null }>;
  refreshUserData: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch user data and profile from database
  const fetchUserData = async (userId: string) => {
    try {
      console.log('Fetching user data and profile for:', userId);

      // Fetch both in parallel without timeout (Supabase has its own timeout)
      const [userDataResult, profileResult] = await Promise.all([
        supabase.from('users').select('*').eq('id', userId).single(),
        supabase.from('user_profiles').select('*').eq('id', userId).single()
      ]);

      console.log('Fetch results:', {
        userData: userDataResult.error ? `Error: ${userDataResult.error.message}` : 'Success',
        profile: profileResult.error ? `Error: ${profileResult.error.message}` : 'Success'
      });

      if (userDataResult.error) {
        console.error('Error fetching user data:', userDataResult.error);
        // Don't throw, just continue - user might not have profile yet
      } else {
        console.log('User data loaded:', userDataResult.data);
        setUserData(userDataResult.data);
      }

      if (profileResult.error) {
        console.error('Error fetching user profile:', profileResult.error);
        // Don't throw, just continue - profile might not exist yet
      } else {
        console.log('User profile loaded:', profileResult.data);
        setUserProfile(profileResult.data);
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
      // Don't rethrow - we want to continue loading the app
    }
  };

  // Initialize auth state
  useEffect(() => {
    let isMounted = true;
    let loadingTimeout: NodeJS.Timeout;

    const initializeAuth = async () => {
      try {
        console.log('Initializing auth...');

        // Set a timeout to force loading to false after 10 seconds
        loadingTimeout = setTimeout(() => {
          if (isMounted) {
            console.warn('Auth initialization timeout - forcing loading to false');
            setLoading(false);
          }
        }, 10000);

        const { data: { session }, error } = await supabase.auth.getSession();

        console.log('Auth session result:', {
          hasSession: !!session,
          hasUser: !!session?.user,
          error: error?.message
        });

        if (!isMounted) return;

        if (error) {
          console.error('Error getting session:', error);
          setLoading(false);
          clearTimeout(loadingTimeout);
          return;
        }

        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          console.log('Fetching user data for:', session.user.id);
          await fetchUserData(session.user.id);
        } else {
          console.log('No session - user not logged in');
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
      } finally {
        if (isMounted) {
          clearTimeout(loadingTimeout);
          setLoading(false);
          console.log('Auth initialization complete');
        }
      }
    };

    initializeAuth();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!isMounted) return;

      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        await fetchUserData(session.user.id);
      } else {
        setUserData(null);
        setUserProfile(null);
      }
    });

    return () => {
      isMounted = false;
      clearTimeout(loadingTimeout);
      subscription.unsubscribe();
    };
  }, []);

  // Sign up with email and password
  const signUp = async (email: string, password: string, fullName?: string) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
        },
      });

      if (error) return { error };

      // Update full_name in users table if provided
      if (data.user && fullName) {
        await supabase
          .from('users')
          .update({ full_name: fullName })
          .eq('id', data.user.id);
      }

      return { error: null };
    } catch (error) {
      return { error: error as AuthError };
    }
  };

  // Sign in with email and password
  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      return { error };
    } catch (error) {
      return { error: error as AuthError };
    }
  };

  // Sign in with Google OAuth
  const signInWithGoogle = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/`,
        },
      });

      return { error };
    } catch (error) {
      return { error: error as AuthError };
    }
  };

  // Sign out
  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (!error) {
        setUserData(null);
        setUserProfile(null);
      }
      return { error };
    } catch (error) {
      return { error: error as AuthError };
    }
  };

  // Update user profile
  const updateProfile = async (updates: Partial<UserProfile>, skipRefresh = false) => {
    if (!user) return { error: new Error('No user logged in') };

    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', user.id);

      if (error) throw error;

      // Refresh user data unless skipped
      if (!skipRefresh) {
        await fetchUserData(user.id);
      }

      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  // Update user data (users table)
  const updateUserData = async (updates: Partial<UserData>, skipRefresh = false) => {
    if (!user) return { error: new Error('No user logged in') };

    try {
      const { error } = await supabase
        .from('users')
        .update(updates)
        .eq('id', user.id);

      if (error) throw error;

      // Refresh user data unless skipped
      if (!skipRefresh) {
        await fetchUserData(user.id);
      }

      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  // Refresh user data manually
  const refreshUserData = async () => {
    if (user) {
      await fetchUserData(user.id);
    }
  };

  const value = {
    user,
    userData,
    userProfile,
    session,
    loading,
    signUp,
    signIn,
    signInWithGoogle,
    signOut,
    updateProfile,
    updateUserData,
    refreshUserData,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
