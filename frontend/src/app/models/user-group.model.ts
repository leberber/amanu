export interface UserGroupBase {
  name: string;
  description?: string;
  name_translations?: Record<string, string>;
  description_translations?: Record<string, string>;
  color?: string;
  is_active: boolean;
}

export interface UserGroup extends UserGroupBase {
  id: number;
  created_at: string;
  updated_at?: string;
  user_count?: number;
}

export interface UserGroupCreate extends UserGroupBase {}

export interface UserGroupUpdate {
  name?: string;
  description?: string;
  name_translations?: Record<string, string>;
  description_translations?: Record<string, string>;
  color?: string;
  is_active?: boolean;
}

export interface UserGroupBasic {
  id: number;
  name: string;
  color?: string;
}

export interface UserGroupsUpdate {
  group_ids: number[];
}
