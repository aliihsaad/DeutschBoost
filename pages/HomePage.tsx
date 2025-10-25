import React from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../components/Card';
import { CEFRLevel, LearningPlan, Page } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useAuth } from '../src/contexts/AuthContext';

interface HomePageProps {
  setPage: (page: Page) => void;
  learningPlan: LearningPlan | null;
  userLevel: CEFRLevel;
}

const HomePage: React.FC<HomePageProps> = ({ setPage, learningPlan, userLevel }) => {
    const navigate = useNavigate();
    const { userData } = useAuth();

    const skillsProgress = learningPlan ? learningPlan.weeks.flatMap(w => w.items).reduce((acc, item) => {
        if (!acc[item.skill]) {
            acc[item.skill] = { total: 0, completed: 0 };
        }
        acc[item.skill].total++;
        if (item.completed) {
            acc[item.skill].completed++;
        }
        return acc;
    }, {} as Record<string, {total: number, completed: number}>) : {};

    const chartData = Object.keys(skillsProgress).map(skill => ({
        name: skill,
        Completed: skillsProgress[skill].completed,
        Remaining: skillsProgress[skill].total - skillsProgress[skill].completed
    }));

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="container mx-auto p-4 md:p-8 space-y-8">
        {/* Hero Section */}
        <div className="relative">
          <Card glass hover className="backdrop-blur-xl border-2 border-white/30 overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-blue-400/20 to-purple-400/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
            <div className="relative z-10">
              <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-gray-800 via-gray-700 to-gray-600 dark:from-gray-100 dark:via-gray-200 dark:to-gray-300 bg-clip-text text-transparent mb-2">
                Welcome back{userData?.full_name ? `, ${userData.full_name.split(' ')[0]}` : ''}! 👋
              </h1>
              <p className="text-gray-600 dark:text-gray-300 text-lg font-medium">Let's continue your journey to mastering German.</p>
            </div>
          </Card>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card hover className="relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-indigo-600 opacity-100 group-hover:opacity-90 transition-opacity"></div>
            <div className="relative z-10 flex flex-col items-center justify-center text-white py-4">
              <span className="text-lg font-bold mb-2">Your Level</span>
              <span className="text-7xl font-bold mb-2">{userLevel}</span>
              <span className="text-sm opacity-90 font-medium">According to CEFR</span>
            </div>
          </Card>

          <Card hover className="relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-green-500 to-emerald-600 opacity-100 group-hover:opacity-90 transition-opacity"></div>
            <div className="relative z-10 flex flex-col items-center justify-center text-white py-4">
              <span className="text-lg font-bold mb-2">Daily Streak</span>
              <span className="text-7xl font-bold mb-2">🔥</span>
              <span className="text-sm opacity-90 font-medium">Keep it up!</span>
            </div>
          </Card>

          <Card hover className="relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-amber-400 to-orange-500 opacity-100 group-hover:opacity-90 transition-opacity"></div>
            <div className="relative z-10 flex flex-col items-center justify-center text-white py-4">
              <span className="text-lg font-bold mb-2">Achievements</span>
              <span className="text-7xl font-bold mb-2">🏆</span>
              <span className="text-sm opacity-90 font-medium">Well done!</span>
            </div>
          </Card>
        </div>

        {/* Learning Progress */}
        <Card glass hover className="backdrop-blur-xl border-2 border-white/30">
          <h2 className="text-3xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 dark:from-gray-100 dark:to-gray-300 bg-clip-text text-transparent mb-6">
            Your Learning Plan Progress
          </h2>
          {learningPlan ? (
            <div className="bg-white/50 dark:bg-gray-800/50 rounded-xl p-4 backdrop-blur-sm">
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" className="dark:stroke-gray-600" />
                  <XAxis dataKey="name" stroke="#475569" className="dark:stroke-gray-300" fontWeight="600" />
                  <YAxis stroke="#475569" className="dark:stroke-gray-300" fontWeight="600" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(255, 255, 255, 0.95)',
                      border: '2px solid #e2e8f0',
                      borderRadius: '12px',
                      fontWeight: '600'
                    }}
                  />
                  <Legend wrapperStyle={{ fontWeight: '600' }} />
                  <Bar dataKey="Completed" stackId="a" fill="#10b981" radius={[8, 8, 0, 0]} />
                  <Bar dataKey="Remaining" stackId="a" fill="#f43f5e" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="text-center p-12 bg-white/50 dark:bg-gray-800/50 rounded-xl backdrop-blur-sm">
              <div className="text-6xl mb-4">📚</div>
              <p className="text-gray-600 dark:text-gray-300 mb-6 text-lg font-medium">You don't have a learning plan yet. Take the placement test to get started!</p>
              <button
                onClick={() => navigate('/placement-test')}
                className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-8 py-3.5 rounded-xl font-bold text-lg hover:from-blue-700 hover:to-indigo-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
              >
                Take Placement Test
              </button>
            </div>
          )}
        </Card>

        {/* Quick Actions */}
        <Card glass hover className="backdrop-blur-xl border-2 border-white/30">
          <h2 className="text-3xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 dark:from-gray-100 dark:to-gray-300 bg-clip-text text-transparent mb-6">
            Start a New Activity
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              onClick={() => navigate('/conversation')}
              className="group flex items-center space-x-4 p-6 bg-gradient-to-br from-red-50 to-pink-50 dark:from-red-900/20 dark:to-pink-900/20 hover:from-red-100 hover:to-pink-100 dark:hover:from-red-900/30 dark:hover:to-pink-900/30 rounded-2xl transition-all duration-300 border-2 border-red-200/50 dark:border-red-700/50 hover:border-red-300 dark:hover:border-red-600 shadow-md hover:shadow-xl transform hover:-translate-y-1"
            >
              <div className="flex-shrink-0 w-16 h-16 bg-gradient-to-br from-red-500 to-pink-500 rounded-xl flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform">
                <i className="fa-solid fa-microphone-alt text-2xl"></i>
              </div>
              <div className="text-left flex-grow">
                <h3 className="font-bold text-xl text-gray-800 dark:text-gray-100 mb-1">AI Conversation</h3>
                <p className="text-sm text-gray-600 dark:text-gray-300 font-medium">Practice your speaking skills with our AI tutor.</p>
              </div>
              <i className="fa-solid fa-arrow-right text-gray-400 dark:text-gray-500 group-hover:text-red-500 dark:group-hover:text-red-400 group-hover:translate-x-1 transition-all"></i>
            </button>

            <button
              onClick={() => navigate('/learning-plan')}
              className="group flex items-center space-x-4 p-6 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 hover:from-green-100 hover:to-emerald-100 dark:hover:from-green-900/30 dark:hover:to-emerald-900/30 rounded-2xl transition-all duration-300 border-2 border-green-200/50 dark:border-green-700/50 hover:border-green-300 dark:hover:border-green-600 shadow-md hover:shadow-xl transform hover:-translate-y-1"
            >
              <div className="flex-shrink-0 w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform">
                <i className="fa-solid fa-map-signs text-2xl"></i>
              </div>
              <div className="text-left flex-grow">
                <h3 className="font-bold text-xl text-gray-800 dark:text-gray-100 mb-1">Continue Learning</h3>
                <p className="text-sm text-gray-600 dark:text-gray-300 font-medium">Work on your personalized lesson plan.</p>
              </div>
              <i className="fa-solid fa-arrow-right text-gray-400 dark:text-gray-500 group-hover:text-green-500 dark:group-hover:text-green-400 group-hover:translate-x-1 transition-all"></i>
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default HomePage;
