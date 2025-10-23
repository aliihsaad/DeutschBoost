import React from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../components/Card';
import { CEFRLevel, LearningPlan, Page } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useAuth } from '../contexts/AuthContext';

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
    <div className="container mx-auto p-8 space-y-8">
      <header>
        <h1 className="text-4xl font-bold">Welcome back{userData?.full_name ? `, ${userData.full_name.split(' ')[0]}` : ''}!</h1>
        <p className="text-gray-600 mt-2">Let's continue your journey to mastering German.</p>
      </header>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="flex flex-col items-center justify-center bg-blue-500 text-white">
          <span className="text-lg font-semibold">Your Level</span>
          <span className="text-6xl font-bold">{userLevel}</span>
          <span className="text-sm opacity-80">According to CEFR</span>
        </Card>
         <Card className="flex flex-col items-center justify-center bg-green-500 text-white">
          <span className="text-lg font-semibold">Daily Streak</span>
          <span className="text-6xl font-bold">🔥 5</span>
          <span className="text-sm opacity-80">Keep it up!</span>
        </Card>
         <Card className="flex flex-col items-center justify-center bg-amber-400 text-amber-900">
          <span className="text-lg font-semibold">Achievements</span>
          <span className="text-6xl font-bold">🏆 3</span>
          <span className="text-sm text-amber-800">Well done!</span>
        </Card>
      </div>

      <Card>
        <h2 className="text-2xl font-bold mb-4">Your Learning Plan Progress</h2>
        {learningPlan ? (
            <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="Completed" stackId="a" fill="#34d399" />
              <Bar dataKey="Remaining" stackId="a" fill="#f87171" />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-center p-8">
            <p className="text-gray-600 mb-4">You don't have a learning plan yet. Take the placement test to get started!</p>
            <button onClick={() => navigate('/placement-test')} className="bg-blue-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-blue-700 transition">
              Take Placement Test
            </button>
          </div>
        )}
      </Card>
      
      <Card>
          <h2 className="text-2xl font-bold mb-4">Start a new activity</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button onClick={() => navigate('/conversation')} className="flex items-center space-x-4 p-4 bg-gray-100 hover:bg-gray-200 rounded-lg transition">
                  <i className="fa-solid fa-microphone-alt text-3xl text-red-500"></i>
                  <div className="text-left">
                      <h3 className="font-bold text-lg">AI Conversation</h3>
                      <p className="text-sm text-gray-700">Practice your speaking skills with our AI tutor.</p>
                  </div>
              </button>
              <button onClick={() => navigate('/learning-plan')} className="flex items-center space-x-4 p-4 bg-gray-100 hover:bg-gray-200 rounded-lg transition">
                  <i className="fa-solid fa-map-signs text-3xl text-green-500"></i>
                  <div className="text-left">
                      <h3 className="font-bold text-lg">Continue Learning</h3>
                      <p className="text-sm text-gray-700">Work on your personalized lesson plan.</p>
                  </div>
              </button>
          </div>
      </Card>

    </div>
  );
};

export default HomePage;