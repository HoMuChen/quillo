export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      article_images: {
        Row: {
          alt: string | null
          article_id: string
          caption: string | null
          created_at: string
          id: string
          kind: string
          remote_refs: Json
          storage_path: string
          tenant_id: string
          url: string
        }
        Insert: {
          alt?: string | null
          article_id: string
          caption?: string | null
          created_at?: string
          id?: string
          kind: string
          remote_refs?: Json
          storage_path: string
          tenant_id: string
          url: string
        }
        Update: {
          alt?: string | null
          article_id?: string
          caption?: string | null
          created_at?: string
          id?: string
          kind?: string
          remote_refs?: Json
          storage_path?: string
          tenant_id?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "article_images_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
        ]
      }
      article_outlines: {
        Row: {
          article_id: string
          sections: Json
          tenant_id: string
          updated_at: string
        }
        Insert: {
          article_id: string
          sections?: Json
          tenant_id: string
          updated_at?: string
        }
        Update: {
          article_id?: string
          sections?: Json
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "article_outlines_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: true
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
        ]
      }
      articles: {
        Row: {
          body_markdown: string | null
          body_tiptap: Json | null
          canonical_url: string | null
          created_at: string
          excerpt: string | null
          feature_image_url: string | null
          focus_keyword: string | null
          id: string
          lsi_keywords: string[]
          meta_description: string | null
          meta_title: string | null
          pillar_id: string | null
          platform_meta: Json
          position: number
          project_id: string
          role: string | null
          search_intent: string | null
          slug: string | null
          source: string
          status: string
          tags: string[]
          target_keyword: string | null
          tenant_id: string
          title: string
          updated_at: string
          word_count_target: number | null
        }
        Insert: {
          body_markdown?: string | null
          body_tiptap?: Json | null
          canonical_url?: string | null
          created_at?: string
          excerpt?: string | null
          feature_image_url?: string | null
          focus_keyword?: string | null
          id?: string
          lsi_keywords?: string[]
          meta_description?: string | null
          meta_title?: string | null
          pillar_id?: string | null
          platform_meta?: Json
          position?: number
          project_id: string
          role?: string | null
          search_intent?: string | null
          slug?: string | null
          source?: string
          status?: string
          tags?: string[]
          target_keyword?: string | null
          tenant_id: string
          title: string
          updated_at?: string
          word_count_target?: number | null
        }
        Update: {
          body_markdown?: string | null
          body_tiptap?: Json | null
          canonical_url?: string | null
          created_at?: string
          excerpt?: string | null
          feature_image_url?: string | null
          focus_keyword?: string | null
          id?: string
          lsi_keywords?: string[]
          meta_description?: string | null
          meta_title?: string | null
          pillar_id?: string | null
          platform_meta?: Json
          position?: number
          project_id?: string
          role?: string | null
          search_intent?: string | null
          slug?: string | null
          source?: string
          status?: string
          tags?: string[]
          target_keyword?: string | null
          tenant_id?: string
          title?: string
          updated_at?: string
          word_count_target?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "articles_pillar_id_fkey"
            columns: ["pillar_id"]
            isOneToOne: false
            referencedRelation: "pillars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "articles_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_materials: {
        Row: {
          author_background: string | null
          ee_at_cases: string | null
          forbidden_terms: string[]
          preferred_terms: string[]
          project_id: string
          reader_persona: string | null
          tenant_id: string
          tone: string | null
          updated_at: string
        }
        Insert: {
          author_background?: string | null
          ee_at_cases?: string | null
          forbidden_terms?: string[]
          preferred_terms?: string[]
          project_id: string
          reader_persona?: string | null
          tenant_id: string
          tone?: string | null
          updated_at?: string
        }
        Update: {
          author_background?: string | null
          ee_at_cases?: string | null
          forbidden_terms?: string[]
          preferred_terms?: string[]
          project_id?: string
          reader_persona?: string | null
          tenant_id?: string
          tone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_materials_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      gsc_connections: {
        Row: {
          access_token_encrypted: string | null
          access_token_expires_at: string | null
          created_at: string
          google_user_email: string
          id: string
          last_sync_error: string | null
          last_sync_status: string | null
          last_synced_at: string | null
          project_id: string
          property_url: string
          refresh_token_encrypted: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          access_token_encrypted?: string | null
          access_token_expires_at?: string | null
          created_at?: string
          google_user_email: string
          id?: string
          last_sync_error?: string | null
          last_sync_status?: string | null
          last_synced_at?: string | null
          project_id: string
          property_url: string
          refresh_token_encrypted: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          access_token_encrypted?: string | null
          access_token_expires_at?: string | null
          created_at?: string
          google_user_email?: string
          id?: string
          last_sync_error?: string | null
          last_sync_status?: string | null
          last_synced_at?: string | null
          project_id?: string
          property_url?: string
          refresh_token_encrypted?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gsc_connections_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      gsc_daily_query_page: {
        Row: {
          clicks: number
          ctr: number
          date: string
          impressions: number
          normalized_page_url: string
          page_url: string
          position: number
          project_id: string
          query: string
          tenant_id: string
        }
        Insert: {
          clicks?: number
          ctr?: number
          date: string
          impressions?: number
          normalized_page_url?: string
          page_url: string
          position?: number
          project_id: string
          query: string
          tenant_id: string
        }
        Update: {
          clicks?: number
          ctr?: number
          date?: string
          impressions?: number
          normalized_page_url?: string
          page_url?: string
          position?: number
          project_id?: string
          query?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gsc_daily_query_page_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      gsc_sync_runs: {
        Row: {
          error: string | null
          finished_at: string | null
          id: string
          project_id: string
          rows_inserted: number
          started_at: string
          status: string
          tenant_id: string
        }
        Insert: {
          error?: string | null
          finished_at?: string | null
          id?: string
          project_id: string
          rows_inserted?: number
          started_at?: string
          status: string
          tenant_id: string
        }
        Update: {
          error?: string | null
          finished_at?: string | null
          id?: string
          project_id?: string
          rows_inserted?: number
          started_at?: string
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gsc_sync_runs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      interview_questions: {
        Row: {
          answer: string | null
          article_id: string
          id: string
          position: number
          question: string
          section_id: string
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          answer?: string | null
          article_id: string
          id?: string
          position: number
          question: string
          section_id: string
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          answer?: string | null
          article_id?: string
          id?: string
          position?: number
          question?: string
          section_id?: string
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "interview_questions_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
        ]
      }
      pillars: {
        Row: {
          created_at: string
          description: string | null
          id: string
          position: number
          project_id: string
          search_intent: string | null
          target_keyword: string | null
          tenant_id: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          position?: number
          project_id: string
          search_intent?: string | null
          target_keyword?: string | null
          tenant_id: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          position?: number
          project_id?: string
          search_intent?: string | null
          target_keyword?: string | null
          tenant_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pillars_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          audience: string | null
          content_locale: string
          created_at: string
          domain: string | null
          id: string
          name: string
          tenant_id: string
          theme: string | null
          updated_at: string
        }
        Insert: {
          audience?: string | null
          content_locale?: string
          created_at?: string
          domain?: string | null
          id?: string
          name: string
          tenant_id: string
          theme?: string | null
          updated_at?: string
        }
        Update: {
          audience?: string | null
          content_locale?: string
          created_at?: string
          domain?: string | null
          id?: string
          name?: string
          tenant_id?: string
          theme?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      publish_logs: {
        Row: {
          action: string
          created_at: string
          error_message: string | null
          id: string
          publish_target_id: string
          status: string
          tenant_id: string
        }
        Insert: {
          action: string
          created_at?: string
          error_message?: string | null
          id?: string
          publish_target_id: string
          status: string
          tenant_id: string
        }
        Update: {
          action?: string
          created_at?: string
          error_message?: string | null
          id?: string
          publish_target_id?: string
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "publish_logs_publish_target_id_fkey"
            columns: ["publish_target_id"]
            isOneToOne: false
            referencedRelation: "publish_targets"
            referencedColumns: ["id"]
          },
        ]
      }
      publish_targets: {
        Row: {
          article_id: string
          connection_id: string
          id: string
          normalized_url: string | null
          published_at: string | null
          remote_post_id: string | null
          remote_status: string | null
          remote_url: string | null
          scheduled_for: string | null
          tenant_id: string
          updated_at: string
          url_history: Json
        }
        Insert: {
          article_id: string
          connection_id: string
          id?: string
          normalized_url?: string | null
          published_at?: string | null
          remote_post_id?: string | null
          remote_status?: string | null
          remote_url?: string | null
          scheduled_for?: string | null
          tenant_id: string
          updated_at?: string
          url_history?: Json
        }
        Update: {
          article_id?: string
          connection_id?: string
          id?: string
          normalized_url?: string | null
          published_at?: string | null
          remote_post_id?: string | null
          remote_status?: string | null
          remote_url?: string | null
          scheduled_for?: string | null
          tenant_id?: string
          updated_at?: string
          url_history?: Json
        }
        Relationships: [
          {
            foreignKeyName: "publish_targets_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "publish_targets_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "site_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      site_connections: {
        Row: {
          config_encrypted: string
          created_at: string
          id: string
          last_test_ok: boolean | null
          last_tested_at: string | null
          name: string
          platform: string
          project_id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          config_encrypted: string
          created_at?: string
          id?: string
          last_test_ok?: boolean | null
          last_tested_at?: string | null
          name: string
          platform: string
          project_id: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          config_encrypted?: string
          created_at?: string
          id?: string
          last_test_ok?: boolean | null
          last_tested_at?: string | null
          name?: string
          platform?: string
          project_id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_connections_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_members: {
        Row: {
          created_at: string
          role: string
          tenant_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          role?: string
          tenant_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          role?: string
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_members_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_pillar_plan: {
        Args: { p_plan: Json; p_project_id: string }
        Returns: Json
      }
      normalize_url: { Args: { u: string }; Returns: string }
      user_tenant_ids: { Args: never; Returns: string[] }
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
  public: {
    Enums: {},
  },
} as const

