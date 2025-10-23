import React from 'react';
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

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <LoadingSpinner text="Generating your personalized learning plan..." />
      </div>
    );
  }

  if (!learningPlan) {
    return (
      <div className="container mx-auto p-8 text-center">
        <Card>
          <h1 className="text-2xl font-bold mb-4">No Learning Plan Found</h1>
          <p className="text-gray-600">Please complete the placement test first to generate your personalized plan.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-8">
      <header className="mb-8">
        <h1 className="text-4xl font-bold">Your Personalized Learning Plan</h1>
        <p className="text-gray-600 mt-2">Target Level: <span className="font-bold text-blue-600">{learningPlan.level}</span></p>
      </header>

      <Card className="mb-8 bg-blue-50 border-l-4 border-blue-500">
        <h2 className="text-2xl font-bold mb-2">Your Goals</h2>
        <ul className="list-disc list-inside text-gray-800">
          {learningPlan.goals.map((goal, index) => (
            <li key={index}>{goal}</li>
          ))}
        </ul>
      </Card>
      
      <div className="space-y-8">
          {learningPlan.weeks.map((week, weekIndex) => (
              <Card key={week.week}>
                  <h2 className="text-2xl font-bold mb-2">Week {week.week}: <span className="text-blue-600">{week.focus}</span></h2>
                  <div className="space-y-4 mt-4">
                      {week.items.map((item, itemIndex) => (
                          <div key={itemIndex} className={`flex items-center p-4 rounded-lg transition ${item.completed ? 'bg-green-50 opacity-70' : 'bg-gray-50'}`}>
                              <i className={`${getIconForSkill(item.skill)} text-2xl w-10 text-center`}></i>
                              <div className="flex-grow ml-4">
                                  <h3 className={`font-bold ${item.completed ? 'line-through text-gray-500' : ''}`}>{item.topic} <span className="text-sm font-normal text-gray-500">({item.skill})</span></h3>
                                  <p className={`text-sm text-gray-700 ${item.completed ? 'line-through' : ''}`}>{item.description}</p>
                              </div>
                              <button onClick={() => onToggleItem(weekIndex, itemIndex)} className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition ${item.completed ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300 hover:bg-gray-200'}`}>
                                  {item.completed && <i className="fa-solid fa-check"></i>}
                              </button>
                          </div>
                      ))}
                  </div>
              </Card>
          ))}
      </div>
    </div>
  );
};

export default LearningPlanPage;