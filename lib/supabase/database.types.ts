export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: '14.1';
  };
  public: {
    Tables: {
      answers: {
        Row: {
          created_at: string;
          game_id: string;
          id: string;
          option_id: string;
          player_id: string;
          question_index: number;
          score: number;
          time_taken: number;
        };
        Insert: {
          created_at?: string;
          game_id: string;
          id?: string;
          option_id: string;
          player_id: string;
          question_index: number;
          score?: number;
          time_taken: number;
        };
        Update: {
          created_at?: string;
          game_id?: string;
          id?: string;
          option_id?: string;
          player_id?: string;
          question_index?: number;
          score?: number;
          time_taken?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'answers_game_id_fkey';
            columns: ['game_id'];
            isOneToOne: false;
            referencedRelation: 'games';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'answers_player_id_fkey';
            columns: ['player_id'];
            isOneToOne: false;
            referencedRelation: 'players';
            referencedColumns: ['id'];
          },
        ];
      };
      games: {
        Row: {
          created_at: string;
          current_question_index: number;
          current_round_data: Json | null;
          game_code: string;
          game_password_hash: string;
          game_password_salt: string;
          host_user_id: string;
          id: string;
          last_leaderboard: Json | null;
          last_round_result: Json | null;
          round_ends_at: string | null;
          round_started_at: string | null;
          status: string;
          title: string;
        };
        Insert: {
          created_at?: string;
          current_question_index?: number;
          current_round_data?: Json | null;
          game_code: string;
          game_password_hash: string;
          game_password_salt: string;
          host_user_id: string;
          id?: string;
          last_leaderboard?: Json | null;
          last_round_result?: Json | null;
          round_ends_at?: string | null;
          round_started_at?: string | null;
          status?: string;
          title: string;
        };
        Update: {
          created_at?: string;
          current_question_index?: number;
          current_round_data?: Json | null;
          game_code?: string;
          game_password_hash?: string;
          game_password_salt?: string;
          host_user_id?: string;
          id?: string;
          last_leaderboard?: Json | null;
          last_round_result?: Json | null;
          round_ends_at?: string | null;
          round_started_at?: string | null;
          status?: string;
          title?: string;
        };
        Relationships: [];
      };
      players: {
        Row: {
          connected: boolean;
          created_at: string;
          game_id: string;
          id: string;
          name: string;
          team_id: string;
          total_score: number;
          user_id: string;
        };
        Insert: {
          connected?: boolean;
          created_at?: string;
          game_id: string;
          id?: string;
          name: string;
          team_id: string;
          total_score?: number;
          user_id: string;
        };
        Update: {
          connected?: boolean;
          created_at?: string;
          game_id?: string;
          id?: string;
          name?: string;
          team_id?: string;
          total_score?: number;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'players_game_id_fkey';
            columns: ['game_id'];
            isOneToOne: false;
            referencedRelation: 'games';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'players_team_id_fkey';
            columns: ['team_id'];
            isOneToOne: false;
            referencedRelation: 'teams';
            referencedColumns: ['id'];
          },
        ];
      };
      questions: {
        Row: {
          correct_option_id: string;
          game_id: string;
          id: string;
          options: Json;
          question_index: number;
          text: string;
          time_limit: number;
        };
        Insert: {
          correct_option_id: string;
          game_id: string;
          id?: string;
          options: Json;
          question_index: number;
          text: string;
          time_limit?: number;
        };
        Update: {
          correct_option_id?: string;
          game_id?: string;
          id?: string;
          options?: Json;
          question_index?: number;
          text?: string;
          time_limit?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'questions_game_id_fkey';
            columns: ['game_id'];
            isOneToOne: false;
            referencedRelation: 'games';
            referencedColumns: ['id'];
          },
        ];
      };
      teams: {
        Row: {
          color: string;
          game_id: string;
          id: string;
          name: string;
          sort_order: number;
        };
        Insert: {
          color: string;
          game_id: string;
          id?: string;
          name: string;
          sort_order?: number;
        };
        Update: {
          color?: string;
          game_id?: string;
          id?: string;
          name?: string;
          sort_order?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'teams_game_id_fkey';
            columns: ['game_id'];
            isOneToOne: false;
            referencedRelation: 'games';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
