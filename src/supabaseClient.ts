import { createClient } from '@supabase/supabase-js';
import type { Task, TaskStatus, ClientShare } from './types';

// 1. Definição das chaves do Supabase
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Determina se devemos usar o Supabase real ou o Mock de LocalStorage
export const isRealSupabaseConfigured = supabaseUrl !== '' && supabaseAnonKey !== '';

// Cliente oficial do Supabase (pode ser null se não configurado)
export const supabaseRealClient = isRealSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// ============================================================================
// MOCK SERVICE (FALLBACK DE ALTA FIDELIDADE EM LOCALSTORAGE)
// ============================================================================

const MOCK_USER_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

const INITIAL_MOCK_SHARES: ClientShare[] = [
  {
    share_token: 'e3981a5f-0df5-4c07-b3cd-943cc453ef1a',
    client_name: 'TechNova Solutions',
    owner_id: MOCK_USER_ID,
    is_active: true,
    created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
  }
];

const INITIAL_MOCK_TASKS: Task[] = [
  // 1. Diagnóstico e Levantamento (Nivel 1)
  {
    id: 't-1',
    parent_id: null,
    client_name: 'TechNova Solutions',
    contract_value: 8500.00,
    status: 'Concluído',
    start_date: '2026-05-01',
    end_date: '2026-05-15',
    description: 'Diagnóstico geral e levantamento de requisitos de infraestrutura e negócios.',
    owner_id: MOCK_USER_ID,
    created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString()
  },
  // 1.1 Entrevistas com stakeholders (Nivel 2 de t-1)
  {
    id: 't-1-1',
    parent_id: 't-1',
    client_name: 'TechNova Solutions',
    contract_value: 4250.00,
    status: 'Concluído',
    start_date: '2026-05-02',
    end_date: '2026-05-08',
    description: 'Realização de reuniões individuais com stakeholders para elucidação de processos críticos.',
    owner_id: MOCK_USER_ID,
    created_at: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000).toISOString()
  },
  // 1.2 Mapeamento de processos (Nivel 2 de t-1)
  {
    id: 't-1-2',
    parent_id: 't-1',
    client_name: 'TechNova Solutions',
    contract_value: 4250.00,
    status: 'Concluído',
    start_date: '2026-05-09',
    end_date: '2026-05-15',
    description: 'Elaboração de diagramas de processo atual (As-Is) e proposta futura (To-Be).',
    owner_id: MOCK_USER_ID,
    created_at: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString()
  },
  // 2. Desenvolvimento de Módulos (Nivel 1)
  {
    id: 't-2',
    parent_id: null,
    client_name: 'TechNova Solutions',
    contract_value: 22000.00,
    status: 'Em Execução',
    start_date: '2026-05-16',
    end_date: '2026-06-30',
    description: 'Etapa core de codificação do sistema e arquitetura.',
    owner_id: MOCK_USER_ID,
    created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  },
  // 2.1 API de Integração Financeira (Nivel 2 de t-2)
  {
    id: 't-2-1',
    parent_id: 't-2',
    client_name: 'TechNova Solutions',
    contract_value: 12000.00,
    status: 'Em Execução',
    start_date: '2026-05-16',
    end_date: '2026-06-05',
    description: 'Criação dos serviços e endpoints de conciliação bancária.',
    owner_id: MOCK_USER_ID,
    created_at: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString()
  },
  // 2.1.1 Homologação com Bancos (Nivel 3 de t-2-1)
  {
    id: 't-2-1-1',
    parent_id: 't-2-1',
    client_name: 'TechNova Solutions',
    contract_value: 3500.00,
    status: 'Pendente',
    start_date: '2026-05-30',
    end_date: '2026-06-05',
    description: 'Validação técnica de remessas e retornos financeiros com as instituições de teste.',
    owner_id: MOCK_USER_ID,
    created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
  },
  // 2.2 Dashboard de BI (Nivel 2 de t-2)
  {
    id: 't-2-2',
    parent_id: 't-2',
    client_name: 'TechNova Solutions',
    contract_value: 10000.00,
    status: 'A Fazer',
    start_date: '2026-06-06',
    end_date: '2026-06-30',
    description: 'Painéis analíticos e relatórios executivos para a gestão geral.',
    owner_id: MOCK_USER_ID,
    created_at: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString()
  },
  // 3. Implantação e Treinamento (Nivel 1)
  {
    id: 't-3',
    parent_id: null,
    client_name: 'TechNova Solutions',
    contract_value: 14500.00,
    status: 'A Fazer',
    start_date: '2026-07-01',
    end_date: '2026-07-15',
    description: 'Fase final de transferência de tecnologia e go-live.',
    owner_id: MOCK_USER_ID,
    created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
  }
];

