import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LearningPlan } from '../types';
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
        case 'reading': return 'fa-solid fa-book-open text-teal-500';
        default: return 'fa-solid fa-star text-yellow-500';
    }
}

const LearningPlanPage: React.FC<LearningPlanPageProps> = ({ learningPlan, loading, onToggleItem }) => {
  const navigate = useNavigate();
  const [expandedWeeks, setExpandedWeeks] = useState<Set<number>>(new Set([1])); // First week expanded by default

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

  const toggleWeek = (weekNumber: number) => {
    setExpandedWeeks(prev => {
      const newSet = new Set(prev);
      if (newSet.has(weekNumber)) {
        newSet.delete(weekNumber);
      } else {
        newSet.add(weekNumber);
      }
      return newSet;
    });
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
        <div className="container mx-auto p-4 sm:p-6 md:p-8">
          <div className="flex items-center justify-center min-h-[60vh]">
            <Card glass className="max-w-2xl text-center backdrop-blur-xl border-2 border-white/30">
              <div className="text-5xl sm:text-6xl mb-4 sm:mb-6">📚</div>
              <h1 className="text-2xl sm:text-3xl font-bold mb-3 sm:mb-4 bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
                No Learning Plan Found
              </h1>
              <p className="text-gray-600 text-base sm:text-lg font-medium mb-4 sm:mb-6 px-4">
                Please complete the placement test first to generate your personalized plan.
              </p>
              <button className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 sm:px-8 py-3 sm:py-3.5 rounded-xl font-bold text-base sm:text-lg hover:from-blue-700 hover:to-indigo-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5">
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="container mx-auto p-4 sm:p-6 md:p-8 space-y-4 sm:space-y-6 md:space-y-8">
        {/* Header Section - Mobile Optimized */}
        <Card glass hover className="backdrop-blur-xl border-2 border-white/30 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-48 sm:w-64 h-48 sm:h-64 bg-gradient-to-br from-blue-400/20 to-purple-400/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
          <div className="relative z-10">
            <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold bg-gradient-to-r from-gray-800 via-gray-700 to-gray-600 dark:from-gray-100 dark:via-gray-200 dark:to-gray-300 bg-clip-text text-transparent mb-2 sm:mb-3">
              Your Learning Plan
            </h1>
            <p className="text-gray-600 dark:text-gray-300 text-base sm:text-lg font-medium">
              Target Level:{' '}
              <span className="font-bold bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent text-lg sm:text-xl">
                {learningPlan.level}
              </span>
            </p>
          </div>
        </Card>

        {/* Progress Overview - Responsive Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          <Card hover className="relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-green-500 to-emerald-600 opacity-100 group-hover:opacity-90 transition-opacity"></div>
            <div className="relative z-10 flex flex-col items-center justify-center text-white py-6 sm:py-8">
              <span className="text-base sm:text-lg font-bold mb-2">Overall Progress</span>
              <span className="text-5xl sm:text-6xl md:text-7xl font-bold mb-2">{progressPercentage}%</span>
              <span className="text-xs sm:text-sm opacity-90 font-medium">{completedItems} of {totalItems} completed</span>
            </div>
          </Card>

          <Card hover className="relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-indigo-600 opacity-100 group-hover:opacity-90 transition-opacity"></div>
            <div className="relative z-10 flex flex-col items-center justify-center text-white py-6 sm:py-8">
              <span className="text-base sm:text-lg font-bold mb-2">Total Weeks</span>
              <span className="text-5xl sm:text-6xl md:text-7xl font-bold mb-2">{learningPlan.weeks.length}</span>
              <span className="text-xs sm:text-sm opacity-90 font-medium">Structured learning path</span>
            </div>
          </Card>

          <Card hover className="relative overflow-hidden group sm:col-span-2 lg:col-span-1">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500 to-pink-600 opacity-100 group-hover:opacity-90 transition-opacity"></div>
            <div className="relative z-10 flex flex-col items-center justify-center text-white py-6 sm:py-8">
              <span className="text-base sm:text-lg font-bold mb-2">Activities</span>
              <span className="text-5xl sm:text-6xl md:text-7xl font-bold mb-2">{totalItems}</span>
              <span className="text-xs sm:text-sm opacity-90 font-medium">Learning activities</span>
            </div>
          </Card>
        </div>

        {/* Goals Section - Compact on Mobile */}
        <Card glass hover className="backdrop-blur-xl border-2 border-white/30 relative overflow-hidden">
          <div className="absolute bottom-0 left-0 w-32 sm:w-48 h-32 sm:h-48 bg-gradient-to-br from-blue-400/20 to-indigo-400/20 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2 hidden sm:block"></div>
          <div className="relative z-10">
            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold mb-3 sm:mb-4 bg-gradient-to-r from-gray-800 to-gray-600 dark:from-gray-100 dark:to-gray-300 bg-clip-text text-transparent">
              Your Goals 🎯
            </h2>
            <ul className="space-y-2 sm:space-y-3">
              {learningPlan.goals.map((goal, index) => (
                <li key={index} className="flex items-start space-x-2 sm:space-x-3">
                  <div className="flex-shrink-0 w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 flex items-center justify-center text-white font-bold text-xs sm:text-sm mt-0.5">
                    {index + 1}
                  </div>
                  <span className="text-gray-700 dark:text-gray-200 font-medium text-sm sm:text-base md:text-lg leading-tight sm:leading-normal">{goal}</span>
                </li>
              ))}
            </ul>
          </div>
        </Card>

        {/* Weekly Plan - Collapsible on Mobile */}
        <div className="space-y-4 sm:space-y-6">
          {learningPlan.weeks.map((week, weekIndex) => {
            const weekCompleted = week.items.filter(i => i.completed).length;
            const weekTotal = week.items.length;
            const weekProgress = Math.round((weekCompleted / weekTotal) * 100);
            const isExpanded = expandedWeeks.has(week.week);

            return (
              <Card key={week.week} glass className="backdrop-blur-xl border-2 border-white/30">
                {/* Week Header - Always Visible, Clickable on Mobile */}
                <button
                  onClick={() => toggleWeek(week.week)}
                  className="w-full text-left focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-lg -m-2 p-2"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 pb-3 sm:pb-4 border-b-2 border-gray-200/50">
                    <div className="flex items-center justify-between sm:block">
                      <div>
                        <h2 className="text-xl sm:text-2xl md:text-3xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 dark:from-gray-100 dark:to-gray-300 bg-clip-text text-transparent">
                          Week {week.week}
                        </h2>
                        <p className="text-sm sm:text-base md:text-lg font-bold text-blue-600 dark:text-blue-400 mt-0.5 sm:mt-1">{week.focus}</p>
                      </div>
                      {/* Mobile Expand/Collapse Icon */}
                      <div className="sm:hidden ml-3">
                        <i className={`fa-solid ${isExpanded ? 'fa-chevron-up' : 'fa-chevron-down'} text-gray-500 dark:text-gray-400 text-lg`}></i>
                      </div>
                    </div>
                    <div className="mt-3 sm:mt-0">
                      <div className="flex items-center space-x-2 sm:space-x-3">
                        <div className="flex-1 sm:flex-none sm:w-32 h-2.5 sm:h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-green-500 to-emerald-500 transition-all duration-500"
                            style={{ width: `${weekProgress}%` }}
                          ></div>
                        </div>
                        <span className="font-bold text-gray-700 dark:text-gray-200 text-sm sm:text-base whitespace-nowrap">{weekProgress}%</span>
                      </div>
                      <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 font-medium mt-1 text-right">{weekCompleted}/{weekTotal} completed</p>
                    </div>
                  </div>
                </button>

                {/* Week Items - Collapsible */}
                {isExpanded && (
                  <div className="space-y-3 mt-4">
                    {week.items.map((item, itemIndex) => (
                      <div
                        key={itemIndex}
                        className={`flex flex-col sm:flex-row sm:items-center p-4 sm:p-5 rounded-xl transition-all duration-300 border-2 ${
                          item.completed
                            ? 'bg-green-50/80 dark:bg-green-900/30 border-green-200/50 dark:border-green-700/50 opacity-90'
                            : 'bg-white/60 dark:bg-gray-800/60 border-white/40 dark:border-gray-700/40 hover:bg-white/80 dark:hover:bg-gray-700/80 hover:border-blue-200/50 dark:hover:border-blue-600/50 hover:shadow-md'
                        }`}
                      >
                        {/* Icon and Content */}
                        <div className="flex items-start sm:items-center flex-1 min-w-0">
                          <div className={`flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center shadow-md ${
                            item.completed ? 'bg-green-500' : 'bg-gradient-to-br from-blue-500 to-indigo-500'
                          } transition-transform`}>
                            <i className={`${getIconForSkill(item.skill)} text-white text-lg sm:text-xl`}></i>
                          </div>

                          <div className="flex-1 ml-3 sm:ml-4 min-w-0">
                            <h3 className={`font-bold text-base sm:text-lg ${item.completed ? 'line-through text-gray-500 dark:text-gray-400' : 'text-gray-800 dark:text-gray-100'} break-words`}>
                              {item.topic}
                            </h3>
                            <div className="flex items-center gap-2 mt-1">
                              <span className={`inline-block px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-lg text-xs font-bold whitespace-nowrap ${
                                item.skill.toLowerCase() === 'grammar' ? 'bg-blue-100 text-blue-700' :
                                item.skill.toLowerCase() === 'vocabulary' ? 'bg-green-100 text-green-700' :
                                item.skill.toLowerCase() === 'listening' ? 'bg-purple-100 text-purple-700' :
                                item.skill.toLowerCase() === 'writing' ? 'bg-orange-100 text-orange-700' :
                                item.skill.toLowerCase() === 'speaking' ? 'bg-red-100 text-red-700' :
                                item.skill.toLowerCase() === 'reading' ? 'bg-teal-100 text-teal-700' :
                                'bg-yellow-100 text-yellow-700'
                              }`}>
                                {item.skill}
                              </span>
                            </div>
                            <p className={`text-xs sm:text-sm mt-2 ${item.completed ? 'line-through text-gray-500 dark:text-gray-400' : 'text-gray-600 dark:text-gray-300'} font-medium break-words`}>
                              {item.description}
                            </p>
                          </div>
                        </div>

                        {/* Action Buttons - Stack on Mobile */}
                        <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-3 mt-3 sm:mt-0 sm:ml-4">
                          {!item.completed && (
                            <button
                              onClick={() => handleStartActivity(item.skill, item.topic, item.description, learningPlan.level, week.week, itemIndex)}
                              className="flex-1 sm:flex-none px-4 sm:px-6 py-2.5 sm:py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg font-bold text-xs sm:text-sm hover:from-blue-700 hover:to-indigo-700 transition-all duration-300 shadow-md hover:shadow-lg transform hover:-translate-y-0.5 active:translate-y-0 whitespace-nowrap"
                            >
                              Start Activity
                            </button>
                          )}

                          <button
                            onClick={() => onToggleItem(weekIndex, itemIndex)}
                            className={`flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-full border-2 flex items-center justify-center transition-all duration-300 shadow-md ${
                              item.completed
                                ? 'bg-green-500 border-green-500 text-white'
                                : 'border-gray-300 dark:border-gray-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:border-blue-500 dark:hover:border-blue-400 active:scale-95'
                            }`}
                            aria-label={item.completed ? 'Mark as incomplete' : 'Mark as complete'}
                          >
                            {item.completed && <i className="fa-solid fa-check text-base sm:text-lg"></i>}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default LearningPlanPage;
