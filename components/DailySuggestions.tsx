/**
 * DailySuggestions Component
 * Displays AI-powered daily practice recommendations
 */

import React, { useEffect, useState } from 'react';
import { DailyPracticeSuggestion } from '../types';
import {
  getTodaysSuggestions,
  dismissSuggestion,
  generateDailySuggestions
} from '../services/practiceService';
import { useAuth } from '../src/contexts/AuthContext';

interface DailySuggestionsProps {
  onStartPractice: (suggestion: DailyPracticeSuggestion) => void;
}

export const DailySuggestions: React.FC<DailySuggestionsProps> = ({ onStartPractice }) => {
  const { user, userProfile } = useAuth();
  const [suggestions, setSuggestions] = useState<DailyPracticeSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    loadSuggestions();
  }, [user]);

  const loadSuggestions = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const todaysSuggestions = await getTodaysSuggestions(user.id);

      // If no suggestions exist for today, generate them
      if (todaysSuggestions.length === 0 && userProfile) {
        setGenerating(true);
        const newSuggestions = await generateDailySuggestions(
          user.id,
          userProfile.current_level
        );
        setSuggestions(newSuggestions);
        setGenerating(false);
      } else {
        setSuggestions(todaysSuggestions);
      }
    } catch (error) {
      console.error('Error loading suggestions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = async (suggestionId: string) => {
    try {
      await dismissSuggestion(suggestionId);
      setSuggestions(prev => prev.filter(s => s.id !== suggestionId));
    } catch (error) {
      console.error('Error dismissing suggestion:', error);
    }
  };

  const handleRefresh = async () => {
    if (!user || !userProfile) return;

    setGenerating(true);
    try {
      // Dismiss all current suggestions
      await Promise.all(suggestions.map(s => dismissSuggestion(s.id)));

      // Generate new ones
      const newSuggestions = await generateDailySuggestions(
        user.id,
        userProfile.current_level
      );
      setSuggestions(newSuggestions);
    } catch (error) {
      console.error('Error refreshing suggestions:', error);
    } finally {
      setGenerating(false);
    }
  };

  const getSkillIcon = (skillType: string) => {
    const icons: Record<string, string> = {
      Grammar: '📝',
      Vocabulary: '📚',
      Listening: '👂',
      Writing: '✍️',
      Speaking: '🗣️',
      Reading: '📖'
    };
    return icons[skillType] || '📌';
  };

  const getPriorityColor = (priority: number) => {
    if (priority <= 2) return 'bg-red-100 border-red-300 text-red-800';
    if (priority <= 3) return 'bg-orange-100 border-orange-300 text-orange-800';
    return 'bg-blue-100 border-blue-300 text-blue-800';
  };

  const getPriorityLabel = (priority: number) => {
    if (priority === 1) return 'High Priority';
    if (priority === 2) return 'Important';
    if (priority === 3) return 'Recommended';
    return 'Suggested';
  };

  if (loading || generating) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">
          ✨ Daily Practice Suggestions
        </h2>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          <span className="ml-4 text-gray-600">
            {generating ? 'Generating personalized suggestions...' : 'Loading suggestions...'}
          </span>
        </div>
      </div>
    );
  }

  if (suggestions.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-gray-800">
            ✨ Daily Practice Suggestions
          </h2>
          <button
            onClick={handleRefresh}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
          >
            Generate Suggestions
          </button>
        </div>
        <p className="text-gray-600 text-center py-8">
          No suggestions available. Click "Generate Suggestions" to get personalized practice recommendations!
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold text-gray-800">
          ✨ Daily Practice Suggestions
        </h2>
        <button
          onClick={handleRefresh}
          disabled={generating}
          className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition disabled:opacity-50"
        >
          🔄 Refresh
        </button>
      </div>

      <p className="text-gray-600 mb-4">
        AI-powered recommendations based on your progress and goals
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {suggestions.map((suggestion) => (
          <div
            key={suggestion.id}
            className={`border-2 rounded-lg p-4 ${getPriorityColor(suggestion.priority)}`}
          >
            <div className="flex justify-between items-start mb-2">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{getSkillIcon(suggestion.skill_type)}</span>
                <div>
                  <h3 className="font-semibold text-gray-800">{suggestion.skill_type}</h3>
                  <span className="text-xs font-medium">
                    {getPriorityLabel(suggestion.priority)}
                  </span>
                </div>
              </div>
              <button
                onClick={() => handleDismiss(suggestion.id)}
                className="text-gray-500 hover:text-gray-700 text-lg"
                title="Dismiss"
              >
                ×
              </button>
            </div>

            <p className="text-sm font-medium text-gray-800 mb-2">
              {suggestion.topic}
            </p>

            <p className="text-xs text-gray-600 mb-3">
              {suggestion.reason}
            </p>

            <button
              onClick={() => onStartPractice(suggestion)}
              className="w-full px-4 py-2 bg-white border-2 border-current text-current rounded-lg hover:bg-gray-50 font-medium transition"
            >
              Start Practice →
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
