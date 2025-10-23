import React from 'react';
import { useNavigate } from 'react-router-dom';
import { LearningPlan, LearningPlanItem } from '../types';
import Card from '../components/Card';
import LoadingSpinner from '../components/LoadingSpinner';

interface LearningPlanPageProps {
  learningPlan: LearningPlan | null;
  loading: boolean;
  onToggleItem: (weekIndex: number, itemIndex: number) => void;
}

const getIconForSkill = (skill: string) => {
    switch (skill.toLowerCase()) {
        case 'grammar': return 'fa-solid fa-spell-check text-blue-500';
        case 'vocabulary': return 'fa-solid fa-book text-green-500';
        case 'listening': return 'fa-solid fa-headphones text-purple-500';
        case 'writing': return 'fa-solid fa-pencil-alt text-orange-500';
        case 'speaking': return 'fa-solid fa-comments text-red-500';
        default: return 'fa-solid fa-star text-yellow-500';
    }
}

const LearningPlanPage: React.FC<LearningPlanPageProps> = ({ learningPlan, loading, onToggleItem }) => {
  const navigate = useNavigate();

  const handleStartActivity = (
    skill: string,
    topic: string,
    description: string,
    level: string,
    weekNumber: number,
    itemIndex: number
  ) => {
    const activityType = skill.toLowerCase();

    // Special handling for speaking - redirect to conversation page
    if (activityType === 'speaking') {
      navigate('/conversation');
      return;
    }

    // Navigate to activity page with params
    const params = new URLSearchParams({
      type: activityType,
      topic,
      description,
      level,
      week: weekNumber.toString(),
      item: itemIndex.toString(),
    });

    navigate(`/activity?${params.toString()}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex flex-col items-center justify-center">
        <LoadingSpinner text="Generating your personalized learning plan..." />
      </div>
    );
  }

  if (!learningPlan) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
        <div className="container mx-auto p-8">
          <div className="flex items-center justify-center min-h-[60vh]">
            <Card glass className="max-w-2xl text-center backdrop-blur-xl border-2 border-white/30">
              <div className="text-6xl mb-6">📚</div>
              <h1 className="text-3xl font-bold mb-4 bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">No Learning Plan Found</h1>
              <p className="text-gray-600 text-lg font-medium mb-6">Please complete the placement test first to generate your personalized plan.</p>
              <button className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-8 py-3.5 rounded-xl font-bold text-lg hover:from-blue-700 hover:to-indigo-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5">
                Take Placement Test
              </button>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  const totalItems = learningPlan.weeks.reduce((sum, week) => sum + week.items.length, 0);
  const completedItems = learningPlan.weeks.reduce((sum, week) =>
    sum + week.items.filter(item => item.completed).length, 0
  );
  const progressPercentage = Math.round((completedItems / totalItems) * 100);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      <div className="container mx-auto p-4 md:p-8 space-y-8">
        {/* Header Section */}
        <Card glass hover className="backdrop-blur-xl border-2 border-white/30 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-blue-400/20 to-purple-400/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
          <div className="relative z-10">
            <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-gray-800 via-gray-700 to-gray-600 bg-clip-text text-transparent mb-3">
              Your Personalized Learning Plan
            </h1>
            <p className="text-gray-600 text-lg font-medium">
              Target Level: <span className="font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">{learningPlan.level}</span>
            </p>
          </div>
        </Card>

        {/* Progress Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card hover className="relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-green-500 to-emerald-600 opacity-100 group-hover:opacity-90 transition-opacity"></div>
            <div className="relative z-10 flex flex-col items-center justify-center text-white py-4">
              <span className="text-lg font-bold mb-2">Overall Progress</span>
              <span className="text-7xl font-bold mb-2">{progressPercentage}%</span>
              <span className="text-sm opacity-90 font-medium">{completedItems} of {totalItems} completed</span>
            </div>
          </Card>

          <Card hover className="relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-indigo-600 opacity-100 group-hover:opacity-90 transition-opacity"></div>
            <div className="relative z-10 flex flex-col items-center justify-center text-white py-4">
              <span className="text-lg font-bold mb-2">Total Weeks</span>
              <span className="text-7xl font-bold mb-2">{learningPlan.weeks.length}</span>
              <span className="text-sm opacity-90 font-medium">Structured learning path</span>
            </div>
          </Card>

          <Card hover className="relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500 to-pink-600 opacity-100 group-hover:opacity-90 transition-opacity"></div>
            <div className="relative z-10 flex flex-col items-center justify-center text-white py-4">
              <span className="text-lg font-bold mb-2">Activities</span>
              <span className="text-7xl font-bold mb-2">{totalItems}</span>
              <span className="text-sm opacity-90 font-medium">Learning activities</span>
            </div>
          </Card>
        </div>

        {/* Goals Section */}
        <Card glass hover className="backdrop-blur-xl border-2 border-white/30 relative overflow-hidden">
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-br from-blue-400/20 to-indigo-400/20 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2"></div>
          <div className="relative z-10">
            <h2 className="text-3xl font-bold mb-4 bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">Your Goals 🎯</h2>
            <ul className="space-y-3">
              {learningPlan.goals.map((goal, index) => (
                <li key={index} className="flex items-start space-x-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 flex items-center justify-center text-white font-bold text-sm mt-0.5">
                    {index + 1}
                  </div>
                  <span className="text-gray-700 font-medium text-lg">{goal}</span>
                </li>
              ))}
            </ul>
          </div>
        </Card>

        {/* Weekly Plan */}
        <div className="space-y-6">
          {learningPlan.weeks.map((week, weekIndex) => {
            const weekCompleted = week.items.filter(i => i.completed).length;
            const weekTotal = week.items.length;
            const weekProgress = Math.round((weekCompleted / weekTotal) * 100);

            return (
              <Card key={week.week} glass hover className="backdrop-blur-xl border-2 border-white/30">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 pb-4 border-b-2 border-gray-200/50">
                  <div>
                    <h2 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
                      Week {week.week}
                    </h2>
                    <p className="text-lg font-bold text-blue-600 mt-1">{week.focus}</p>
                  </div>
                  <div className="mt-4 md:mt-0">
                    <div className="flex items-center space-x-3">
                      <div className="w-32 h-3 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-green-500 to-emerald-500 transition-all duration-500"
                          style={{ width: `${weekProgress}%` }}
                        ></div>
                      </div>
                      <span className="font-bold text-gray-700">{weekProgress}%</span>
                    </div>
                    <p className="text-sm text-gray-600 font-medium mt-1 text-right">{weekCompleted}/{weekTotal} completed</p>
                  </div>
                </div>

                <div className="space-y-3">
                  {week.items.map((item, itemIndex) => (
                    <div
                      key={itemIndex}
                      className={`group flex items-center p-5 rounded-xl transition-all duration-300 border-2 ${
                        item.completed
                          ? 'bg-green-50/80 border-green-200/50 opacity-90'
                          : 'bg-white/60 border-white/40 hover:bg-white/80 hover:border-blue-200/50 hover:shadow-md'
                      }`}
                    >
                      <div className={`flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center shadow-md ${
                        item.completed ? 'bg-green-500' : 'bg-gradient-to-br from-blue-500 to-indigo-500'
                      } transition-transform group-hover:scale-110`}>
                        <i className={`${getIconForSkill(item.skill)} text-white text-xl`}></i>
                      </div>

                      <div className="flex-grow ml-4">
                        <h3 className={`font-bold text-lg ${item.completed ? 'line-through text-gray-500' : 'text-gray-800'}`}>
                          {item.topic}
                        </h3>
                        <p className="text-sm text-gray-600 font-medium mt-0.5">
                          <span className={`inline-block px-2.5 py-1 rounded-lg text-xs font-bold ${
                            item.skill.toLowerCase() === 'grammar' ? 'bg-blue-100 text-blue-700' :
                            item.skill.toLowerCase() === 'vocabulary' ? 'bg-green-100 text-green-700' :
                            item.skill.toLowerCase() === 'listening' ? 'bg-purple-100 text-purple-700' :
                            item.skill.toLowerCase() === 'writing' ? 'bg-orange-100 text-orange-700' :
                            item.skill.toLowerCase() === 'speaking' ? 'bg-red-100 text-red-700' :
                            'bg-yellow-100 text-yellow-700'
                          }`}>
                            {item.skill}
                          </span>
                        </p>
                        <p className={`text-sm mt-2 ${item.completed ? 'line-through text-gray-500' : 'text-gray-600'} font-medium`}>
                          {item.description}
                        </p>
                      </div>

                      {!item.completed && (
                        <button
                          onClick={() => handleStartActivity(item.skill, item.topic, item.description, learningPlan.level, week.week, itemIndex)}
                          className="flex-shrink-0 mr-3 px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg font-bold text-sm hover:from-blue-700 hover:to-indigo-700 transition-all duration-300 shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
                        >
                          Start Activity
                        </button>
                      )}

                      <button
                        onClick={() => onToggleItem(weekIndex, itemIndex)}
                        className={`flex-shrink-0 w-10 h-10 rounded-full border-2 flex items-center justify-center transition-all duration-300 shadow-md ${
                          item.completed
                            ? 'bg-green-500 border-green-500 text-white scale-100'
                            : 'border-gray-300 hover:bg-blue-50 hover:border-blue-500 hover:scale-110'
                        }`}
                      >
                        {item.completed && <i className="fa-solid fa-check text-lg"></i>}
                      </button>
                    </div>
                  ))}
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default LearningPlanPage;