/**
 * PracticePage Component
 * Main hub for practice activities - Goethe exam preparation focused
 */

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CEFRLevel, SkillType } from '../types';
import { browserProfileRepository } from '../src/infrastructure/browser/profileStorage';

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

const TOPIC_OPTIONS = [
  'Daily routines',
  'Travel',
  'Work',
  'Shopping',
  'Food and restaurants',
  'Appointments',
  'Housing',
  'Health',
  'Exam practice',
  'General conversation',
];

function createLocalSessionId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `local-practice-${Date.now()}`;
}

export const PracticePage: React.FC = () => {
  const navigate = useNavigate();
  const [showSkillSelector, setShowSkillSelector] = useState(false);
  const [selectedSkill, setSelectedSkill] = useState<SkillType | null>(null);
  const [selectedLevel, setSelectedLevel] = useState<CEFRLevel | null>(null);
  const [profileLevel, setProfileLevel] = useState<CEFRLevel>(CEFRLevel.A1);
  const [selectedTopic, setSelectedTopic] = useState(TOPIC_OPTIONS[0]);

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

  useEffect(() => {
    let cancelled = false;

    async function loadLocalProfile() {
      try {
        const profile = await browserProfileRepository.loadProfile();

        if (!cancelled) {
          setProfileLevel(profile.currentLevel);
        }
      } catch (error) {
        console.error('Error loading local practice profile:', error);
      }
    }

    loadLocalProfile();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleSkillClick = (skill: SkillType) => {
    setSelectedSkill(skill);
    setSelectedLevel(profileLevel);
    setSelectedTopic(TOPIC_OPTIONS[0]);
    setShowSkillSelector(true);
  };

  const handleStartPractice = (skill: SkillType, level: CEFRLevel, topic: string) => {
    const sessionId = createLocalSessionId();

    if (skill === 'Speaking') {
      navigate(`/speaking-activity?practiceMode=true&sessionId=${sessionId}&topic=${encodeURIComponent(topic)}&level=${level}`);
    } else {
      navigate(`/activity?practiceMode=true&sessionId=${sessionId}&type=${skill.toLowerCase()}&topic=${encodeURIComponent(topic)}&level=${level}`);
    }
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

              {/* Topic Selector */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Topic
                </label>
                <select
                  value={selectedTopic}
                  onChange={(e) => setSelectedTopic(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
                >
                  {TOPIC_OPTIONS.map(topic => (
                    <option key={topic} value={topic}>
                      {topic}
                    </option>
                  ))}
                </select>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowSkillSelector(false);
                    setSelectedSkill(null);
                  }}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    handleStartPractice(selectedSkill, selectedLevel, selectedTopic);
                    setShowSkillSelector(false);
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
