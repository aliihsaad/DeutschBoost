/**
 * PracticePage Component
 * Main hub for practice activities - Goethe exam preparation focused
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DailySuggestions } from '../components/DailySuggestions';
import { PracticeStatsWidget } from '../components/PracticeStatsWidget';
import { useAuth } from '../src/contexts/AuthContext';
import { CEFRLevel, SkillType, DailyPracticeSuggestion } from '../types';
import { completeSuggestion, createPracticeSession } from '../services/practiceService';

interface SkillCardProps {
  icon: string;
  title: SkillType;
  description: string;
  color: string;
  onClick: () => void;
}

const SkillCard: React.FC<SkillCardProps> = ({ icon, title, description, color, onClick }) => {
  return (
    <button
      onClick={onClick}
      className={`${color} p-6 rounded-lg shadow-md hover:shadow-lg transition-all transform hover:-translate-y-1 text-left w-full`}
    >
      <div className="text-4xl mb-3">{icon}</div>
      <h3 className="text-xl font-bold text-gray-800 mb-2">{title}</h3>
      <p className="text-sm text-gray-700 mb-4">{description}</p>
      <span className="text-sm font-medium text-indigo-600">Start Practice →</span>
    </button>
  );
};

export const PracticePage: React.FC = () => {
  const navigate = useNavigate();
  const { user, userProfile } = useAuth();
  const [showSkillSelector, setShowSkillSelector] = useState(false);
  const [selectedSkill, setSelectedSkill] = useState<SkillType | null>(null);
  const [selectedLevel, setSelectedLevel] = useState<CEFRLevel | null>(null);
  const [customTopic, setCustomTopic] = useState('');

  const skills = [
    {
      title: 'Grammar' as SkillType,
      icon: '📝',
      description: 'Practice German grammar rules and sentence structures',
      color: 'bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-200'
    },
    {
      title: 'Vocabulary' as SkillType,
      icon: '📚',
      description: 'Build your German vocabulary with themed word sets',
      color: 'bg-gradient-to-br from-purple-50 to-purple-100 border-2 border-purple-200'
    },
    {
      title: 'Listening' as SkillType,
      icon: '👂',
      description: 'Improve comprehension with audio exercises',
      color: 'bg-gradient-to-br from-green-50 to-green-100 border-2 border-green-200'
    },
    {
      title: 'Writing' as SkillType,
      icon: '✍️',
      description: 'Practice writing essays and formal/informal texts',
      color: 'bg-gradient-to-br from-orange-50 to-orange-100 border-2 border-orange-200'
    },
    {
      title: 'Speaking' as SkillType,
      icon: '🗣️',
      description: 'Have conversations with AI and get pronunciation feedback',
      color: 'bg-gradient-to-br from-pink-50 to-pink-100 border-2 border-pink-200'
    },
    {
      title: 'Reading' as SkillType,
      icon: '📖',
      description: 'Read German texts and answer comprehension questions',
      color: 'bg-gradient-to-br from-indigo-50 to-indigo-100 border-2 border-indigo-200'
    }
  ];

  const levels: CEFRLevel[] = [CEFRLevel.A1, CEFRLevel.A2, CEFRLevel.B1, CEFRLevel.B2, CEFRLevel.C1, CEFRLevel.C2];

  const handleSkillClick = (skill: SkillType) => {
    setSelectedSkill(skill);
    setSelectedLevel(userProfile?.current_level || CEFRLevel.A1);
    setShowSkillSelector(true);
  };

  const handleStartPractice = async (skill: SkillType, level: CEFRLevel, topic?: string) => {
    if (!user) return;

    // Create practice session
    const session = await createPracticeSession(user.id, skill, level, topic);

    if (!session) {
      alert('Failed to create practice session. Please try again.');
      return;
    }

    // Navigate to appropriate activity page
    if (skill === 'Speaking') {
      navigate(`/speaking-activity?practiceMode=true&sessionId=${session.id}&topic=${encodeURIComponent(topic || 'General conversation')}&level=${level}`);
    } else {
      navigate(`/activity?practiceMode=true&sessionId=${session.id}&type=${skill.toLowerCase()}&topic=${encodeURIComponent(topic || skill)}&level=${level}`);
    }
  };

  const handleSuggestionStart = async (suggestion: DailyPracticeSuggestion) => {
    // Mark suggestion as completed
    await completeSuggestion(suggestion.id);

    // Start practice for that suggestion
    await handleStartPractice(suggestion.skill_type, suggestion.level, suggestion.topic);
  };

  const handleExamSimulator = () => {
    navigate('/exam-simulator');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">
            🎯 Practice Hub
          </h1>
          <p className="text-lg text-gray-600">
            Goethe-Zertifikat focused practice with AI-powered feedback
          </p>
        </div>

        {/* Daily Suggestions */}
        <DailySuggestions onStartPractice={handleSuggestionStart} />

        {/* Mock Exam Simulator - Featured */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-lg shadow-lg p-6 mb-6 text-white">
          <div className="flex flex-col md:flex-row items-center justify-between">
            <div className="mb-4 md:mb-0">
              <h2 className="text-2xl font-bold mb-2">📋 Goethe Mock Exam Simulator</h2>
              <p className="text-indigo-100">
                Take full-length practice exams with timer, all sections, and detailed scoring
              </p>
            </div>
            <button
              onClick={handleExamSimulator}
              className="px-6 py-3 bg-white text-indigo-600 rounded-lg font-bold hover:bg-indigo-50 transition transform hover:scale-105"
            >
              Start Mock Exam →
            </button>
          </div>
        </div>

        {/* Quick Practice Skills */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">
            ⚡ Quick Practice
          </h2>
          <p className="text-gray-600 mb-6">
            Choose a skill to practice right now
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {skills.map((skill) => (
              <SkillCard
                key={skill.title}
                icon={skill.icon}
                title={skill.title}
                description={skill.description}
                color={skill.color}
                onClick={() => handleSkillClick(skill.title)}
              />
            ))}
          </div>
        </div>

        {/* Practice Statistics */}
        <PracticeStatsWidget days={7} />

        {/* Skill Selector Modal */}
        {showSkillSelector && selectedSkill && selectedLevel && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <h3 className="text-2xl font-bold text-gray-800 mb-4">
                {selectedSkill} Practice
              </h3>

              {/* Level Selector */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Level
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {levels.map((level) => (
                    <button
                      key={level}
                      onClick={() => setSelectedLevel(level)}
                      className={`px-4 py-2 rounded-lg font-medium transition ${
                        selectedLevel === level
                          ? 'bg-indigo-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </div>

              {/* Topic Input */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Topic (optional)
                </label>
                <input
                  type="text"
                  value={customTopic}
                  onChange={(e) => setCustomTopic(e.target.value)}
                  placeholder={`e.g., "Daily routines", "Travel", "Business German"...`}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Leave blank for AI to choose a topic
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowSkillSelector(false);
                    setSelectedSkill(null);
                    setCustomTopic('');
                  }}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    handleStartPractice(selectedSkill, selectedLevel, customTopic || undefined);
                    setShowSkillSelector(false);
                    setCustomTopic('');
                  }}
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
                >
                  Start Practice
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
