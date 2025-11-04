/**
 * PracticeStatsWidget Component
 * Displays practice statistics and recent sessions
 */

import React, { useEffect, useState } from 'react';
import { PracticeStats } from '../types';
import { getPracticeStats } from '../services/practiceService';
import { useAuth } from '../src/contexts/AuthContext';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

interface PracticeStatsWidgetProps {
  days?: number; // Number of days to show stats for (default: 7)
}

export const PracticeStatsWidget: React.FC<PracticeStatsWidgetProps> = ({ days = 7 }) => {
  const { user } = useAuth();
  const [stats, setStats] = useState<PracticeStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, [user, days]);

  const loadStats = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const practiceStats = await getPracticeStats(user.id, days);
      setStats(practiceStats);
    } catch (error) {
      console.error('Error loading practice stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-xl font-bold text-gray-800 mb-4">
          📊 Practice Statistics
        </h3>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
        </div>
      </div>
    );
  }

  if (!stats || stats.total_sessions === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-xl font-bold text-gray-800 mb-4">
          📊 Practice Statistics
        </h3>
        <div className="text-center py-8 text-gray-600">
          <p className="mb-2">No practice sessions yet!</p>
          <p className="text-sm">Start practicing to see your statistics here.</p>
        </div>
      </div>
    );
  }

  // Prepare data for skills chart
  const skillsData = Object.entries(stats.skills_practiced || {}).map(([skill, count]) => ({
    skill,
    count
  }));

  // Colors for pie chart
  const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4'];

  // Format time
  const formatTime = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-xl font-bold text-gray-800 mb-4">
        📊 Practice Statistics ({days === 7 ? 'This Week' : `Last ${days} Days`})
      </h3>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-lg p-4 border border-indigo-200">
          <p className="text-sm text-indigo-600 font-medium">Total Sessions</p>
          <p className="text-3xl font-bold text-indigo-900">{stats.total_sessions}</p>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4 border border-purple-200">
          <p className="text-sm text-purple-600 font-medium">Total Time</p>
          <p className="text-3xl font-bold text-purple-900">{formatTime(stats.total_minutes)}</p>
        </div>

        <div className="bg-gradient-to-br from-pink-50 to-pink-100 rounded-lg p-4 border border-pink-200">
          <p className="text-sm text-pink-600 font-medium">Average Score</p>
          <p className="text-3xl font-bold text-pink-900">
            {stats.average_score > 0 ? `${stats.average_score.toFixed(0)}%` : 'N/A'}
          </p>
        </div>
      </div>

      {/* Skills Breakdown */}
      {skillsData.length > 0 && (
        <div className="mb-6">
          <h4 className="font-semibold text-gray-800 mb-3">Skills Practiced</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Bar Chart */}
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={skillsData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="skill"
                    tick={{ fontSize: 12 }}
                    angle={-45}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#6366f1" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Pie Chart */}
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={skillsData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ skill, percent }) => `${skill.slice(0, 3)} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={60}
                    fill="#8884d8"
                    dataKey="count"
                  >
                    {skillsData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Recent Sessions */}
      {stats.recent_sessions && stats.recent_sessions.length > 0 && (
        <div>
          <h4 className="font-semibold text-gray-800 mb-3">Recent Sessions</h4>
          <div className="space-y-2">
            {stats.recent_sessions.map((session) => (
              <div
                key={session.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">
                    {session.activity_type === 'Grammar' && '📝'}
                    {session.activity_type === 'Vocabulary' && '📚'}
                    {session.activity_type === 'Listening' && '👂'}
                    {session.activity_type === 'Writing' && '✍️'}
                    {session.activity_type === 'Speaking' && '🗣️'}
                    {session.activity_type === 'Reading' && '📖'}
                    {session.activity_type === 'Mock Exam' && '📋'}
                  </span>
                  <div>
                    <p className="font-medium text-gray-800">{session.activity_type}</p>
                    {session.topic && (
                      <p className="text-xs text-gray-600">{session.topic}</p>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  {session.score !== undefined && session.score !== null && (
                    <p className={`font-bold ${session.score >= 70 ? 'text-green-600' : 'text-orange-600'}`}>
                      {session.score}%
                    </p>
                  )}
                  <p className="text-xs text-gray-500">{formatDate(session.completed_at)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
