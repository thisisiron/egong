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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      academy: {
        Row: {
          contract_started_at: string | null
          created_at: string
          created_by: string | null
          id: string
          name: string
          settings: Json
          status: Database["public"]["Enums"]["academy_status"]
        }
        Insert: {
          contract_started_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          settings?: Json
          status?: Database["public"]["Enums"]["academy_status"]
        }
        Update: {
          contract_started_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          settings?: Json
          status?: Database["public"]["Enums"]["academy_status"]
        }
        Relationships: [
          {
            foreignKeyName: "academy_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_audit_log: {
        Row: {
          academy_id: string | null
          action: string
          admin_user_id: string
          created_at: string
          id: string
          metadata: Json
          target_id: string | null
          target_table: string | null
        }
        Insert: {
          academy_id?: string | null
          action: string
          admin_user_id: string
          created_at?: string
          id?: string
          metadata?: Json
          target_id?: string | null
          target_table?: string | null
        }
        Update: {
          academy_id?: string | null
          action?: string
          admin_user_id?: string
          created_at?: string
          id?: string
          metadata?: Json
          target_id?: string | null
          target_table?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_audit_log_academy_id_fkey"
            columns: ["academy_id"]
            isOneToOne: false
            referencedRelation: "academy"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_audit_log_admin_user_id_fkey"
            columns: ["admin_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance: {
        Row: {
          excused_reason: string | null
          id: string
          marked_at: string
          marked_by: string | null
          needs_makeup: boolean
          session_id: string
          status: Database["public"]["Enums"]["attendance_status"]
          student_id: string
        }
        Insert: {
          excused_reason?: string | null
          id?: string
          marked_at?: string
          marked_by?: string | null
          needs_makeup?: boolean
          session_id: string
          status: Database["public"]["Enums"]["attendance_status"]
          student_id: string
        }
        Update: {
          excused_reason?: string | null
          id?: string
          marked_at?: string
          marked_by?: string | null
          needs_makeup?: boolean
          session_id?: string
          status?: Database["public"]["Enums"]["attendance_status"]
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_marked_by_fkey"
            columns: ["marked_by"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      class_students: {
        Row: {
          class_id: string
          id: string
          joined_at: string
          left_at: string | null
          student_id: string
        }
        Insert: {
          class_id: string
          id?: string
          joined_at?: string
          left_at?: string | null
          student_id: string
        }
        Update: {
          class_id?: string
          id?: string
          joined_at?: string
          left_at?: string | null
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_students_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_students_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      class_teachers: {
        Row: {
          class_id: string
          teacher_id: string
        }
        Insert: {
          class_id: string
          teacher_id: string
        }
        Update: {
          class_id?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_teachers_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_teachers_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      classes: {
        Row: {
          academy_id: string
          created_at: string
          description: string | null
          id: string
          level: Database["public"]["Enums"]["class_level"]
          name: string
        }
        Insert: {
          academy_id: string
          created_at?: string
          description?: string | null
          id?: string
          level: Database["public"]["Enums"]["class_level"]
          name: string
        }
        Update: {
          academy_id?: string
          created_at?: string
          description?: string | null
          id?: string
          level?: Database["public"]["Enums"]["class_level"]
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "classes_academy_id_fkey"
            columns: ["academy_id"]
            isOneToOne: false
            referencedRelation: "academy"
            referencedColumns: ["id"]
          },
        ]
      }
      parents: {
        Row: {
          created_at: string
          id: string
          name: string
          phone: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          phone?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          phone?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "parents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          class_id: string
          created_at: string
          id: string
          scheduled_at: string
          title: string
          unit: string | null
          video_notes: string | null
          video_url: string | null
        }
        Insert: {
          class_id: string
          created_at?: string
          id?: string
          scheduled_at: string
          title: string
          unit?: string | null
          video_notes?: string | null
          video_url?: string | null
        }
        Update: {
          class_id?: string
          created_at?: string
          id?: string
          scheduled_at?: string
          title?: string
          unit?: string | null
          video_notes?: string | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sessions_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      student_parent: {
        Row: {
          parent_id: string
          relationship: Database["public"]["Enums"]["parent_relationship"]
          student_id: string
        }
        Insert: {
          parent_id: string
          relationship?: Database["public"]["Enums"]["parent_relationship"]
          student_id: string
        }
        Update: {
          parent_id?: string
          relationship?: Database["public"]["Enums"]["parent_relationship"]
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_parent_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "parents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_parent_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          academy_id: string
          created_at: string
          grade: string | null
          id: string
          name: string
          school: string | null
          status: Database["public"]["Enums"]["student_status"]
          user_id: string | null
        }
        Insert: {
          academy_id: string
          created_at?: string
          grade?: string | null
          id?: string
          name: string
          school?: string | null
          status?: Database["public"]["Enums"]["student_status"]
          user_id?: string | null
        }
        Update: {
          academy_id?: string
          created_at?: string
          grade?: string | null
          id?: string
          name?: string
          school?: string | null
          status?: Database["public"]["Enums"]["student_status"]
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "students_academy_id_fkey"
            columns: ["academy_id"]
            isOneToOne: false
            referencedRelation: "academy"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      teachers: {
        Row: {
          academy_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          academy_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          academy_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teachers_academy_id_fkey"
            columns: ["academy_id"]
            isOneToOne: false
            referencedRelation: "academy"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teachers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          academy_id: string | null
          created_at: string
          display_name: string
          email: string | null
          id: string
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
        }
        Insert: {
          academy_id?: string | null
          created_at?: string
          display_name: string
          email?: string | null
          id: string
          phone?: string | null
          role: Database["public"]["Enums"]["user_role"]
        }
        Update: {
          academy_id?: string | null
          created_at?: string
          display_name?: string
          email?: string | null
          id?: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
        }
        Relationships: [
          {
            foreignKeyName: "users_academy_id_fkey"
            columns: ["academy_id"]
            isOneToOne: false
            referencedRelation: "academy"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      attendance_counts: {
        Args: { p_from: string; p_student_id: string; p_to: string }
        Returns: {
          absent_count: number
          excused_count: number
          late_count: number
          present_count: number
        }[]
      }
      attendance_rate: {
        Args: { p_from: string; p_student_id: string; p_to: string }
        Returns: number
      }
      current_user_academy: { Args: never; Returns: string }
      current_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      is_admin: { Args: never; Returns: boolean }
    }
    Enums: {
      academy_status: "active" | "suspended" | "deleted"
      attendance_status: "present" | "late" | "absent" | "excused"
      class_level: "elementary" | "middle" | "high"
      parent_relationship: "mother" | "father" | "other"
      student_status: "enrolled" | "paused" | "graduated"
      user_role: "admin" | "owner" | "teacher" | "student" | "parent"
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
  public: {
    Enums: {
      academy_status: ["active", "suspended", "deleted"],
      attendance_status: ["present", "late", "absent", "excused"],
      class_level: ["elementary", "middle", "high"],
      parent_relationship: ["mother", "father", "other"],
      student_status: ["enrolled", "paused", "graduated"],
      user_role: ["admin", "owner", "teacher", "student", "parent"],
    },
  },
} as const
