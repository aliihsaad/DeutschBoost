import React, { useState, useEffect } from 'react';
import Card from '../components/Card';
import { CEFRLevel } from '../types';
import { useAuth } from '../src/contexts/AuthContext';
import toast from 'react-hot-toast';

interface ProfilePageProps {
  userLevel: CEFRLevel;
}

const ProfilePage: React.FC<ProfilePageProps> = ({ userLevel }) => {
  const { user, userData, userProfile, updateProfile } = useAuth();
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    if (userProfile?.notification_preferences) {
      const prefs = userProfile.notification_preferences as any;
      setEmailNotifications(prefs.email ?? true);
      setDarkMode(prefs.darkMode ?? false);
    }
  }, [userProfile]);

  const handleToggleNotifications = async (checked: boolean) => {
    setEmailNotifications(checked);
    const { error } = await updateProfile({
      notification_preferences: {
        email: checked,
        darkMode,
      },
    });

    if (error) {
      toast.error('Failed to update settings');
      setEmailNotifications(!checked); // Revert
    } else {
      toast.success('Settings updated');
    }
  };

  const handleToggleDarkMode = async (checked: boolean) => {
    setDarkMode(checked);
    const { error } = await updateProfile({
      notification_preferences: {
        email: emailNotifications,
        darkMode: checked,
      },
    });

    if (error) {
      toast.error('Failed to update settings');
      setDarkMode(!checked); // Revert
    } else {
      toast.success('Settings updated');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      <div className="container mx-auto p-4 md:p-8 space-y-8">
        {/* Header Section */}
        <Card glass hover className="backdrop-blur-xl border-2 border-white/30 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-blue-400/20 to-purple-400/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
          <div className="relative z-10">
            <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-gray-800 via-gray-700 to-gray-600 bg-clip-text text-transparent mb-2">
              Profile & Settings
            </h1>
            <p className="text-gray-600 text-lg font-medium">Manage your account and learning preferences.</p>
          </div>
        </Card>

        <div className="max-w-4xl mx-auto space-y-6">
          {/* Profile Information Card */}
          <Card glass hover className="backdrop-blur-xl border-2 border-white/30 relative overflow-hidden">
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-br from-indigo-400/20 to-blue-400/20 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2"></div>
            <div className="relative z-10">
              <div className="flex flex-col md:flex-row items-center md:items-start space-y-6 md:space-y-0 md:space-x-8">
                {userData?.avatar_url ? (
                  <img
                    src={userData.avatar_url}
                    alt="Profile"
                    className="w-32 h-32 rounded-2xl object-cover shadow-xl border-4 border-white/50"
                  />
                ) : (
                  <div className="w-32 h-32 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-6xl text-white font-bold shadow-xl border-4 border-white/50">
                    {userData?.full_name?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="flex-grow text-center md:text-left">
                  <div className="flex flex-col md:flex-row md:items-center md:space-x-4">
                    <h2 className="text-3xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
                      {userData?.full_name || 'User'}
                    </h2>
                    {userData?.subscription_tier === 'premium' && (
                      <span className="inline-block mt-2 md:mt-0 px-4 py-1.5 bg-gradient-to-r from-amber-400 to-orange-500 text-white text-xs font-bold rounded-full shadow-md">
                        PREMIUM
                      </span>
                    )}
                  </div>
                  <p className="text-gray-600 text-lg font-medium mt-2">{user?.email}</p>
                  <p className="text-gray-500 font-medium mt-1">
                    Joined: {userData?.created_at ? formatDate(userData.created_at) : 'Recently'}
                  </p>
                  <div className="mt-4 inline-block">
                    <div className="px-5 py-2.5 bg-gradient-to-r from-blue-100 to-indigo-100 rounded-xl border-2 border-blue-200/50">
                      <span className="text-sm font-bold text-gray-700">Current Level: </span>
                      <span className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                        {userProfile?.current_level || userLevel}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* Learning Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card hover className="relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-orange-400 to-red-500 opacity-100 group-hover:opacity-90 transition-opacity"></div>
              <div className="relative z-10 flex flex-col items-center justify-center text-white py-6">
                <span className="text-lg font-bold mb-2">Study Streak</span>
                <div className="flex items-center space-x-2">
                  <span className="text-6xl">🔥</span>
                  <span className="text-6xl font-bold">{userProfile?.study_streak || 0}</span>
                </div>
                <span className="text-sm opacity-90 font-medium mt-2">days in a row</span>
              </div>
            </Card>

            <Card hover className="relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-indigo-600 opacity-100 group-hover:opacity-90 transition-opacity"></div>
              <div className="relative z-10 flex flex-col items-center justify-center text-white py-6">
                <span className="text-lg font-bold mb-2">Total Study Time</span>
                <span className="text-6xl font-bold mb-2">
                  {Math.round((userProfile?.total_study_time || 0) / 60)}
                </span>
                <span className="text-sm opacity-90 font-medium">hours of learning</span>
              </div>
            </Card>

            {userProfile?.target_level && (
              <Card hover className="relative overflow-hidden group md:col-span-2">
                <div className="absolute inset-0 bg-gradient-to-br from-green-500 to-emerald-600 opacity-100 group-hover:opacity-90 transition-opacity"></div>
                <div className="relative z-10 flex flex-col items-center justify-center text-white py-6">
                  <span className="text-lg font-bold mb-2">Target Level</span>
                  <span className="text-6xl font-bold mb-2">{userProfile.target_level}</span>
                  {userProfile.target_exam_date && (
                    <span className="text-sm opacity-90 font-medium">
                      Exam Date: {new Date(userProfile.target_exam_date).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </span>
                  )}
                </div>
              </Card>
            )}
          </div>

          {/* Settings Card */}
          <Card glass hover className="backdrop-blur-xl border-2 border-white/30">
            <h3 className="text-2xl font-bold mb-6 bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
              Settings
            </h3>
            <div className="space-y-6">
              <div className="flex justify-between items-center p-5 bg-white/60 rounded-xl border-2 border-white/40 hover:bg-white/80 hover:border-blue-200/50 transition-all duration-300">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center shadow-md">
                    <i className="fa-solid fa-envelope text-white text-xl"></i>
                  </div>
                  <div>
                    <label htmlFor="notifications" className="font-bold text-gray-800 text-lg cursor-pointer">
                      Email Notifications
                    </label>
                    <p className="text-sm text-gray-600 font-medium">Receive updates about your learning progress</p>
                  </div>
                </div>
                <div className="relative inline-block w-14 h-8 mr-2 align-middle select-none transition duration-200 ease-in">
                  <input
                    type="checkbox"
                    name="notifications"
                    id="notifications"
                    checked={emailNotifications}
                    onChange={(e) => handleToggleNotifications(e.target.checked)}
                    className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer transition-all duration-300 shadow-md"
                  />
                  <label
                    htmlFor="notifications"
                    className="toggle-label block overflow-hidden h-8 rounded-full bg-gray-300 cursor-pointer transition-all duration-300"
                  ></label>
                </div>
              </div>

              <div className="flex justify-between items-center p-5 bg-white/60 rounded-xl border-2 border-white/40 hover:bg-white/80 hover:border-purple-200/50 transition-all duration-300">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-md">
                    <i className="fa-solid fa-moon text-white text-xl"></i>
                  </div>
                  <div>
                    <label htmlFor="darkMode" className="font-bold text-gray-800 text-lg cursor-pointer">
                      Dark Mode
                    </label>
                    <p className="text-sm text-gray-600 font-medium">Coming soon - switch to dark theme</p>
                  </div>
                </div>
                <div className="relative inline-block w-14 h-8 mr-2 align-middle select-none transition duration-200 ease-in">
                  <input
                    type="checkbox"
                    name="darkMode"
                    id="darkMode"
                    checked={darkMode}
                    onChange={(e) => handleToggleDarkMode(e.target.checked)}
                    className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer transition-all duration-300 shadow-md"
                  />
                  <label
                    htmlFor="darkMode"
                    className="toggle-label block overflow-hidden h-8 rounded-full bg-gray-300 cursor-pointer transition-all duration-300"
                  ></label>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
      <style>{`
        .toggle-checkbox:checked {
          right: 0;
          border-color: #2563eb;
          transform: translateX(24px);
        }
        .toggle-checkbox:checked + .toggle-label {
          background-color: #2563eb;
        }
        .toggle-checkbox {
          left: 0;
        }
      `}</style>
    </div>
  );
};

export default ProfilePage;