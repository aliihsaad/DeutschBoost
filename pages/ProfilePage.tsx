import React, { useState, useEffect } from 'react';
import Card from '../components/Card';
import { CEFRLevel } from '../types';
import { useAuth } from '../contexts/AuthContext';
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
    <div className="container mx-auto p-8">
      <header className="mb-8">
        <h1 className="text-4xl font-bold">Profile & Settings</h1>
        <p className="text-gray-600 mt-2">Manage your account and learning preferences.</p>
      </header>
      <Card className="max-w-2xl mx-auto">
        <div className="flex items-center space-x-6">
          {userData?.avatar_url ? (
            <img
              src={userData.avatar_url}
              alt="Profile"
              className="w-24 h-24 rounded-full object-cover"
            />
          ) : (
            <div className="w-24 h-24 rounded-full bg-blue-500 flex items-center justify-center text-4xl text-white font-bold">
              {userData?.full_name?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <h2 className="text-2xl font-bold">{userData?.full_name || 'User'}</h2>
            <p className="text-gray-600">{user?.email}</p>
            <p className="text-gray-500 text-sm">
              Joined: {userData?.created_at ? formatDate(userData.created_at) : 'Recently'}
            </p>
            <p className="mt-2 text-lg font-semibold">
              Current Level: <span className="text-blue-600">{userProfile?.current_level || userLevel}</span>
            </p>
            {userData?.subscription_tier === 'premium' && (
              <span className="inline-block mt-2 px-3 py-1 bg-gradient-to-r from-amber-400 to-orange-500 text-white text-xs font-bold rounded-full">
                PREMIUM
              </span>
            )}
          </div>
        </div>

        <hr className="my-6" />

        <div className="mb-6">
          <h3 className="text-xl font-bold mb-2">Learning Stats</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600">Study Streak</p>
              <p className="text-2xl font-bold text-orange-600">
                🔥 {userProfile?.study_streak || 0} days
              </p>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600">Total Study Time</p>
              <p className="text-2xl font-bold text-blue-600">
                {Math.round((userProfile?.total_study_time || 0) / 60)} hours
              </p>
            </div>
            {userProfile?.target_level && (
              <div className="bg-gray-50 p-4 rounded-lg col-span-2">
                <p className="text-sm text-gray-600">Target Level</p>
                <p className="text-2xl font-bold text-green-600">{userProfile.target_level}</p>
                {userProfile.target_exam_date && (
                  <p className="text-xs text-gray-500 mt-1">
                    Exam Date: {new Date(userProfile.target_exam_date).toLocaleDateString()}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        <hr className="my-6" />

        <div>
          <h3 className="text-xl font-bold mb-4">Settings</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <label htmlFor="notifications" className="font-semibold">
                Email Notifications
              </label>
              <div className="relative inline-block w-10 mr-2 align-middle select-none transition duration-200 ease-in">
                <input
                  type="checkbox"
                  name="notifications"
                  id="notifications"
                  checked={emailNotifications}
                  onChange={(e) => handleToggleNotifications(e.target.checked)}
                  className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer"
                />
                <label
                  htmlFor="notifications"
                  className="toggle-label block overflow-hidden h-6 rounded-full bg-gray-300 cursor-pointer"
                ></label>
              </div>
            </div>
            <div className="flex justify-between items-center">
              <label htmlFor="darkMode" className="font-semibold">
                Dark Mode
              </label>
              <div className="relative inline-block w-10 mr-2 align-middle select-none transition duration-200 ease-in">
                <input
                  type="checkbox"
                  name="darkMode"
                  id="darkMode"
                  checked={darkMode}
                  onChange={(e) => handleToggleDarkMode(e.target.checked)}
                  className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer"
                />
                <label
                  htmlFor="darkMode"
                  className="toggle-label block overflow-hidden h-6 rounded-full bg-gray-300 cursor-pointer"
                ></label>
              </div>
            </div>
          </div>
        </div>
        <style>{`
            .toggle-checkbox:checked { right: 0; border-color: #2563eb; }
            .toggle-checkbox:checked + .toggle-label { background-color: #2563eb; }
        `}</style>
      </Card>
    </div>
  );
};

export default ProfilePage;