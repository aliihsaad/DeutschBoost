/**
 * ExamSimulatorPage Component
 * Full mock Goethe-Zertifikat exam simulator
 * This is a placeholder for the full implementation planned in Phase 2
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CEFRLevel } from '../types';
import { useAuth } from '../src/contexts/AuthContext';

export const ExamSimulatorPage: React.FC = () => {
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  const [selectedLevel, setSelectedLevel] = useState<CEFRLevel>(userProfile?.current_level || CEFRLevel.A1);

  const levels: CEFRLevel[] = [CEFRLevel.A1, CEFRLevel.A2, CEFRLevel.B1, CEFRLevel.B2, CEFRLevel.C1, CEFRLevel.C2];

  const examStructure = {
    [CEFRLevel.A1]: {
      reading: { parts: 3, duration: 65 },
      listening: { parts: 4, duration: 20 },
      writing: { parts: 2, duration: 60 },
      speaking: { parts: 3, duration: 15 }
    },
    [CEFRLevel.A2]: {
      reading: { parts: 4, duration: 60 },
      listening: { parts: 4, duration: 30 },
      writing: { parts: 2, duration: 60 },
      speaking: { parts: 3, duration: 15 }
    },
    [CEFRLevel.B1]: {
      reading: { parts: 5, duration: 65 },
      listening: { parts: 4, duration: 40 },
      writing: { parts: 3, duration: 60 },
      speaking: { parts: 4, duration: 15 }
    },
    [CEFRLevel.B2]: {
      reading: { parts: 4, duration: 65 },
      listening: { parts: 2, duration: 40 },
      writing: { parts: 2, duration: 75 },
      speaking: { parts: 2, duration: 15 }
    },
    [CEFRLevel.C1]: {
      reading: { parts: 4, duration: 70 },
      listening: { parts: 2, duration: 40 },
      writing: { parts: 2, duration: 80 },
      speaking: { parts: 2, duration: 15 }
    },
    [CEFRLevel.C2]: {
      reading: { parts: 4, duration: 80 },
      listening: { parts: 2, duration: 35 },
      writing: { parts: 2, duration: 80 },
      speaking: { parts: 2, duration: 15 }
    }
  };

  const currentExam = examStructure[selectedLevel];

  const handleStartExam = () => {
    // This is a placeholder - full implementation will come in Phase 2
    alert(`Full mock exam simulator for ${selectedLevel} is coming soon!\n\nThis feature will include:\n- All 4 sections (Lesen, Hören, Schreiben, Sprechen)\n- Exam-like timer and interface\n- Automatic scoring\n- Detailed performance report\n\nFor now, you can practice individual skills from the Practice page.`);
    navigate('/practice');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 py-8 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-8">
          <button
            onClick={() => navigate('/practice')}
            className="mb-4 text-indigo-600 hover:text-indigo-800 font-medium"
          >
            ← Back to Practice
          </button>
          <h1 className="text-4xl font-bold text-gray-800 mb-2">
            📋 Goethe Mock Exam Simulator
          </h1>
          <p className="text-lg text-gray-600">
            Practice with full-length Goethe-Zertifikat mock exams
          </p>
        </div>

        {/* Level Selector */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Select Your Exam Level</h2>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
            {levels.map((level) => (
              <button
                key={level}
                onClick={() => setSelectedLevel(level)}
                className={`px-6 py-4 rounded-lg font-bold text-lg transition transform hover:scale-105 ${
                  selectedLevel === level
                    ? 'bg-indigo-600 text-white shadow-lg'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {level}
              </button>
            ))}
          </div>
        </div>

        {/* Exam Structure */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">
            {selectedLevel} Exam Structure
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Reading */}
            <div className="border-2 border-blue-200 rounded-lg p-4 bg-blue-50">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">📖</span>
                <h3 className="font-bold text-gray-800">Lesen (Reading)</h3>
              </div>
              <p className="text-sm text-gray-700">
                {currentExam.reading.parts} parts • {currentExam.reading.duration} minutes
              </p>
              <p className="text-xs text-gray-600 mt-2">
                Reading comprehension with multiple choice and matching tasks
              </p>
            </div>

            {/* Listening */}
            <div className="border-2 border-green-200 rounded-lg p-4 bg-green-50">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">👂</span>
                <h3 className="font-bold text-gray-800">Hören (Listening)</h3>
              </div>
              <p className="text-sm text-gray-700">
                {currentExam.listening.parts} parts • {currentExam.listening.duration} minutes
              </p>
              <p className="text-xs text-gray-600 mt-2">
                Audio comprehension with various question formats
              </p>
            </div>

            {/* Writing */}
            <div className="border-2 border-orange-200 rounded-lg p-4 bg-orange-50">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">✍️</span>
                <h3 className="font-bold text-gray-800">Schreiben (Writing)</h3>
              </div>
              <p className="text-sm text-gray-700">
                {currentExam.writing.parts} parts • {currentExam.writing.duration} minutes
              </p>
              <p className="text-xs text-gray-600 mt-2">
                Formal/informal writing tasks (letters, essays, emails)
              </p>
            </div>

            {/* Speaking */}
            <div className="border-2 border-pink-200 rounded-lg p-4 bg-pink-50">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">🗣️</span>
                <h3 className="font-bold text-gray-800">Sprechen (Speaking)</h3>
              </div>
              <p className="text-sm text-gray-700">
                {currentExam.speaking.parts} parts • {currentExam.speaking.duration} minutes
              </p>
              <p className="text-xs text-gray-600 mt-2">
                Conversation practice with AI examiner
              </p>
            </div>
          </div>

          {/* Total Time */}
          <div className="mt-6 p-4 bg-indigo-100 border-2 border-indigo-300 rounded-lg">
            <p className="text-center">
              <span className="font-bold text-indigo-900">Total Exam Time: </span>
              <span className="text-lg font-bold text-indigo-600">
                {Object.values(currentExam).reduce((sum, section) => sum + section.duration, 0)} minutes
              </span>
            </p>
          </div>
        </div>

        {/* What to Expect */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">What to Expect</h2>
          <ul className="space-y-3">
            <li className="flex items-start gap-3">
              <span className="text-green-600 font-bold">✓</span>
              <span className="text-gray-700">
                <strong>Exam-like interface:</strong> Practice in conditions similar to the real exam
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-green-600 font-bold">✓</span>
              <span className="text-gray-700">
                <strong>Timed sections:</strong> Each section has a countdown timer
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-green-600 font-bold">✓</span>
              <span className="text-gray-700">
                <strong>AI-powered evaluation:</strong> Get instant feedback aligned with Goethe criteria
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-green-600 font-bold">✓</span>
              <span className="text-gray-700">
                <strong>Detailed performance report:</strong> See your strengths, weaknesses, and score breakdown
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-green-600 font-bold">✓</span>
              <span className="text-gray-700">
                <strong>Track your progress:</strong> Compare results across multiple mock exams
              </span>
            </li>
          </ul>
        </div>

        {/* Coming Soon Banner */}
        <div className="bg-gradient-to-r from-yellow-100 to-orange-100 border-2 border-yellow-300 rounded-lg p-6 mb-6">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-3xl">🚧</span>
            <h3 className="text-xl font-bold text-gray-800">Coming Soon - Phase 2</h3>
          </div>
          <p className="text-gray-700 mb-3">
            The full mock exam simulator is currently in development as part of Phase 2 of DeutschBoost.
          </p>
          <p className="text-sm text-gray-600">
            In the meantime, you can practice individual skills (Grammar, Vocabulary, Reading, Writing, Speaking, Listening)
            from the Practice page!
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4">
          <button
            onClick={() => navigate('/practice')}
            className="flex-1 px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-bold hover:bg-gray-300 transition"
          >
            ← Back to Practice
          </button>
          <button
            onClick={handleStartExam}
            className="flex-1 px-6 py-3 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 transition"
          >
            Start Mock Exam (Preview)
          </button>
        </div>
      </div>
    </div>
  );
};
