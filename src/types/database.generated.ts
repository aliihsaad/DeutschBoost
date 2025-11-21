export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      achievements: {
        Row: {
          criteria: Json
          description: string
          icon: string
          id: string
          name: string
          points: number | null
        }
        Insert: {
          criteria: Json
          description: string
          icon: string
          id?: string
          name: string
          points?: number | null
        }
        Update: {
          criteria?: Json
          description?: string
          icon?: string
          id?: string
          name?: string
          points?: number | null
        }
        Relationships: []
      }
      conversation_sessions: {
        Row: {
          duration_seconds: number | null
          ended_at: string | null
          feedback: string | null
          id: string
          mode: string | null
          started_at: string | null
          transcript: Json
          user_id: string
        }
        Insert: {
          duration_seconds?: number | null
          ended_at?: string | null
          feedback?: string | null
          id?: string
          mode?: string | null
          started_at?: string | null
          transcript?: Json
          user_id: string
        }
        Update: {
          duration_seconds?: number | null
          ended_at?: string | null
          feedback?: string | null
          id?: string
          mode?: string | null
          started_at?: string | null
          transcript?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_practice_suggestions: {
        Row: {
          completed_at: string | null
          created_at: string | null
          id: string
          is_completed: boolean | null
          is_dismissed: boolean | null
          level: string
          priority: number | null
          reason: string
          skill_type: string
          suggested_date: string | null
          topic: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          id?: string
          is_completed?: boolean | null
          is_dismissed?: boolean | null
          level: string
          priority?: number | null
          reason: string
          skill_type: string
          suggested_date?: string | null
          topic: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          id?: string
          is_completed?: boolean | null
          is_dismissed?: boolean | null
          level?: string
          priority?: number | null
          reason?: string
          skill_type?: string
          suggested_date?: string | null
          topic?: string
          user_id?: string
        }
        Relationships: []
      }
      flashcards: {
        Row: {
          audio_url: string | null
          created_at: string | null
          ease_factor: number | null
          example_sentence: string | null
          id: string
          level: string
          next_review_date: string | null
          review_count: number | null
          user_id: string
          word_english: string
          word_german: string
        }
        Insert: {
          audio_url?: string | null
          created_at?: string | null
          ease_factor?: number | null
          example_sentence?: string | null
          id?: string
          level: string
          next_review_date?: string | null
          review_count?: number | null
          user_id: string
          word_english: string
          word_german: string
        }
        Update: {
          audio_url?: string | null
          created_at?: string | null
          ease_factor?: number | null
          example_sentence?: string | null
          id?: string
          level?: string
          next_review_date?: string | null
          review_count?: number | null
          user_id?: string
          word_english?: string
          word_german?: string
        }
        Relationships: [
          {
            foreignKeyName: "flashcards_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_plan_items: {
        Row: {
          completed: boolean | null
          completed_at: string | null
          description: string
          id: string
          learning_plan_id: string
          skill: string
          topic: string
          week_focus: string
          week_number: number
        }
        Insert: {
          completed?: boolean | null
          completed_at?: string | null
          description: string
          id?: string
          learning_plan_id: string
          skill: string
          topic: string
          week_focus: string
          week_number: number
        }
        Update: {
          completed?: boolean | null
          completed_at?: string | null
          description?: string
          id?: string
          learning_plan_id?: string
          skill?: string
          topic?: string
          week_focus?: string
          week_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "learning_plan_items_learning_plan_id_fkey"
            columns: ["learning_plan_id"]
            isOneToOne: false
            referencedRelation: "learning_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_plans: {
        Row: {
          created_at: string | null
          duration_weeks: number | null
          goals: string[]
          id: string
          is_active: boolean | null
          target_level: string
          test_result_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          duration_weeks?: number | null
          goals?: string[]
          id?: string
          is_active?: boolean | null
          target_level: string
          test_result_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          duration_weeks?: number | null
          goals?: string[]
          id?: string
          is_active?: boolean | null
          target_level?: string
          test_result_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "learning_plans_test_result_id_fkey"
            columns: ["test_result_id"]
            isOneToOne: false
            referencedRelation: "test_results"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_plans_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      mock_exam_sessions: {
        Row: {
          completed_at: string | null
          created_at: string | null
          current_section: string | null
          exam_data: Json
          exam_level: string
          id: string
          overall_percentage: number | null
          passed: boolean | null
          results: Json | null
          section_timings: Json | null
          started_at: string
          status: string
          time_remaining_seconds: Json | null
          updated_at: string | null
          user_answers: Json | null
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          current_section?: string | null
          exam_data: Json
          exam_level: string
          id?: string
          overall_percentage?: number | null
          passed?: boolean | null
          results?: Json | null
          section_timings?: Json | null
          started_at?: string
          status: string
          time_remaining_seconds?: Json | null
          updated_at?: string | null
          user_answers?: Json | null
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          current_section?: string | null
          exam_data?: Json
          exam_level?: string
          id?: string
          overall_percentage?: number | null
          passed?: boolean | null
          results?: Json | null
          section_timings?: Json | null
          started_at?: string
          status?: string
          time_remaining_seconds?: Json | null
          updated_at?: string | null
          user_answers?: Json | null
          user_id?: string
        }
        Relationships: []
      }
      practice_sessions: {
        Row: {
          activity_type: string
          areas_for_improvement: string[] | null
          completed_at: string | null
          duration_minutes: number
          exam_sections: Json | null
          feedback: string | null
          id: string
          is_mock_exam: boolean | null
          items_completed: number | null
          level: string
          score: number | null
          started_at: string | null
          strengths: string[] | null
          topic: string | null
          user_id: string
        }
        Insert: {
          activity_type: string
          areas_for_improvement?: string[] | null
          completed_at?: string | null
          duration_minutes?: number
          exam_sections?: Json | null
          feedback?: string | null
          id?: string
          is_mock_exam?: boolean | null
          items_completed?: number | null
          level: string
          score?: number | null
          started_at?: string | null
          strengths?: string[] | null
          topic?: string | null
          user_id: string
        }
        Update: {
          activity_type?: string
          areas_for_improvement?: string[] | null
          completed_at?: string | null
          duration_minutes?: number
          exam_sections?: Json | null
          feedback?: string | null
          id?: string
          is_mock_exam?: boolean | null
          items_completed?: number | null
          level?: string
          score?: number | null
          started_at?: string | null
          strengths?: string[] | null
          topic?: string | null
          user_id?: string
        }
        Relationships: []
      }
      study_sessions: {
        Row: {
          activity_type: string
          date: string | null
          duration_minutes: number
          id: string
          items_completed: number | null
          user_id: string
        }
        Insert: {
          activity_type: string
          date?: string | null
          duration_minutes: number
          id?: string
          items_completed?: number | null
          user_id: string
        }
        Update: {
          activity_type?: string
          date?: string | null
          duration_minutes?: number
          id?: string
          items_completed?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "study_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      test_results: {
        Row: {
          completed_at: string | null
          id: string
          level: string
          overall_score: number | null
          recommendations: string
          sections: Json
          strengths: string[]
          test_type: string
          user_id: string
          weaknesses: string[]
        }
        Insert: {
          completed_at?: string | null
          id?: string
          level: string
          overall_score?: number | null
          recommendations: string
          sections?: Json
          strengths?: string[]
          test_type: string
          user_id: string
          weaknesses?: string[]
        }
        Update: {
          completed_at?: string | null
          id?: string
          level?: string
          overall_score?: number | null
          recommendations?: string
          sections?: Json
          strengths?: string[]
          test_type?: string
          user_id?: string
          weaknesses?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "test_results_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_achievements: {
        Row: {
          achievement_id: string
          earned_at: string | null
          id: string
          user_id: string
        }
        Insert: {
          achievement_id: string
          earned_at?: string | null
          id?: string
          user_id: string
        }
        Update: {
          achievement_id?: string
          earned_at?: string | null
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_achievements_achievement_id_fkey"
            columns: ["achievement_id"]
            isOneToOne: false
            referencedRelation: "achievements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_achievements_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          current_level: string | null
          daily_goal_minutes: number | null
          id: string
          mother_language: string | null
          notification_preferences: Json | null
          study_streak: number | null
          target_exam_date: string | null
          target_level: string | null
          total_study_time: number | null
          updated_at: string | null
        }
        Insert: {
          current_level?: string | null
          daily_goal_minutes?: number | null
          id: string
          mother_language?: string | null
          notification_preferences?: Json | null
          study_streak?: number | null
          target_exam_date?: string | null
          target_level?: string | null
          total_study_time?: number | null
          updated_at?: string | null
        }
        Update: {
          current_level?: string | null
          daily_goal_minutes?: number | null
          id?: string
          mother_language?: string | null
          notification_preferences?: Json | null
          study_streak?: number | null
          target_exam_date?: string | null
          target_level?: string | null
          total_study_time?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_profiles_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string
          full_name: string | null
          id: string
          last_active: string | null
          subscription_end_date: string | null
          subscription_status: string | null
          subscription_tier: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email: string
          full_name?: string | null
          id: string
          last_active?: string | null
          subscription_end_date?: string | null
          subscription_status?: string | null
          subscription_tier?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string
          full_name?: string | null
          id?: string
          last_active?: string | null
          subscription_end_date?: string | null
          subscription_status?: string | null
          subscription_tier?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      ensure_user_exists: {
        Args: { user_email: string; user_id: string }
        Returns: undefined
      }
      get_practice_stats: {
        Args: { p_days?: number; p_user_id: string }
        Returns: {
          average_score: number
          recent_sessions: Json
          skills_practiced: Json
          total_minutes: number
          total_sessions: number
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