// Carrega LocalStorage se necessário
const getLocalStorageTasks = (): Task[] => {
  const data = localStorage.getItem('taskmaster_tasks');
  if (!data) {
    localStorage.setItem('taskmaster_tasks', JSON.stringify(INITIAL_MOCK_TASKS));
    return INITIAL_MOCK_TASKS;
  }
  return JSON.parse(data);
};

const setLocalStorageTasks = (tasks: Task[]) => {
  localStorage.setItem('taskmaster_tasks', JSON.stringify(tasks));
};

const getLocalStorageShares = (): ClientShare[] => {
  const data = localStorage.getItem('taskmaster_shares');
  if (!data) {
    localStorage.setItem('taskmaster_shares', JSON.stringify(INITIAL_MOCK_SHARES));
    return INITIAL_MOCK_SHARES;
  }
  return JSON.parse(data);
};

const setLocalStorageShares = (shares: ClientShare[]) => {
  localStorage.setItem('taskmaster_shares', JSON.stringify(shares));
};

// Auxiliar: Calcula a profundidade atual de uma tarefa na árvore
const calculateTaskDepth = (parentId: string | null, tasks: Task[]): number => {
  let depth = 1;
  let currentParentId = parentId;
  
  while (currentParentId !== null) {
    depth++;
    const parent = tasks.find(t => t.id === currentParentId);
    currentParentId = parent ? parent.parent_id : null;
  }
  
  return depth;
};

// Auxiliar: Calcula a profundidade máxima da subárvore a partir de uma tarefa
const calculateSubtreeDepth = (taskId: string, tasks: Task[]): number => {
  const children = tasks.filter(t => t.parent_id === taskId);
  if (children.length === 0) return 0;
  
  let maxDepth = 0;
  for (const child of children) {
    maxDepth = Math.max(maxDepth, 1 + calculateSubtreeDepth(child.id, tasks));
  }
  
  return maxDepth;
};

const propagateStatusAndProgress = (tasks: Task[]): Task[] => {
  // Vamos clonar as tarefas para manipular
  const cloned = [...tasks];
  
  // Encontra tarefas folha (nós sem filhos)
  const isLeaf = (id: string) => !cloned.some(t => t.parent_id === id);
  
  // Vamos processar de baixo para cima na árvore de dependências.
  // Faremos isso em passagens repetidas até que nenhuma tarefa mude de status.
  let hasChanges = true;
  let passes = 0;
  
  while (hasChanges && passes < 10) {
    hasChanges = false;
    passes++;
    
    for (let i = 0; i < cloned.length; i++) {
      const task = cloned[i];
      if (isLeaf(task.id)) continue; // Folha não propaga dos filhos
      
      const children = cloned.filter(t => t.parent_id === task.id);
      
      // Regra 1: Se todos os filhos são Concluídos, o pai passa a ser Concluído
      const allDone = children.every(c => c.status === 'Concluído');
      const anyDoing = children.some(c => c.status === 'Em Execução');
      const anyDone = children.some(c => c.status === 'Concluído');
      
      let targetStatus: TaskStatus = task.status;
      if (allDone) {
        targetStatus = 'Concluído';
      } else if (anyDoing || anyDone) {
        // Se houver algum fazendo ou já concluído (e nem todos concluídos), passa a ser Em Execução
        if (task.status !== 'Concluído' && task.status !== 'Em Execução') {
          targetStatus = 'Em Execução';
        }
      }
      
      if (task.status !== targetStatus) {
        cloned[i] = { ...task, status: targetStatus };
        hasChanges = true;
      }
    }
  }
  
  return cloned;
};

