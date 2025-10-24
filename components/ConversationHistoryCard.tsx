import React, { useState } from 'react';
import { ConversationFeedback } from '../services/conversationService';

interface ConversationSession {
  id: string;
  started_at: string;
  ended_at: string;
  duration_seconds: number;
  feedback: string | ConversationFeedback | null;
  transcript: Array<{
    speaker: string;
    text: string;
    timestamp: string;
  }>;
}

interface ConversationHistoryCardProps {
  session: ConversationSession;
}

const ConversationHistoryCard: React.FC<ConversationHistoryCardProps> = ({ session }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);

  // Parse feedback if it's a string
  const feedback: ConversationFeedback | null =
    typeof session.feedback === 'string'
      ? JSON.parse(session.feedback)
      : session.feedback;

  // Format duration
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  // Format date
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Get score color
  const getScoreColor = (score: number): string => {
    if (score >= 80) return 'text-green-600 bg-green-100';
    if (score >= 60) return 'text-blue-600 bg-blue-100';
    if (score >= 40) return 'text-yellow-600 bg-yellow-100';
    return 'text-orange-600 bg-orange-100';
  };

  if (!feedback) {
    return (
      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <p className="text-sm text-gray-600">
              {formatDate(session.started_at)}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              Duration: {formatDuration(session.duration_seconds)}
            </p>
          </div>
          <span className="px-3 py-1 rounded-full text-xs font-medium bg-gray-200 text-gray-600">
            No feedback
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1">
          <p className="text-sm text-gray-600 font-medium">
            {formatDate(session.started_at)}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            <i className="fa-solid fa-clock mr-1"></i>
            {formatDuration(session.duration_seconds)}
          </p>
        </div>
        <div className={`px-4 py-2 rounded-full text-sm font-bold ${getScoreColor(feedback.overall_score)}`}>
          {feedback.overall_score}/100
        </div>
      </div>

      {/* Quick Summary */}
      <div className="mb-3">
        <p className="text-sm text-gray-700 italic">"{feedback.encouragement}"</p>
      </div>

      {/* Toggle Details Button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1 mb-2"
      >
        <i className={`fa-solid fa-chevron-${isExpanded ? 'up' : 'down'}`}></i>
        {isExpanded ? 'Hide Details' : 'Show Details'}
      </button>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="space-y-4 pt-3 border-t border-gray-200">
          {/* Strengths */}
          {feedback.strengths.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-green-700 mb-2 flex items-center gap-2">
                <i className="fa-solid fa-check-circle"></i>
                Strengths
              </h4>
              <ul className="space-y-1">
                {feedback.strengths.map((strength, idx) => (
                  <li key={idx} className="text-sm text-gray-700 pl-4">
                    • {strength}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Areas for Improvement */}
          {feedback.areas_for_improvement.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-orange-700 mb-2 flex items-center gap-2">
                <i className="fa-solid fa-arrow-up"></i>
                Areas for Improvement
              </h4>
              <ul className="space-y-1">
                {feedback.areas_for_improvement.map((area, idx) => (
                  <li key={idx} className="text-sm text-gray-700 pl-4">
                    • {area}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Grammar Corrections */}
          {feedback.grammar_corrections.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-red-700 mb-2 flex items-center gap-2">
                <i className="fa-solid fa-spell-check"></i>
                Grammar Corrections
              </h4>
              <div className="space-y-2">
                {feedback.grammar_corrections.map((correction, idx) => (
                  <div key={idx} className="bg-red-50 p-3 rounded-lg">
                    <div className="grid grid-cols-2 gap-2 text-sm mb-2">
                      <div>
                        <span className="text-xs text-red-600 font-medium">Incorrect:</span>
                        <p className="text-gray-700 line-through">{correction.original}</p>
                      </div>
                      <div>
                        <span className="text-xs text-green-600 font-medium">Correct:</span>
                        <p className="text-gray-700 font-medium">{correction.corrected}</p>
                      </div>
                    </div>
                    <p className="text-xs text-gray-600 italic">{correction.explanation}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Vocabulary Suggestions */}
          {feedback.vocabulary_suggestions.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-purple-700 mb-2 flex items-center gap-2">
                <i className="fa-solid fa-book"></i>
                Vocabulary Suggestions
              </h4>
              <div className="flex flex-wrap gap-2">
                {feedback.vocabulary_suggestions.map((word, idx) => (
                  <span
                    key={idx}
                    className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm font-medium"
                  >
                    {word}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Fluency Notes */}
          {feedback.fluency_notes && (
            <div>
              <h4 className="text-sm font-semibold text-blue-700 mb-2 flex items-center gap-2">
                <i className="fa-solid fa-comments"></i>
                Fluency Assessment
              </h4>
              <p className="text-sm text-gray-700 bg-blue-50 p-3 rounded-lg">
                {feedback.fluency_notes}
              </p>
            </div>
          )}

          {/* View Transcript Button */}
          <button
            onClick={() => setShowTranscript(!showTranscript)}
            className="w-full py-2 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
          >
            <i className={`fa-solid fa-${showTranscript ? 'eye-slash' : 'eye'}`}></i>
            {showTranscript ? 'Hide Transcript' : 'View Transcript'}
          </button>

          {/* Transcript */}
          {showTranscript && session.transcript && session.transcript.length > 0 && (
            <div className="bg-gray-50 p-4 rounded-lg max-h-96 overflow-y-auto">
              <h4 className="text-sm font-semibold text-gray-700 mb-3">Conversation Transcript</h4>
              <div className="space-y-3">
                {session.transcript.map((entry, idx) => (
                  <div
                    key={idx}
                    className={`p-3 rounded-lg ${
                      entry.speaker === 'user'
                        ? 'bg-blue-100 text-blue-900 ml-4'
                        : 'bg-gray-200 text-gray-900 mr-4'
                    }`}
                  >
                    <p className="text-xs font-semibold mb-1">
                      {entry.speaker === 'user' ? 'You' : 'Alex'}
                    </p>
                    <p className="text-sm">{entry.text}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ConversationHistoryCard;
