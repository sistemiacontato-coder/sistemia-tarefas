export type TaskStatus = 'A Fazer' | 'Em Execução' | 'Pendente' | 'Concluído';
export type TaskPriority = 'Urgente' | 'Alta' | 'Normal' | 'Baixa' | null;

export interface Task {
  id: string;
  parent_id: string | null;
  client_name: string;
  contract_value: number;
  status: TaskStatus;
  priority?: TaskPriority;
  start_date: string;
  end_date: string;
  description: string;
  owner_id: string;
  created_at: string;
  
  // Campos auxiliares calculados pela CTE ou frontend
  level?: number;
  path_route?: string[];
  children?: Task[];
}

export interface ClientShare {
  share_token: string;
  client_name: string;
  owner_id: string;
  is_active: boolean;
  created_at: string;
}

export interface CustomField {
  key: string;
  label: string;
  icon: string;
  type: 'text' | 'number' | 'date' | 'currency' | 'phone' | 'checkbox' | 'rating' | 'email' | 'dropdown';
  description?: string;
  defaultValue?: string;
  isRequired?: boolean;
  isPinned?: boolean;
  options?: string[];
  isSystemDefault?: boolean;
}