// CTE recursiva simulada no Frontend: Ordena e calcula os níveis
const getTasksTreeMock = (clientName?: string): Task[] => {
  const allTasks = getLocalStorageTasks();
  
  // Filtra pelo cliente (se especificado)
  const filtered = clientName && clientName !== 'todos_clientes'
    ? allTasks.filter(t => t.client_name.toLowerCase() === clientName.toLowerCase())
    : allTasks;

  // Obtém ordenação personalizada do localStorage para este cliente
  const customOrderStr = clientName ? localStorage.getItem(`taskmasters_order_${clientName}`) : null;
  let customOrder: string[] = [];
  if (customOrderStr) {
    try { customOrder = JSON.parse(customOrderStr); } catch (e) {}
  }

  const sortTasks = (taskList: Task[]) => {
    taskList.sort((a, b) => {
      const idxA = customOrder.indexOf(a.id);
      const idxB = customOrder.indexOf(b.id);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.created_at.localeCompare(b.created_at);
    });
  };
    
  // Vamos estruturar a ordenação simulando a CTE recursiva path_route
  // Encontra as raízes
  const roots = filtered.filter(t => t.parent_id === null);
  
  const result: Task[] = [];
  
  const traverse = (node: Task, currentLevel: number, path: string[]) => {
    const route = [...path, node.id];
    result.push({
      ...node,
      level: currentLevel,
      path_route: route
    });
    
    // Encontra filhos
    const children = filtered.filter(t => t.parent_id === node.id);
    sortTasks(children);
    
    for (const child of children) {
      traverse(child, currentLevel + 1, route);
    }
  };
  
  // Ordena as raízes
  sortTasks(roots);
  
  for (const root of roots) {
    traverse(root, 0, []);
  }
  
  return result;
};

// ============================================================================
// SERVIÇO UNIFICADO (REAL COM FALLBACK SEGURO PARA MOCK)
// ============================================================================

