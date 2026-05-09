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
          telegram_id: number
          wallet_address: string | null
          skills: string[] | null
          preferences: Json | null
          location_preference: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          telegram_id: number
          wallet_address?: string | null
          skills?: string[] | null
          preferences?: Json | null
          location_preference?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          telegram_id?: number
          wallet_address?: string | null
          skills?: string[] | null
          preferences?: Json | null
          location_preference?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
      }
      conversations: {
        Row: {
          id: string
          user_id: string | null
          role: 'user' | 'assistant' | 'system'
          content: string
          created_at: string | null
        }
        Insert: {
          id?: string
          user_id?: string | null
          role: 'user' | 'assistant' | 'system'
          content: string
          created_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string | null
          role?: 'user' | 'assistant' | 'system'
          content?: string
          created_at?: string | null
        }
      }
      opportunities: {
        Row: {
          id: string
          source: string
          title: string
          description: string | null
          payout: string | null
          url: string
          ecosystem: string | null
          requirements: string[] | null
          is_processed: boolean | null
          raw_data: Json | null
          embedding: string | null // Vector as string representation
          created_at: string | null
        }
        Insert: {
          id?: string
          source: string
          title: string
          description?: string | null
          payout?: string | null
          url: string
          ecosystem?: string | null
          requirements?: string[] | null
          is_processed?: boolean | null
          raw_data?: Json | null
          embedding?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          source?: string
          title?: string
          description?: string | null
          payout?: string | null
          url?: string
          ecosystem?: string | null
          requirements?: string[] | null
          is_processed?: boolean | null
          raw_data?: Json | null
          embedding?: string | null
          created_at?: string | null
        }
      }
      saved_opportunities: {
        Row: {
          id: string
          user_id: string | null
          opportunity_id: string | null
          status: 'saved' | 'applied' | 'rejected' | 'drafted' | null
          draft_content: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          user_id?: string | null
          opportunity_id?: string | null
          status?: 'saved' | 'applied' | 'rejected' | 'drafted' | null
          draft_content?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string | null
          opportunity_id?: string | null
          status?: 'saved' | 'applied' | 'rejected' | 'drafted' | null
          draft_content?: string | null
          created_at?: string | null
        }
      }
      agent_logs: {
        Row: {
          id: string
          agent_name: string
          user_id: string | null
          action: string
          details: Json | null
          status: 'success' | 'failure' | 'pending' | null
          created_at: string | null
        }
        Insert: {
          id?: string
          agent_name: string
          user_id?: string | null
          action: string
          details?: Json | null
          status?: 'success' | 'failure' | 'pending' | null
          created_at?: string | null
        }
        Update: {
          id?: string
          agent_name?: string
          user_id?: string | null
          action?: string
          details?: Json | null
          status?: 'success' | 'failure' | 'pending' | null
          created_at?: string | null
        }
      }
    }
  }
}
