export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          display_name: string | null;
          avatar_url: string | null;
          contact_info: string | null;
          role: "ADMIN" | "USER";
          is_active: boolean;
          created_at: string;
          updated_at: string;
          last_login_at: string | null;
          password_changed_at: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["profiles"]["Row"]> & { id: string; email: string };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Row"]>;
      };
      categories: {
        Row: {
          id: string;
          category_name: string;
          color: string;
          owner_id: string | null;
          sort_order: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["categories"]["Row"]> & { category_name: string; color: string };
        Update: Partial<Database["public"]["Tables"]["categories"]["Row"]>;
      };
      tasks: {
        Row: {
          id: string;
          task_name: string;
          description: string | null;
          description_richtext: Json | null;
          category_id: string;
          owner_id: string;
          progress: number;
          status: "TODO" | "IN_PROGRESS" | "COMPLETED";
          is_archived: boolean;
          created_at: string;
          updated_at: string;
          completed_at: string | null;
          archived_at: string | null;
          due_at: string | null;
          due_timezone: string;
          is_deleted: boolean;
        };
        Insert: Partial<Database["public"]["Tables"]["tasks"]["Row"]> & {
          task_name: string;
          category_id: string;
          owner_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["tasks"]["Row"]>;
      };
      task_images: {
        Row: {
          id: string;
          task_id: string | null;
          intended_task_id: string | null;
          uploaded_by: string;
          storage_path: string;
          file_name: string;
          mime_type: string;
          size_bytes: number;
          sort_order: number;
          is_removed: boolean;
          created_at: string;
        };
        Insert: never;
        Update: never;
      };
      checklist_items: {
        Row: {
          id: string;
          task_id: string;
          item_name: string;
          weight: number;
          is_checked: boolean;
          sort_order: number;
          checked_by: string | null;
          checked_at: string | null;
          created_at: string;
          updated_at: string;
          is_deleted: boolean;
        };
        Insert: Partial<Database["public"]["Tables"]["checklist_items"]["Row"]> & {
          task_id: string;
          item_name: string;
        };
        Update: Partial<Database["public"]["Tables"]["checklist_items"]["Row"]>;
      };
      checklist_notes: {
        Row: {
          id: string;
          checklist_item_id: string;
          author_id: string | null;
          content: string;
          created_at: string;
          updated_at: string;
          is_active: boolean;
          deleted_at: string | null;
          deleted_by: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["checklist_notes"]["Row"]> & {
          checklist_item_id: string;
          content: string;
        };
        Update: Partial<Database["public"]["Tables"]["checklist_notes"]["Row"]>;
      };
      task_shares: {
        Row: {
          id: string;
          task_id: string;
          user_id: string;
          permission: "VIEWER" | "CHECKER" | "EDITOR";
          shared_by: string;
          created_at: string;
          updated_at: string;
          is_active: boolean;
        };
        Insert: Partial<Database["public"]["Tables"]["task_shares"]["Row"]> & {
          task_id: string;
          user_id: string;
          permission: "VIEWER" | "CHECKER" | "EDITOR";
          shared_by: string;
        };
        Update: Partial<Database["public"]["Tables"]["task_shares"]["Row"]>;
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          task_id: string | null;
          type: "TASK_SHARED" | "TASK_UPDATED";
          title: string;
          message: string;
          created_by: string | null;
          is_read: boolean;
          read_at: string | null;
          created_at: string;
          event_id: string | null;
          event_type: string | null;
          is_in_app_visible: boolean;
        };
        Insert: Partial<Database["public"]["Tables"]["notifications"]["Row"]> & {
          user_id: string;
          type: "TASK_SHARED" | "TASK_UPDATED";
          title: string;
          message: string;
        };
        Update: Partial<Database["public"]["Tables"]["notifications"]["Row"]>;
      };
      notification_preferences: {
        Row: {
          user_id: string;
          task_shared: boolean;
          task_updated: boolean;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          task_shared?: boolean;
          task_updated?: boolean;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["notification_preferences"]["Row"]>;
      };
      activity_logs: {
        Row: {
          id: string;
          task_id: string | null;
          user_id: string | null;
          action: string;
          detail_json: Json;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["activity_logs"]["Row"]> & { action: string };
        Update: never;
      };
      settings: {
        Row: {
          key: string;
          value: Json;
          updated_at: string;
        };
        Insert: Database["public"]["Tables"]["settings"]["Row"];
        Update: Partial<Database["public"]["Tables"]["settings"]["Row"]>;
      };
    };
    Views: Record<string, never>;
    Functions: {
      reserve_task_image: {
        Args: { next_id: string; target_task_id: string | null; next_file_name: string; next_mime_type: string; next_size: number };
        Returns: Database["public"]["Tables"]["task_images"]["Row"];
      };
      discard_task_images: {
        Args: { image_ids: string[] };
        Returns: undefined;
      };
      save_task_content: {
        Args: { target_task_id: string | null; payload: Json; image_ids: string[]; request_id: string; expected_updated_at?: string | null };
        Returns: Database["public"]["Tables"]["tasks"]["Row"];
      };
      clone_task: {
        Args: { source_task_id: string; next_task_name: string; request_id: string };
        Returns: Database["public"]["Tables"]["tasks"]["Row"];
      };
      create_task_with_items: {
        Args: {
          next_task_name: string;
          next_description: string;
          next_category_id: string;
          next_checklist_items: Json;
          next_task_shares: Json;
          request_id: string;
        };
        Returns: Database["public"]["Tables"]["tasks"]["Row"];
      };
      update_task_with_items: {
        Args: {
          target_task_id: string;
          next_task_name: string;
          next_description: string;
          next_category_id: string;
          next_checklist_items: Json;
          next_task_shares: Json | null;
          request_id: string;
        };
        Returns: Database["public"]["Tables"]["tasks"]["Row"];
      };
      toggle_checklist_item: {
        Args: {
          target_item_id: string;
          next_checked: boolean;
          request_id: string;
        };
        Returns: Database["public"]["Tables"]["checklist_items"]["Row"];
      };
      reorder_checklist_items: {
        Args: {
          target_task_id: string;
          ordered_item_ids: string[];
          request_id: string;
        };
        Returns: string[];
      };
      set_task_shares: {
        Args: { target_task_id: string; next_task_shares: Json };
        Returns: number;
      };
      notify_task_team: {
        Args: { target_task_id: string };
        Returns: number;
      };
      update_own_profile: {
        Args: { next_display_name: string; next_contact_info: string | null };
        Returns: Database["public"]["Tables"]["profiles"]["Row"];
      };
      set_own_avatar_url: {
        Args: { next_avatar_url: string };
        Returns: Database["public"]["Tables"]["profiles"]["Row"];
      };
      mark_password_changed: {
        Args: Record<string, never>;
        Returns: string;
      };
    };
    Enums: {
      app_role: "ADMIN" | "USER";
      task_status: "TODO" | "IN_PROGRESS" | "COMPLETED";
      task_permission: "VIEWER" | "CHECKER" | "EDITOR";
      activity_action:
        | "CREATE_TASK"
        | "UPDATE_TASK"
        | "DELETE_TASK"
        | "ARCHIVE_TASK"
        | "RESTORE_TASK"
        | "CLONE_TASK"
        | "ADD_ITEM"
        | "UPDATE_ITEM"
        | "DELETE_ITEM"
        | "CHECK_ITEM"
        | "UNCHECK_ITEM"
        | "REORDER_ITEMS"
        | "SHARE_TASK"
        | "UPDATE_PERMISSION"
        | "REMOVE_SHARE"
        | "NOTIFY_TASK"
        | "CREATE_CATEGORY"
        | "UPDATE_CATEGORY"
        | "DEACTIVATE_CATEGORY"
        | "INVITE_MEMBER"
        | "UPDATE_MEMBER"
        | "DEACTIVATE_MEMBER"
        | "REACTIVATE_MEMBER";
      notification_type: "TASK_SHARED" | "TASK_UPDATED";
    };
    CompositeTypes: Record<string, never>;
  };
};