export const supabaseService = {
  
  // --- TAREFAS (TASKS) ---
  
  // Busca tarefas com CTE Recursiva
  async fetchTasksTree(clientName: string): Promise<Task[]> {
    if (isRealSupabaseConfigured && supabaseRealClient) {
      try {
        // Roda a chamada RPC ou query que executa a CTE
        // Para simplificar e manter robusto caso RPC não esteja criado, podemos simular a CTE fazendo a query normal de tasks
        // do cliente específico e depois rodar a estruturação de árvore hierárquica no cliente.
        // Isso é extremamente seguro e evita erros de banco antes do setup completo SQL do Supabase!
        let query = supabaseRealClient.from('sia_tarefas_tasks').select('*');
        if (clientName && clientName !== 'todos_clientes') {
          query = query.eq('client_name', clientName);
        }
        const { data, error } = await query;
          
        if (error) throw error;
        
        // Reconstrói a árvore usando a mesma lógica recursiva performática
        const filtered = data as Task[];

        // Obtém ordenação personalizada do localStorage para este cliente
        const customOrderStr = localStorage.getItem(`taskmasters_order_${clientName}`);
        let customOrder: string[] = [];
        if (customOrderStr) {
          try { customOrder = JSON.parse(customOrderStr); } catch (e) {}
        }

        const sortTasks = (taskList: Task[]) => {
          taskList.sort((a, b) => {
            const idxA = customOrder.indexOf(a.id);
            const idxB = customOrder.indexOf(b.id);
            if (idxA !== -1 && idxB !== -1) return idxA - idxB;
            if (idxA !== -1) return -1;
            if (idxB !== -1) return 1;
            return a.created_at.localeCompare(b.created_at);
          });
        };

        const roots = filtered.filter(t => t.parent_id === null);
        const result: Task[] = [];
        
        const traverse = (node: Task, currentLevel: number, path: string[]) => {
          const route = [...path, node.id];
          result.push({
            ...node,
            level: currentLevel,
            path_route: route
          });
          const children = filtered.filter(t => t.parent_id === node.id);
          sortTasks(children);
          for (const child of children) {
            traverse(child, currentLevel + 1, route);
          }
        };
        
        sortTasks(roots);
        for (const root of roots) {
          traverse(root, 0, []);
        }
        
        return result;
      } catch (err) {
        console.error('Falha ao buscar tarefas no Supabase real, usando Mock local.', err);
        return getTasksTreeMock(clientName);
      }
    } else {
      return getTasksTreeMock(clientName);
    }
  },
  
  // Adiciona uma nova tarefa com validações
  async createTask(taskData: Omit<Task, 'id' | 'created_at' | 'owner_id'>): Promise<Task> {
    const ownerId = MOCK_USER_ID; // Seria auth.user().id no Supabase real
    
    if (isRealSupabaseConfigured && supabaseRealClient) {
      try {
        // Busca todas as tarefas do banco para rodar a validação antes da inserção
        // (Isso replica o comportamento de segurança do trigger do PostgreSQL)
        const { data: allTasks, error: fetchErr } = await supabaseRealClient
          .from('sia_tarefas_tasks')
          .select('id, parent_id');
          
        if (fetchErr) throw fetchErr;
        
        if (taskData.parent_id) {
          const depth = calculateTaskDepth(taskData.parent_id, allTasks as Task[]);
          if (depth >= 7) {
            throw new Error('A profundidade máxima da hierarquia de tarefas não pode exceder 7 níveis.');
          }
        }
        
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { level: _l, path_route: _p, children: _c, ...dbTaskData } = taskData as any;
        const { data, error } = await supabaseRealClient
          .from('sia_tarefas_tasks')
          .insert([{
            ...dbTaskData,
            owner_id: (await supabaseRealClient.auth.getUser()).data.user?.id || ownerId
          }])
          .select()
          .single();
          
        if (error) throw error;
        
        // Propaga o status de forma paralela e performática
        const { data: updatedTasks } = await supabaseRealClient.from('sia_tarefas_tasks').select('*');
        const propagated = propagateStatusAndProgress(updatedTasks as Task[]);
        const tasksChangedByPropCreate = propagated.filter(t => {
          const orig = updatedTasks?.find(x => x.id === t.id);
          return orig && orig.status !== t.status;
        });
        const updatePromises = tasksChangedByPropCreate.map(t =>
          supabaseRealClient.from('sia_tarefas_tasks').update({ status: t.status }).eq('id', t.id)
        );
        if (updatePromises.length > 0) {
          await Promise.all(updatePromises);
        }
        tasksChangedByPropCreate.forEach(t => {
          localStorage.removeItem(`task_custom_status_${t.id}`);
        });

        return data as Task;
      } catch (err: any) {
        console.error('Erro ao salvar no Supabase, tentando localmente:', err);
        throw err;
      }
    } else {
      // --- Lógica Mock Local ---
      const currentTasks = getLocalStorageTasks();
      
      // Validação de 7 Níveis
      if (taskData.parent_id) {
        const depth = calculateTaskDepth(taskData.parent_id, currentTasks);
        if (depth >= 7) {
          throw new Error('A profundidade máxima da hierarquia de tarefas não pode exceder 7 níveis.');
        }
      }
      
      const newTask: Task = {
        ...taskData,
        id: `t-mock-${Date.now()}`,
        owner_id: ownerId,
        created_at: new Date().toISOString()
      };
      
      const beforeCreate = [...currentTasks];
      let updated = [...currentTasks, newTask];
      updated = propagateStatusAndProgress(updated);
      updated.forEach(t => {
        const orig = beforeCreate.find(u => u.id === t.id);
        if (orig && orig.status !== t.status) {
          localStorage.removeItem(`task_custom_status_${t.id}`);
        }
      });
      setLocalStorageTasks(updated);

      return newTask;
    }
  },
  
  // Atualiza uma tarefa existente
  async updateTask(id: string, updates: Partial<Omit<Task, 'id' | 'created_at'>>): Promise<Task> {
    if (isRealSupabaseConfigured && supabaseRealClient) {
      try {
        const { data: allTasks, error: fetchErr } = await supabaseRealClient
          .from('sia_tarefas_tasks')
          .select('id, parent_id');
          
        if (fetchErr) throw fetchErr;
        
        // Se mudou o parent_id, valida se excede a profundidade
        if (updates.parent_id !== undefined && updates.parent_id !== null) {
          const depth = calculateTaskDepth(updates.parent_id, allTasks as Task[]);
          const subDepth = calculateSubtreeDepth(id, allTasks as Task[]);
          
          if (depth + subDepth >= 7) {
            throw new Error(`Esta alteração excede a profundidade máxima permitida de 7 níveis (Profundidade resultante: ${depth + subDepth + 1}).`);
          }
        }
        
        const { data, error } = await supabaseRealClient
          .from('sia_tarefas_tasks')
          .update(updates)
          .eq('id', id)
          .select()
          .single();
          
        if (error) throw error;
        
        // Propaga o status de forma paralela e performática
        const { data: updatedTasks } = await supabaseRealClient.from('sia_tarefas_tasks').select('*');
        const propagated = propagateStatusAndProgress(updatedTasks as Task[]);
        const tasksChangedByPropagation = propagated.filter(t => {
          const orig = updatedTasks?.find(x => x.id === t.id);
          return orig && orig.status !== t.status;
        });
        const updatePromises = tasksChangedByPropagation.map(t =>
          supabaseRealClient.from('sia_tarefas_tasks').update({ status: t.status }).eq('id', t.id)
        );
        if (updatePromises.length > 0) {
          await Promise.all(updatePromises);
        }
        tasksChangedByPropagation.forEach(t => {
          localStorage.removeItem(`task_custom_status_${t.id}`);
        });

        return data as Task;
      } catch (err: any) {
        console.error('Erro ao atualizar no Supabase:', err);
        throw err;
      }
    } else {
      // --- Lógica Mock Local ---
      const currentTasks = getLocalStorageTasks();
      const taskIndex = currentTasks.findIndex(t => t.id === id);
      if (taskIndex === -1) throw new Error('Tarefa não encontrada.');

      const currentTask = currentTasks[taskIndex];

      // Validação se mudou o parent_id
      if (updates.parent_id !== undefined && updates.parent_id !== currentTask.parent_id) {
        if (updates.parent_id !== null) {
          const depth = calculateTaskDepth(updates.parent_id, currentTasks);
          const subDepth = calculateSubtreeDepth(id, currentTasks);

          if (depth + subDepth >= 7) {
            throw new Error(`Esta alteração excede a profundidade máxima permitida de 7 níveis (Profundidade resultante: ${depth + subDepth + 1}).`);
          }
        }
      }

      const updatedTask = {
        ...currentTask,
        ...updates
      };

      currentTasks[taskIndex] = updatedTask;
      let updated = propagateStatusAndProgress(currentTasks);
      updated.forEach(t => {
        const orig = currentTasks.find(u => u.id === t.id);
        if (orig && orig.status !== t.status) {
          localStorage.removeItem(`task_custom_status_${t.id}`);
        }
      });
      setLocalStorageTasks(updated);
      
      return updatedTask;
    }
  },
  
  // Atualiza o status de várias tarefas em lote (batch update)
  async updateTasksStatus(ids: string[], category: TaskStatus): Promise<void> {
    if (isRealSupabaseConfigured && supabaseRealClient) {
      try {
        const { error } = await supabaseRealClient
          .from('sia_tarefas_tasks')
          .update({ status: category })
          .in('id', ids);
          
        if (error) throw error;
        
        // Propaga o status de forma paralela e performática para toda a base
        const { data: updatedTasks } = await supabaseRealClient.from('sia_tarefas_tasks').select('*');
        const propagated = propagateStatusAndProgress(updatedTasks as Task[]);
        const tasksChangedByPropagation = propagated.filter(t => {
          const orig = updatedTasks?.find(x => x.id === t.id);
          return orig && orig.status !== t.status;
        });
        const updatePromises = tasksChangedByPropagation.map(t =>
          supabaseRealClient.from('sia_tarefas_tasks').update({ status: t.status }).eq('id', t.id)
        );
        if (updatePromises.length > 0) {
          await Promise.all(updatePromises);
        }
        // Limpa o localStorage dos custom statuses das tarefas propagadas automaticamente,
        // evitando que label antigo sobrescreva o status correto vindo do banco.
        tasksChangedByPropagation.forEach(t => {
          localStorage.removeItem(`task_custom_status_${t.id}`);
        });
      } catch (err: any) {
        console.error('Erro ao atualizar status em lote no Supabase:', err);
        throw err;
      }
    } else {
      const currentTasks = getLocalStorageTasks();
      const updated = currentTasks.map(t => ids.includes(t.id) ? { ...t, status: category } : t);
      const propagated = propagateStatusAndProgress(updated);
      // Limpa localStorage de tarefas cujo status mudou apenas pela propagação automática
      propagated.forEach(t => {
        const inUpdated = updated.find(u => u.id === t.id);
        if (inUpdated && inUpdated.status !== t.status) {
          localStorage.removeItem(`task_custom_status_${t.id}`);
        }
      });
      setLocalStorageTasks(propagated);
    }
  },
  
  // Deleta uma tarefa e suas filhas recursivamente
  async deleteTask(id: string): Promise<void> {
    if (isRealSupabaseConfigured && supabaseRealClient) {
      try {
        const { error } = await supabaseRealClient
          .from('sia_tarefas_tasks')
          .delete()
          .eq('id', id);
          
        if (error) throw error;
      } catch (err) {
        console.error('Erro ao deletar no Supabase:', err);
        throw err;
      }
    } else {
      const currentTasks = getLocalStorageTasks();
      
      // Encontra IDs para remover recursivamente (cascata manual no mock)
      const idsToRemove = new Set<string>([id]);
      let hasNewRemovals = true;
      
      while (hasNewRemovals) {
        hasNewRemovals = false;
        for (const t of currentTasks) {
          if (t.parent_id && idsToRemove.has(t.parent_id) && !idsToRemove.has(t.id)) {
            idsToRemove.add(t.id);
            hasNewRemovals = true;
          }
        }
      }
      
      const updated = currentTasks.filter(t => !idsToRemove.has(t.id));
      const propagated = propagateStatusAndProgress(updated);
      setLocalStorageTasks(propagated);
    }
  },
  
  // Retorna a lista de nomes de clientes únicos (baseada em tarefas raiz do banco)
  async fetchUniqueClients(): Promise<string[]> {
    if (isRealSupabaseConfigured && supabaseRealClient) {
      try {
        const { data, error } = await supabaseRealClient
          .from('sia_tarefas_tasks')
          .select('client_name')
          .is('parent_id', null);
        if (error) throw error;
        const unique = [...new Set(
          (data as { client_name: string }[])
            .map(t => t.client_name)
            .filter(Boolean)
        )].sort();
        return unique;
      } catch (err) {
        console.error('Erro ao buscar clientes únicos:', err);
        return [];
      }
    }
    return ['TechNova Solutions', 'Global Logistics', 'Alpha Developers'];
  },

  // --- TOKENS DE COMPARTILHAMENTO (CLIENT SHARES) ---

  // Busca share_token de um cliente
  async getShareToken(clientName: string): Promise<string> {
    if (isRealSupabaseConfigured && supabaseRealClient) {
      try {
        const { data, error } = await supabaseRealClient
          .from('sia_tarefas_client_shares')
          .select('share_token')
          .eq('client_name', clientName)
          .eq('is_active', true)
          .single();
          
        if (error) {
          if (error.code === 'PGRST116') {
            // Nenhum token ativo encontrado, cria um novo
            const user = (await supabaseRealClient.auth.getUser()).data.user;
            const { data: newShare, error: insErr } = await supabaseRealClient
              .from('sia_tarefas_client_shares')
              .insert([{ client_name: clientName, owner_id: user?.id || MOCK_USER_ID }])
              .select('share_token')
              .single();
            if (insErr) throw insErr;
            return newShare.share_token;
          }
          throw error;
        }
        
        return data.share_token;
      } catch (err) {
        console.error('Erro ao obter token do Supabase:', err);
        return this.getShareTokenMock(clientName);
      }
    } else {
      return this.getShareTokenMock(clientName);
    }
  },
  
  getShareTokenMock(clientName: string): string {
    const shares = getLocalStorageShares();
    const active = shares.find(s => s.client_name === clientName && s.is_active);
    
    if (active) return active.share_token;
    
    const clientSlug = clientName.replace(/\s+/g, '_');
    const newToken: ClientShare = {
      share_token: `share-${clientSlug}-${Date.now()}`,
      client_name: clientName,
      owner_id: MOCK_USER_ID,
      is_active: true,
      created_at: new Date().toISOString()
    };
    
    shares.push(newToken);
    setLocalStorageShares(shares);
    return newToken.share_token;
  },

  // Regenera um token de compartilhamento para o cliente (desativa o anterior e cria um novo)
  async regenerateShareToken(clientName: string): Promise<string> {
    if (isRealSupabaseConfigured && supabaseRealClient) {
      try {
        // Desativa todos os tokens anteriores para este cliente no banco real
        await supabaseRealClient
          .from('sia_tarefas_client_shares')
          .update({ is_active: false })
          .eq('client_name', clientName);

        // Cria um novo token
        const user = (await supabaseRealClient.auth.getUser()).data.user;
        const { data: newShare, error: insErr } = await supabaseRealClient
          .from('sia_tarefas_client_shares')
          .insert([{ client_name: clientName, owner_id: user?.id || MOCK_USER_ID, is_active: true }])
          .select('share_token')
          .single();
          
        if (insErr) throw insErr;
        return newShare.share_token;
      } catch (err) {
        console.error('Erro ao regenerar token no Supabase, tentando localmente:', err);
        return this.regenerateShareTokenMock(clientName);
      }
    } else {
      return this.regenerateShareTokenMock(clientName);
    }
  },

  regenerateShareTokenMock(clientName: string): string {
    const shares = getLocalStorageShares();
    // Desativa os anteriores
    shares.forEach(s => {
      if (s.client_name === clientName) {
        s.is_active = false;
      }
    });

    const clientSlug = clientName.replace(/\s+/g, '_');
    const newToken: ClientShare = {
      share_token: `share-${clientSlug}-${Date.now()}`,
      client_name: clientName,
      owner_id: MOCK_USER_ID,
      is_active: true,
      created_at: new Date().toISOString()
    };
    
    shares.push(newToken);
    setLocalStorageShares(shares);
    return newToken.share_token;
  },

  // --- TAXAS COMERCIAIS DO CLIENTE ---
  
  // Salva taxas comerciais no Supabase
  async saveClientFees(clientName: string, implementation: number, mensal: number): Promise<void> {
    if (isRealSupabaseConfigured && supabaseRealClient) {
      try {
        const { error } = await supabaseRealClient
          .from('sia_tarefas_client_shares')
          .update({
            implementation_fee: implementation,
            mensal_fee: mensal
          })
          .eq('client_name', clientName)
          .eq('is_active', true);
          
        if (error) {
          console.warn('Erro ao salvar taxas comerciais no Supabase (colunas podem não existir):', error.message);
        }
      } catch (err) {
        console.warn('Erro na requisição ao salvar taxas comerciais no Supabase:', err);
      }
    }
  },

  // Busca taxas comerciais de um cliente
  async getClientFees(clientName: string): Promise<{ implementation: number; mensal: number } | null> {
    if (isRealSupabaseConfigured && supabaseRealClient) {
      try {
        const { data, error } = await supabaseRealClient
          .from('sia_tarefas_client_shares')
          .select('implementation_fee, mensal_fee')
          .eq('client_name', clientName)
          .eq('is_active', true)
          .maybeSingle();
          
        if (error) throw error;
        if (data) {
          return {
            implementation: Number(data.implementation_fee) || 0,
            mensal: Number(data.mensal_fee) || 0
          };
        }
      } catch (err) {
        console.warn('Erro ao buscar taxas comerciais no Supabase:', err);
      }
    }
    return null;
  },
  
  // Valida um token público e retorna o nome do cliente associado
  async validateShareToken(token: string): Promise<string | null> {
    if (isRealSupabaseConfigured && supabaseRealClient) {
      try {
        const { data, error } = await supabaseRealClient
          .from('sia_tarefas_client_shares')
          .select('client_name')
          .eq('share_token', token)
          .eq('is_active', true)
          .single();
          
        if (error) {
          console.error('Erro ao validar token no Supabase:', error);
          return this.validateShareTokenMock(token);
        }
        return data.client_name;
      } catch (err) {
        console.error('Erro ao validar token no Supabase:', err);
        return this.validateShareTokenMock(token);
      }
    } else {
      return this.validateShareTokenMock(token);
    }
  },
  
  validateShareTokenMock(token: string): string | null {
    const shares = getLocalStorageShares();
    
    // Verifica se o token existe na base de dados (localStorage)
    const foundToken = shares.find(s => s.share_token === token);
    if (foundToken) {
      // Se existe, respeita estritamente o campo is_active do banco local
      return foundToken.is_active ? foundToken.client_name : null;
    }

    // Fallback inteligente para quando o localStorage estiver isolado/vazio (ex: aba anônima de testes)
    if (token && token.startsWith('share-')) {
      const parts = token.split('-');
      if (parts.length >= 3) {
        const clientSlug = parts[1];
        // Se a segunda parte não for puramente numérica (como o timestamp anterior), é o slug do cliente!
        if (isNaN(Number(clientSlug))) {
          const clientName = clientSlug.replace(/_/g, ' ');
          
          // Se já existe outro token ATIVO cadastrado para este cliente, e o token testado NÃO é o ativo,
          // significa que o token testado é antigo/regerado. Portanto, deve ser bloqueado!
          const activeShare = shares.find(s => s.client_name === clientName && s.is_active);
          if (activeShare && activeShare.share_token !== token) {
            return null;
          }
          
          return clientName;
        }
      } else if (parts.length === 2) {
        const clientSlug = parts[1];
        if (isNaN(Number(clientSlug))) {
          const clientName = clientSlug.replace(/_/g, ' ');
          const activeShare = shares.find(s => s.client_name === clientName && s.is_active);
          if (activeShare && activeShare.share_token !== token) {
            return null;
          }
          return clientName;
        }
      }
    }
    return null;
  },

  async renameClient(oldName: string, newName: string): Promise<void> {
    if (isRealSupabaseConfigured && supabaseRealClient) {
      const { error } = await supabaseRealClient
        .from('sia_tarefas_tasks')
        .update({ client_name: newName })
        .eq('client_name', oldName);
      if (error) throw error;
    } else {
      const tasks = getLocalStorageTasks();
      const updated = tasks.map(t => t.client_name === oldName ? { ...t, client_name: newName } : t);
      setLocalStorageTasks(updated);
    }
  },

  async deleteClientTasks(clientName: string): Promise<void> {
    const tasks = getLocalStorageTasks();
    const rootIds = tasks.filter(t => t.client_name === clientName && t.parent_id === null).map(t => t.id);
    for (const id of rootIds) {
      await supabaseService.deleteTask(id);
    }
  },
};
