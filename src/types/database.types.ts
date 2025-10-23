export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          full_name: string | null
          avatar_url: string | null
          subscription_tier: 'free' | 'premium'
          subscription_status: 'active' | 'canceled' | 'expired' | null
          subscription_end_date: string | null
          created_at: string
          last_active: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          avatar_url?: string | null
          subscription_tier?: 'free' | 'premium'
          subscription_status?: 'active' | 'canceled' | 'expired' | null
          subscription_end_date?: string | null
          created_at?: string
          last_active?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          avatar_url?: string | null
          subscription_tier?: 'free' | 'premium'
          subscription_status?: 'active' | 'canceled' | 'expired' | null
          subscription_end_date?: string | null
          created_at?: string
          last_active?: string
        }
      }
      user_profiles: {
        Row: {
          id: string
          current_level: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'
          target_level: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2' | null
          target_exam_date: string | null
          daily_goal_minutes: number
          mother_language: string | null
          notification_preferences: Json | null
          study_streak: number
          total_study_time: number
          updated_at: string
        }
        Insert: {
          id: string
          current_level?: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'
          target_level?: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2' | null
          target_exam_date?: string | null
          daily_goal_minutes?: number
          mother_language?: string | null
          notification_preferences?: Json | null
          study_streak?: number
          total_study_time?: number
          updated_at?: string
        }
        Update: {
          id?: string
          current_level?: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'
          target_level?: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2' | null
          target_exam_date?: string | null
          daily_goal_minutes?: number
          mother_language?: string | null
          notification_preferences?: Json | null
          study_streak?: number
          total_study_time?: number
          updated_at?: string
        }
      }
      test_results: {
        Row: {
          id: string
          user_id: string
          test_type: 'placement' | 'practice' | 'mock_exam'
          level: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'
          sections: Json
          overall_score: number | null
          strengths: string[]
          weaknesses: string[]
          recommendations: string
          completed_at: string
        }
        Insert: {
          id?: string
          user_id: string
          test_type: 'placement' | 'practice' | 'mock_exam'
          level: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'
          sections: Json
          overall_score?: number | null
          strengths: string[]
          weaknesses: string[]
          recommendations: string
          completed_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          test_type?: 'placement' | 'practice' | 'mock_exam'
          level?: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'
          sections?: Json
          overall_score?: number | null
          strengths?: string[]
          weaknesses?: string[]
          recommendations?: string
          completed_at?: string
        }
      }
      learning_plans: {
        Row: {
          id: string
          user_id: string
          test_result_id: string | null
          target_level: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'
          goals: string[]
          duration_weeks: number
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          test_result_id?: string | null
          target_level: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'
          goals: string[]
          duration_weeks?: number
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          test_result_id?: string | null
          target_level?: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'
          goals?: string[]
          duration_weeks?: number
          is_active?: boolean
          created_at?: string
        }
      }
      learning_plan_items: {
        Row: {
          id: string
          learning_plan_id: string
          week_number: number
          week_focus: string
          topic: string
          skill: 'Grammar' | 'Vocabulary' | 'Listening' | 'Writing' | 'Speaking'
          description: string
          completed: boolean
          completed_at: string | null
        }
        Insert: {
          id?: string
          learning_plan_id: string
          week_number: number
          week_focus: string
          topic: string
          skill: 'Grammar' | 'Vocabulary' | 'Listening' | 'Writing' | 'Speaking'
          description: string
          completed?: boolean
          completed_at?: string | null
        }
        Update: {
          id?: string
          learning_plan_id?: string
          week_number?: number
          week_focus?: string
          topic?: string
          skill?: 'Grammar' | 'Vocabulary' | 'Listening' | 'Writing' | 'Speaking'
          description?: string
          completed?: boolean
          completed_at?: string | null
        }
      }
      flashcards: {
        Row: {
          id: string
          user_id: string
          word_german: string
          word_english: string
          example_sentence: string | null
          audio_url: string | null
          level: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'
          next_review_date: string
          review_count: number
          ease_factor: number
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          word_german: string
          word_english: string
          example_sentence?: string | null
          audio_url?: string | null
          level: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'
          next_review_date?: string
          review_count?: number
          ease_factor?: number
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          word_german?: string
          word_english?: string
          example_sentence?: string | null
          audio_url?: string | null
          level?: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'
          next_review_date?: string
          review_count?: number
          ease_factor?: number
          created_at?: string
        }
      }
      conversation_sessions: {
        Row: {
          id: string
          user_id: string
          duration_seconds: number
          transcript: Json
          feedback: string | null
          started_at: string
          ended_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          duration_seconds?: number
          transcript: Json
          feedback?: string | null
          started_at?: string
          ended_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          duration_seconds?: number
          transcript?: Json
          feedback?: string | null
          started_at?: string
          ended_at?: string | null
        }
      }
      achievements: {
        Row: {
          id: string
          name: string
          description: string
          icon: string
          criteria: Json
          points: number
        }
        Insert: {
          id?: string
          name: string
          description: string
          icon: string
          criteria: Json
          points: number
        }
        Update: {
          id?: string
          name?: string
          description?: string
          icon?: string
          criteria?: Json
          points?: number
        }
      }
      user_achievements: {
        Row: {
          id: string
          user_id: string
          achievement_id: string
          earned_at: string
        }
        Insert: {
          id?: string
          user_id: string
          achievement_id: string
          earned_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          achievement_id?: string
          earned_at?: string
        }
      }
      study_sessions: {
        Row: {
          id: string
          user_id: string
          activity_type: 'conversation' | 'flashcards' | 'listening' | 'reading' | 'writing' | 'grammar'
          duration_minutes: number
          items_completed: number
          date: string
        }
        Insert: {
          id?: string
          user_id: string
          activity_type: 'conversation' | 'flashcards' | 'listening' | 'reading' | 'writing' | 'grammar'
          duration_minutes: number
          items_completed: number
          date?: string
        }
        Update: {
          id?: string
          user_id?: string
          activity_type?: 'conversation' | 'flashcards' | 'listening' | 'reading' | 'writing' | 'grammar'
          duration_minutes?: number
          items_completed?: number
          date?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}
