
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "api_usage": {
                  Row: {
                    "count": number,"day": string,"user_id": string
                  }
                  Insert: {
                    "count"?: number,"day": string,"user_id": string
                  }
                  Update: {
                    "count"?: number,"day"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"editors": {
                  Row: {
                    "user_id": string
                  }
                  Insert: {
                    "user_id": string
                  }
                  Update: {
                    "user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"identifications": {
                  Row: {
                    "candidates": NonNullable<Json>,"chosen_index": number | null,"created_at": string,"id": string,"model_version": string | null,"owner_id": string,"photo_count": number,"plant_id": string,"provider": string
                  }
                  Insert: {
                    "candidates": NonNullable<Json>,"chosen_index"?: number | null,"created_at"?: string,"id"?: string,"model_version"?: string | null,"owner_id"?: string,"photo_count": number,"plant_id": string,"provider"?: string
                  }
                  Update: {
                    "candidates"?: NonNullable<Json>,"chosen_index"?: number | null,"created_at"?: string,"id"?: string,"model_version"?: string | null,"owner_id"?: string,"photo_count"?: number,"plant_id"?: string,"provider"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "identifications_plant_id_fkey"
      columns: ["plant_id"]
isOneToOne: false
      referencedRelation: "plants"
      referencedColumns: ["id"]
    }
                  ]
                },"plant_photos": {
                  Row: {
                    "bytes": number,"created_at": string,"height": number,"id": string,"is_primary": boolean,"mime": string,"owner_id": string,"path": string,"plant_id": string,"sha256": string,"taken_at": string | null,"thumb_path": string,"width": number
                  }
                  Insert: {
                    "bytes": number,"created_at"?: string,"height": number,"id": string,"is_primary"?: boolean,"mime": string,"owner_id"?: string,"path": string,"plant_id": string,"sha256": string,"taken_at"?: string | null,"thumb_path": string,"width": number
                  }
                  Update: {
                    "bytes"?: number,"created_at"?: string,"height"?: number,"id"?: string,"is_primary"?: boolean,"mime"?: string,"owner_id"?: string,"path"?: string,"plant_id"?: string,"sha256"?: string,"taken_at"?: string | null,"thumb_path"?: string,"width"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "plant_photos_plant_id_fkey"
      columns: ["plant_id"]
isOneToOne: false
      referencedRelation: "plants"
      referencedColumns: ["id"]
    }
                  ]
                },"plants": {
                  Row: {
                    "created_at": string,"description": string | null,"family": string | null,"gbif_accepted_key": number | null,"gbif_accepted_name": string | null,"gbif_checked_at": string | null,"gbif_key": number | null,"gbif_match": string | null,"habitat": string | null,"id": string,"inat_checked_at": string | null,"inat_observation_id": number | null,"inat_quality_grade": string | null,"inat_taxon_name": string | null,"legacy_ai": Json | null,"name_bg": string,"name_source": string,"notes": string | null,"owner_id": string,"scientific_name": string,"updated_at": string,"id_status": string | null
                  }
                  Insert: {
                    "created_at"?: string,"description"?: string | null,"family"?: string | null,"gbif_accepted_key"?: number | null,"gbif_accepted_name"?: string | null,"gbif_checked_at"?: string | null,"gbif_key"?: number | null,"gbif_match"?: string | null,"habitat"?: string | null,"id": string,"inat_checked_at"?: string | null,"inat_observation_id"?: number | null,"inat_quality_grade"?: string | null,"inat_taxon_name"?: string | null,"legacy_ai"?: Json | null,"name_bg": string,"name_source"?: string,"notes"?: string | null,"owner_id"?: string,"scientific_name": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"description"?: string | null,"family"?: string | null,"gbif_accepted_key"?: number | null,"gbif_accepted_name"?: string | null,"gbif_checked_at"?: string | null,"gbif_key"?: number | null,"gbif_match"?: string | null,"habitat"?: string | null,"id"?: string,"inat_checked_at"?: string | null,"inat_observation_id"?: number | null,"inat_quality_grade"?: string | null,"inat_taxon_name"?: string | null,"legacy_ai"?: Json | null,"name_bg"?: string,"name_source"?: string,"notes"?: string | null,"owner_id"?: string,"scientific_name"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "consume_identify_quota":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"delete_plant":
{ Args: { "target_plant": string }; Returns: {
              "path": string,"thumb_path": string
            }[]
                           },
"id_status":
{ Args: { "p": Database["public"]['Tables']["plants"]['Row'] }; Returns: string
                           },
"is_editor":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"set_primary_photo":
{ Args: { "photo_id": string }; Returns: undefined
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

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            
          }
        }
} as const
