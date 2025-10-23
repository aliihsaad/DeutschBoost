import React, { useState, useEffect } from 'react';
import Card from '../components/Card';
import { CEFRLevel } from '../types';
import { useAuth } from '../src/contexts/AuthContext';
import toast from 'react-hot-toast';

interface ProfilePageProps {
  userLevel: CEFRLevel;
}

const ProfilePage: React.FC<ProfilePageProps> = ({ userLevel }) => {
  const { user, userData, userProfile, updateProfile, updateUserData } = useAuth();
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [dismissedBanner, setDismissedBanner] = useState(false);

  // Edit form state
  const [editForm, setEditForm] = useState({
    full_name: '',
    avatar_url: '',
    target_level: '' as CEFRLevel | '',
    target_exam_date: '',
    daily_goal_minutes: 30,
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (userProfile?.notification_preferences) {
      const prefs = userProfile.notification_preferences as any;
      setEmailNotifications(prefs.email ?? true);
      setDarkMode(prefs.darkMode ?? false);
    }
  }, [userProfile]);

  // Populate edit form when modal opens
  useEffect(() => {
    if (showEditModal) {
      setEditForm({
        full_name: userData?.full_name || '',
        avatar_url: userData?.avatar_url || '',
        target_level: (userProfile?.target_level as CEFRLevel) || '',
        target_exam_date: userProfile?.target_exam_date || '',
        daily_goal_minutes: userProfile?.daily_goal_minutes || 30,
      });
    }
  }, [showEditModal, userData, userProfile]);

  // Check if profile is incomplete
  const isProfileIncomplete = !userData?.full_name || !userProfile?.target_level || !userProfile?.daily_goal_minutes;

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

  const handleSaveProfile = async () => {
    setIsSaving(true);

    try {
      // Update users table (full_name, avatar_url)
      const { error: userError } = await updateUserData({
        full_name: editForm.full_name || null,
        avatar_url: editForm.avatar_url || null,
      });

      if (userError) throw userError;

      // Update user_profiles table (target_level, target_exam_date, daily_goal_minutes)
      const { error: profileError } = await updateProfile({
        target_level: editForm.target_level || null,
        target_exam_date: editForm.target_exam_date || null,
        daily_goal_minutes: editForm.daily_goal_minutes,
      });

      if (profileError) throw profileError;

      toast.success('Profile updated successfully!');
      setShowEditModal(false);
    } catch (error: any) {
      toast.error(error.message || 'Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  const cefrLevels: CEFRLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

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

        {/* Missing Profile Data Banner */}
        {isProfileIncomplete && !dismissedBanner && (
          <Card className="relative overflow-hidden border-2 border-yellow-300">
            <div className="absolute inset-0 bg-gradient-to-r from-yellow-400 to-orange-400 opacity-10"></div>
            <div className="relative z-10 flex flex-col md:flex-row items-center justify-between space-y-4 md:space-y-0">
              <div className="flex items-center space-x-4">
                <div className="flex-shrink-0 w-14 h-14 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-xl flex items-center justify-center shadow-lg">
                  <i className="fa-solid fa-exclamation-triangle text-white text-2xl"></i>
                </div>
                <div>
                  <h3 className="text-xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
                    Complete Your Profile
                  </h3>
                  <p className="text-gray-600 font-medium">
                    Add your information to get personalized learning recommendations and track your progress!
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => setShowEditModal(true)}
                  className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white px-6 py-2.5 rounded-xl font-bold hover:from-yellow-600 hover:to-orange-600 transition-all duration-300 shadow-md hover:shadow-lg"
                >
                  Complete Profile
                </button>
                <button
                  onClick={() => setDismissedBanner(true)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <i className="fa-solid fa-times text-xl"></i>
                </button>
              </div>
            </div>
          </Card>
        )}

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
                      {userData?.full_name || (
                        <span className="text-gray-400 italic">Name not set</span>
                      )}
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

              {/* Edit Profile Button */}
              <div className="mt-6 pt-6 border-t-2 border-gray-200/50">
                <button
                  onClick={() => setShowEditModal(true)}
                  className="w-full md:w-auto bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-8 py-3.5 rounded-xl font-bold text-lg hover:from-blue-700 hover:to-indigo-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center justify-center space-x-2"
                >
                  <i className="fa-solid fa-edit"></i>
                  <span>Edit Profile</span>
                </button>
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

            <Card hover className="relative overflow-hidden group md:col-span-2">
              <div className={`absolute inset-0 ${userProfile?.target_level ? 'bg-gradient-to-br from-green-500 to-emerald-600' : 'bg-gradient-to-br from-gray-400 to-gray-500'} opacity-100 group-hover:opacity-90 transition-opacity`}></div>
              <div className="relative z-10 flex flex-col items-center justify-center text-white py-6">
                <span className="text-lg font-bold mb-2">Target Level</span>
                {userProfile?.target_level ? (
                  <>
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
                  </>
                ) : (
                  <>
                    <span className="text-5xl mb-2">🎯</span>
                    <span className="text-sm opacity-90 font-medium">Not set - Click "Edit Profile" to add</span>
                  </>
                )}
              </div>
            </Card>
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

      {/* Edit Profile Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setShowEditModal(false)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-2xl">
            <Card glass className="backdrop-blur-2xl border-2 border-white/30 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-3xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
                Edit Profile
              </h2>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors text-2xl"
              >
                <i className="fa-solid fa-times"></i>
              </button>
            </div>

            <div className="space-y-6">
              {/* Basic Info Section */}
              <div>
                <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center space-x-2">
                  <i className="fa-solid fa-user text-blue-600"></i>
                  <span>Basic Information</span>
                </h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                      Full Name
                    </label>
                    <input
                      type="text"
                      value={editForm.full_name}
                      onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 font-medium"
                      placeholder="Enter your full name"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                      Avatar URL (Optional)
                    </label>
                    <input
                      type="url"
                      value={editForm.avatar_url}
                      onChange={(e) => setEditForm({ ...editForm, avatar_url: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 font-medium"
                      placeholder="https://example.com/avatar.jpg"
                    />
                    {editForm.avatar_url && (
                      <div className="mt-3 flex items-center space-x-3">
                        <img
                          src={editForm.avatar_url}
                          alt="Avatar preview"
                          className="w-16 h-16 rounded-xl object-cover border-2 border-gray-200"
                          onError={(e) => {
                            e.currentTarget.src = '';
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                        <span className="text-sm text-gray-500 font-medium">Avatar preview</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Learning Goals Section */}
              <div className="pt-6 border-t-2 border-gray-200/50">
                <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center space-x-2">
                  <i className="fa-solid fa-bullseye text-green-600"></i>
                  <span>Learning Goals</span>
                </h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                      Target Level
                    </label>
                    <select
                      value={editForm.target_level}
                      onChange={(e) => setEditForm({ ...editForm, target_level: e.target.value as CEFRLevel })}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 font-medium"
                    >
                      <option value="">Select target level</option>
                      {cefrLevels.map(level => (
                        <option key={level} value={level}>{level}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                      Target Exam Date (Optional)
                    </label>
                    <input
                      type="date"
                      value={editForm.target_exam_date}
                      onChange={(e) => setEditForm({ ...editForm, target_exam_date: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                      Daily Goal (minutes): {editForm.daily_goal_minutes}
                    </label>
                    <input
                      type="range"
                      min="10"
                      max="240"
                      step="5"
                      value={editForm.daily_goal_minutes}
                      onChange={(e) => setEditForm({ ...editForm, daily_goal_minutes: parseInt(e.target.value) })}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                    />
                    <div className="flex justify-between text-xs text-gray-500 font-medium mt-1">
                      <span>10 min</span>
                      <span>240 min (4 hours)</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-6 border-t-2 border-gray-200/50 flex flex-col md:flex-row space-y-3 md:space-y-0 md:space-x-4">
                <button
                  onClick={handleSaveProfile}
                  disabled={isSaving}
                  className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-8 py-3.5 rounded-xl font-bold text-lg hover:from-blue-700 hover:to-indigo-700 transition-all duration-300 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSaving ? (
                    <span className="flex items-center justify-center space-x-2">
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <span>Saving...</span>
                    </span>
                  ) : (
                    'Save Changes'
                  )}
                </button>
                <button
                  onClick={() => setShowEditModal(false)}
                  disabled={isSaving}
                  className="flex-1 bg-gray-200 text-gray-700 px-8 py-3.5 rounded-xl font-bold text-lg hover:bg-gray-300 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
              </div>
            </div>
          </Card>
          </div>
        </div>
      )}

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