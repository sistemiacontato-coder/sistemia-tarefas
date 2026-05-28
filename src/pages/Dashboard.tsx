import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabaseService } from '../supabaseClient';
import type { Task, TaskStatus } from '../types';
import { SideNavBar } from '../components/SideNavBar';
import { TaskTable } from '../components/TaskTable';
import { TaskModal } from '../components/TaskModal';
import { TaskDetailsModal } from '../components/TaskDetailsModal';

export const Dashboard: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const clientQueryParam = searchParams.get('client') || 'todos_clientes';

  const [tasks, setTasks] = useState<Task[]>([]);
  const [clientName, setClientName] = useState(clientQueryParam);
  const [clientList, setClientList] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Sincroniza o estado do filtro com o parâmetro da URL quando ele mudar externamente
  useEffect(() => {
    setClientName(clientQueryParam);
  }, [clientQueryParam]);

  // Carrega a lista de clientes únicos do banco
  useEffect(() => {
    supabaseService.fetchUniqueClients().then(setClientList).catch(() => {});
  }, []);

  // Estados de controle do Modal de Criação / Edição Simples
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedParentId, setSelectedParentId] = useState<string | null>(null);
  const [taskToEdit, setTaskToEdit] = useState<Task | null>(null);

  // Estados do Modal de Detalhes ClickUp-Style
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [detailsTask, setDetailsTask] = useState<Task | null>(null);

  // Estados de controle do Link Público e Segurança de Acesso
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [accessType, setAccessType] = useState<'public' | 'password' | 'email'>('public');
  const [sharePassword, setSharePassword] = useState('');
  const [allowedEmails, setAllowedEmails] = useState('');
  const [sharingClientName, setSharingClientName] = useState('');

  // Carrega configurações de segurança de acesso quando o token público é carregado
  useEffect(() => {
    if (sharingClientName) {
      const stored = localStorage.getItem(`client_share_settings_${sharingClientName}`);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          setAccessType(parsed.accessType || 'public');
          setSharePassword(parsed.password || '');
          setAllowedEmails(parsed.allowedEmails ? parsed.allowedEmails.join(', ') : '');
        } catch (e) {
          console.error(e);
        }
      } else {
        setAccessType('public');
        setSharePassword('');
        setAllowedEmails('');
      }
    }
  }, [sharingClientName]);

  const fetchTasks = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await supabaseService.fetchTasksTree(clientName);
      setTasks(data);
    } catch (err: any) {
      console.error(err);
      setError('Ocorreu um erro ao carregar as tarefas do projeto.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
    const handleRefresh = () => fetchTasks();
    window.addEventListener('refreshTasks', handleRefresh);
    return () => window.removeEventListener('refreshTasks', handleRefresh);
  }, [clientName]);

  useEffect(() => {
    if (tasks.length > 0) {
      const params = new URLSearchParams(window.location.search);
      const taskId = params.get('task');
      if (taskId) {
        const findTaskInTree = (nodes: Task[], id: string): Task | null => {
          for (const node of nodes) {
            if (node.id === id) return node;
            if (node.children && node.children.length > 0) {
              const found = findTaskInTree(node.children, id);
              if (found) return found;
            }
          }
          return null;
        };
        const found = findTaskInTree(tasks, taskId);
        if (found) {
          setDetailsTask(found);
          setIsDetailsOpen(true);
          // Limpa o parâmetro da URL de forma sutil sem recarregar a página
          const newUrl = window.location.pathname;
          window.history.replaceState({}, document.title, newUrl);
        }
      }
    }
  }, [tasks]);

  // Ações de gerenciamento de Tarefa
  const handleOpenAddModal = (parentId: string | null = null) => {
    setTaskToEdit(null);
    setSelectedParentId(parentId);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (task: Task) => {
    setDetailsTask(task);
    setIsDetailsOpen(true);
  };

  const handleCreateSubtaskDetails = async (description: string, parentId: string) => {
    try {
      const parentTask = tasks.find(t => t.id === parentId);
      const newLevel = parentTask ? (parentTask.level || 0) + 1 : 0;
      const targetClientName = parentTask ? parentTask.client_name : (clientName === 'todos_clientes' ? (clientList[0] || '') : clientName);
      
      const newFormData = {
        description,
        parent_id: parentId,
        client_name: targetClientName,
        contract_value: 0,
        status: 'A Fazer' as TaskStatus,
        start_date: '',
        end_date: '',
        owner_id: 'default_owner',
        level: newLevel
      };
      
      await supabaseService.createTask(newFormData);
      await fetchTasks();

      // Encontra a tarefa pai atualizada e redefine o detailsTask para atualizar a árvore
      const updatedTasks = await supabaseService.fetchTasksTree(clientName);
      setTasks(updatedTasks);
      const updatedParent = updatedTasks.find(t => t.id === parentId);
      if (updatedParent) {
        setDetailsTask(updatedParent);
      }
    } catch (err: any) {
      alert(err.message || 'Erro ao criar subtarefa.');
    }
  };

  const handleModalSubmit = async (formData: any) => {
    try {
      if (taskToEdit) {
        // Atualização
        await supabaseService.updateTask(taskToEdit.id, formData);
      } else {
        // Criação
        await supabaseService.createTask(formData);
      }
      setIsModalOpen(false);
      fetchTasks(); // Recarrega
    } catch (err: any) {
      alert(err.message || 'Ocorreu um erro ao salvar a tarefa.');
    }
  };

  const handleQuickSaveTask = async (description: string, parentId: string | null) => {
    try {
      const parentTask = parentId ? tasks.find(t => t.id === parentId) : null;
      const newLevel = parentTask ? (parentTask.level || 0) + 1 : 0;
      
      const newFormData = {
        description,
        parent_id: parentId,
        client_name: clientName,
        contract_value: 0,
        status: 'A Fazer' as TaskStatus,
        start_date: '',
        end_date: '',
        owner_id: 'default_owner',
        level: newLevel
      };
      
      await supabaseService.createTask(newFormData);
      await fetchTasks();
    } catch (err: any) {
      alert(err.message || 'Erro ao criar tarefa rápida.');
    }
  };

  const handleDeleteTask = async (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir esta tarefa? Atenção: todas as subtarefas vinculadas a ela também serão excluídas recursivamente!')) {
      try {
        await supabaseService.deleteTask(id);
        fetchTasks(); // Recarrega
      } catch (err: any) {
        alert(err.message || 'Ocorreu um erro ao excluir a tarefa.');
      }
    }
  };

  const handleBulkDeleteTasks = async (ids: string[]) => {
    if (window.confirm(`Tem certeza que deseja excluir as ${ids.length} tarefas selecionadas? Todas as subtarefas vinculadas também serão excluídas.`)) {
      try {
        for (const id of ids) {
          await supabaseService.deleteTask(id);
        }
        fetchTasks();
      } catch (err: any) {
        alert(err.message || 'Ocorreu um erro ao excluir as tarefas.');
      }
    }
  };

  const handleUpdateTaskStatus = async (taskId: string, category: TaskStatus, customLabel: string) => {
    try {
      let idsToUpdate = [taskId];
      
      if (category === 'Concluído') {
        // Função recursiva para obter todos os descendentes não concluídos
        const getOpenDescendants = (parentId: string, list: Task[]): Task[] => {
          const directChildren = list.filter(t => t.parent_id === parentId);
          let openChildren = directChildren.filter(t => t.status !== 'Concluído');
          
          for (const child of directChildren) {
            openChildren = [...openChildren, ...getOpenDescendants(child.id, list)];
          }
          
          return openChildren.filter((item, index, self) =>
            self.findIndex(t => t.id === item.id) === index
          );
        };

        const openDescendants = getOpenDescendants(taskId, tasks);
        if (openDescendants.length > 0) {
          const confirmMsg = `Esta tarefa possui ${openDescendants.length} sub-tarefa(s) em aberto. Deseja marcar a tarefa principal e todas as suas sub-tarefas como concluídas automaticamente?`;
          if (window.confirm(confirmMsg)) {
            // Adiciona todos os descendentes na lista de atualização em lote
            idsToUpdate = [...idsToUpdate, ...openDescendants.map(d => d.id)];
            
            // Salva os status personalizados no localStorage para todos
            for (const subId of idsToUpdate) {
              localStorage.setItem(`task_custom_status_${subId}`, customLabel.toUpperCase());
            }
          } else {
            // Se o usuário cancelar, encerra sem alterar a tarefa principal
            return;
          }
        } else {
          localStorage.setItem(`task_custom_status_${taskId}`, customLabel.toUpperCase());
        }
      } else {
        localStorage.setItem(`task_custom_status_${taskId}`, customLabel.toUpperCase());
      }

      // Atualiza todas as tarefas em lote com uma única chamada de banco de dados
      await supabaseService.updateTasksStatus(idsToUpdate, category);
      await fetchTasks();
    } catch (err: any) {
      alert(err.message || 'Erro ao atualizar status da tarefa.');
    }
  };

  const handleUpdateMultipleTasksStatus = async (taskIds: string[], category: TaskStatus, customLabel: string) => {
    try {
      let idsToUpdate = [...taskIds];
      
      if (category === 'Concluído') {
        const getOpenDescendants = (parentId: string, list: Task[]): Task[] => {
          const directChildren = list.filter(t => t.parent_id === parentId);
          let openChildren = directChildren.filter(t => t.status !== 'Concluído');
          
          for (const child of directChildren) {
            openChildren = [...openChildren, ...getOpenDescendants(child.id, list)];
          }
          
          return openChildren.filter((item, index, self) =>
            self.findIndex(t => t.id === item.id) === index
          );
        };

        let allDescendants: Task[] = [];
        for (const id of taskIds) {
          allDescendants = [...allDescendants, ...getOpenDescendants(id, tasks)];
        }
        
        // Remove duplicates
        const uniqueDescendants = allDescendants.filter((item, index, self) =>
          self.findIndex(t => t.id === item.id) === index
        );
        
        if (uniqueDescendants.length > 0) {
          const confirmMsg = `Esta alteração em lote afeta ${uniqueDescendants.length} sub-tarefa(s) em aberto. Deseja marcar todas essas sub-tarefas como concluídas automaticamente?`;
          if (window.confirm(confirmMsg)) {
            idsToUpdate = [...idsToUpdate, ...uniqueDescendants.map(d => d.id)];
            for (const subId of idsToUpdate) {
              localStorage.setItem(`task_custom_status_${subId}`, customLabel.toUpperCase());
            }
          } else {
            return;
          }
        } else {
          for (const subId of idsToUpdate) {
            localStorage.setItem(`task_custom_status_${subId}`, customLabel.toUpperCase());
          }
        }
      } else {
        for (const subId of idsToUpdate) {
          localStorage.setItem(`task_custom_status_${subId}`, customLabel.toUpperCase());
        }
      }

      await supabaseService.updateTasksStatus(idsToUpdate, category);
      await fetchTasks();
    } catch (err: any) {
      alert(err.message || 'Erro ao atualizar status das tarefas.');
    }
  };

  const handleUpdateTaskField = async (taskId: string, fields: Partial<Task>) => {
    try {
      await supabaseService.updateTask(taskId, fields);
      await fetchTasks();
    } catch (err: any) {
      alert(err.message || 'Erro ao atualizar a tarefa.');
    }
  };
  // Lógica do link público do cliente
  const handleGenerateShareLink = async (specificClientName?: string) => {
    try {
      const targetClient = specificClientName || clientName;
      if (targetClient === 'todos_clientes') {
        alert('Selecione um cliente específico no topo para compartilhar o portal, ou clique no botão Compartilhar de uma tarefa específica.');
        return;
      }
      setSharingClientName(targetClient);
      const token = await supabaseService.getShareToken(targetClient);
      setShareToken(token);
      setShowShareModal(true);
      setCopied(false);
    } catch (err) {
      alert('Falha ao gerar link do cliente.');
    }
  };

  const getFullShareUrl = () => {
    const origin = window.location.origin;
    return `${origin}/share/${shareToken}`;
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(getFullShareUrl());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveShareSettings = () => {
    if (!sharingClientName) return;
    const settings = {
      accessType,
      password: sharePassword,
      allowedEmails: allowedEmails.split(',').map(e => e.trim()).filter(Boolean)
    };
    localStorage.setItem(`client_share_settings_${sharingClientName}`, JSON.stringify(settings));
    alert('Configurações de acesso e segurança salvas com sucesso!');
  };

  // Cálculos rápidos para o resumo ultrafino do topo (Foco no dia a dia)
  const rootTasks = tasks.filter(t => t.parent_id === null);
  const totalContractValue = rootTasks.reduce((sum, t) => sum + t.contract_value, 0);
  const leafTasks = tasks.filter(t => !tasks.some(child => child.parent_id === t.id));
  const totalLeafValue = leafTasks.reduce((sum, t) => sum + t.contract_value, 0);
  const executedLeafValue = leafTasks
    .filter(t => t.status === 'Concluído')
    .reduce((sum, t) => sum + t.contract_value, 0);
  const finalTotalValue = totalLeafValue > 0 ? totalLeafValue : totalContractValue;
  const finalExecutedValue = totalLeafValue > 0 
    ? executedLeafValue 
    : rootTasks.filter(t => t.status === 'Concluído').reduce((sum, t) => sum + t.contract_value, 0);
  const totalLeaves = leafTasks.length;
  const completedLeaves = leafTasks.filter(t => t.status === 'Concluído').length;
  const physicalProgress = totalLeaves > 0 ? Math.round((completedLeaves / totalLeaves) * 100) : 0;

  return (
    <div className="layout-container">
      
      {/* SideNavBar Dinâmica */}
      <SideNavBar activePage="dashboard" />

      {/* Main Workspace Area */}
      <main className="main-content" style={{ display: 'flex', flexDirection: 'column' }}>
        
        {/* Top Header Filter controls: Compacto, foco nas tarefas */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px',
          borderBottom: '1px solid var(--outline)',
          paddingBottom: '12px',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="material-symbols-outlined" style={{ color: 'var(--primary)', fontSize: '24px' }}>folder</span>
              <h2 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-on-surface)' }}>
                {clientName === 'todos_clientes' ? 'Visão Geral de Todos os Clientes' : clientName}
              </h2>
            </div>
            
            {/* Resumo ultrafino de status físico/financeiro de uma única linha */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '6px', fontSize: '12px', color: 'var(--text-muted-dark)', flexWrap: 'wrap' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <strong>Cliente:</strong> {clientName === 'todos_clientes' ? 'Todos os Clientes' : clientName}
              </span>
              <span style={{ color: 'var(--outline-variant)' }}>|</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '14px', color: 'var(--primary)' }}>trending_up</span>
                <strong>Progresso Físico:</strong> {physicalProgress}%
              </span>
              <span style={{ color: 'var(--outline-variant)' }}>|</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '14px', color: '#10b981' }}>payments</span>
                <strong>Faturado:</strong> {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(finalExecutedValue)}
              </span>
              <span style={{ color: 'var(--outline-variant)' }}>|</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '14px', color: 'var(--text-muted)' }}>monetization_on</span>
                <strong>Total:</strong> {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(finalTotalValue)}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
            {loading && tasks.length > 0 && (
              <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--primary)', animation: 'spin 1.5s linear infinite', marginRight: '4px' }} title="Sincronizando em segundo plano...">
                sync
              </span>
            )}
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted-dark)' }}>Cliente:</label>
              <select
                value={clientName}
                onChange={(e) => {
                  const newClient = e.target.value;
                  setClientName(newClient);
                  if (newClient === 'todos_clientes') {
                    setSearchParams({});
                  } else {
                    setSearchParams({ client: newClient });
                  }
                }}
                style={{
                  padding: '6px 10px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--outline)',
                  fontSize: '13px',
                  fontWeight: 600,
                  background: 'var(--surface)',
                  color: 'var(--text-on-surface)',
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                <option value="todos_clientes">Todos os Clientes</option>
                {clientList.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <button
              onClick={() => handleGenerateShareLink()}
              title="Compartilhar"
              style={{
                background: 'var(--primary-light)',
                border: '1px solid rgba(0, 88, 190, 0.15)',
                color: 'var(--primary)',
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background 0.2s',
                boxSizing: 'border-box'
              }}
              onMouseOver={(e) => e.currentTarget.style.background = 'rgba(0, 88, 190, 0.12)'}
              onMouseOut={(e) => e.currentTarget.style.background = 'var(--primary-light)'}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>share</span>
            </button>
          </div>
        </div>

        {/* Content area based on loading states */}
        {loading && tasks.length === 0 ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '300px', flexDirection: 'column', gap: '12px' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '48px', color: 'var(--primary)', animation: 'spin 1.5s linear infinite' }}>
              sync
            </span>
            <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>Carregando dados da árvore de tarefas...</p>
          </div>
        ) : error ? (
          <div style={{
            background: '#ffdad6',
            color: '#ba1a1a',
            padding: '24px',
            borderRadius: 'var(--radius-lg)',
            textAlign: 'center',
            marginTop: '40px'
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: '48px', marginBottom: '12px' }}>error</span>
            <h3>{error}</h3>
            <button 
              onClick={fetchTasks}
              style={{
                marginTop: '16px',
                background: '#ba1a1a',
                color: '#ffffff',
                border: 'none',
                padding: '8px 16px',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
                fontWeight: 600
              }}
            >
              Tentar Novamente
            </button>
          </div>
        ) : (
          <>
            {/* 1. Tabela de Tarefas Hierárquica (Subiu diretamente para o topo!) */}
            <TaskTable
              tasks={tasks}
              onAddTask={handleOpenAddModal}
              onEditTask={handleOpenEditModal}
              onDeleteTask={handleDeleteTask}
              onBulkDeleteTasks={handleBulkDeleteTasks}
              onQuickSaveTask={handleQuickSaveTask}
              onUpdateTaskStatus={handleUpdateTaskStatus}
              onUpdateMultipleTasksStatus={handleUpdateMultipleTasksStatus}
              onUpdateTaskField={handleUpdateTaskField}
              onShareClient={handleGenerateShareLink}
            />
          </>
        )}

      </main>

      {/* MODAL: Criar / Editar Tarefa */}
      <TaskModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleModalSubmit}
        taskToEdit={taskToEdit}
        parentId={selectedParentId}
        clientName={clientName}
      />

      {/* MODAL DE DETALHES CLICKUP-STYLE */}
      <TaskDetailsModal
        isOpen={isDetailsOpen}
        onClose={() => setIsDetailsOpen(false)}
        task={detailsTask}
        allTasks={tasks}
        onUpdateTaskField={handleUpdateTaskField}
        onCreateSubtask={handleCreateSubtaskDetails}
        onDeleteTask={handleDeleteTask}
      />

      {/* MODAL: Exibição do Link Público Gerado */}
      {showShareModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundColor: 'rgba(11, 28, 48, 0.4)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1100,
          padding: '16px'
        }}>
          <div style={{
            background: 'var(--surface)',
            borderRadius: 'var(--radius-lg)',
            width: '100%',
            maxWidth: '520px',
            boxShadow: 'var(--shadow-lg)',
            border: '1px solid var(--outline)',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <div style={{ background: 'rgba(95, 85, 236, 0.1)', padding: '8px', borderRadius: 'var(--radius-full)' }}>
                <span className="material-symbols-outlined" style={{ color: 'var(--primary)', fontSize: '28px', display: 'block' }}>share</span>
              </div>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-on-surface)' }}>Compartilhar Portal: {sharingClientName}</h3>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Configure o link de acompanhamento seguro em tempo real.</p>
              </div>
            </div>

            <div style={{
              background: 'var(--background)',
              padding: '12px 16px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--outline)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px'
            }}>
              <span style={{
                fontSize: '13px',
                color: 'var(--text-on-surface)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                fontWeight: 500,
                fontFamily: 'monospace',
                flex: 1
              }}>
                {getFullShareUrl()}
              </span>
              <button
                onClick={handleCopyLink}
                style={{
                  background: copied ? '#10b981' : 'var(--primary)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  padding: '8px 12px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'background 0.2s'
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                  {copied ? 'done' : 'content_copy'}
                </span>
                {copied ? 'Copiado!' : 'Copiar'}
              </button>
            </div>

            {/* SEÇÃO DE SEGURANÇA E NÍVEIS DE ACESSO */}
            <div style={{
              borderTop: '1px solid var(--outline)',
              paddingTop: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}>
              <h4 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-on-surface)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '16px', color: 'var(--primary)' }}>security</span>
                Segurança e Nível de Acesso
              </h4>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)' }}>Quem pode acessar este link?</label>
                <select
                  value={accessType}
                  onChange={(e) => setAccessType(e.target.value as any)}
                  style={{
                    background: 'var(--background)',
                    border: '1px solid var(--outline)',
                    borderRadius: 'var(--radius-md)',
                    padding: '8px 10px',
                    fontSize: '12px',
                    color: 'var(--text-on-surface)',
                    fontWeight: 600,
                    outline: 'none',
                    cursor: 'pointer'
                  }}
                >
                  <option value="public">🔓 Público (Qualquer pessoa com o link)</option>
                  <option value="password">🔑 Protegido por Senha</option>
                  <option value="email">📧 Restrito por E-mails cadastrados</option>
                </select>
              </div>

              {accessType === 'password' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', animation: 'fadeIn 0.2s' }}>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)' }}>Senha de Acesso do Cliente:</label>
                  <input
                    type="text"
                    value={sharePassword}
                    onChange={(e) => setSharePassword(e.target.value)}
                    placeholder="Defina uma senha de acesso"
                    style={{
                      background: 'var(--background)',
                      border: '1px solid var(--outline)',
                      borderRadius: 'var(--radius-md)',
                      padding: '8px 12px',
                      fontSize: '12px',
                      color: 'var(--text-on-surface)',
                      outline: 'none'
                    }}
                  />
                </div>
              )}

              {accessType === 'email' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', animation: 'fadeIn 0.2s' }}>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)' }}>E-mails autorizados (separados por vírgula):</label>
                  <textarea
                    rows={2}
                    value={allowedEmails}
                    onChange={(e) => setAllowedEmails(e.target.value)}
                    placeholder="cliente@empresa.com, ceo@empresa.com"
                    style={{
                      background: 'var(--background)',
                      border: '1px solid var(--outline)',
                      borderRadius: 'var(--radius-md)',
                      padding: '8px 12px',
                      fontSize: '12px',
                      color: 'var(--text-on-surface)',
                      outline: 'none',
                      resize: 'none',
                      fontFamily: 'inherit'
                    }}
                  />
                </div>
              )}

              <button
                onClick={handleSaveShareSettings}
                style={{
                  background: '#5f55ec',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  padding: '10px 14px',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  marginTop: '4px',
                  boxShadow: '0 2px 8px rgba(95, 85, 236, 0.3)',
                  transition: 'background 0.2s'
                }}
                onMouseOver={(e) => e.currentTarget.style.background = '#4f45dc'}
                onMouseOut={(e) => e.currentTarget.style.background = '#5f55ec'}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>save</span>
                Salvar Configurações de Acesso
              </button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
              <button
                onClick={() => setShowShareModal(false)}
                style={{
                  background: 'none',
                  border: '1px solid var(--outline)',
                  borderRadius: 'var(--radius-md)',
                  padding: '8px 16px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  color: 'var(--text-muted-dark)',
                  transition: 'background 0.2s'
                }}
                onMouseOver={(e) => e.currentTarget.style.background = 'var(--surface-low)'}
                onMouseOut={(e) => e.currentTarget.style.background = 'none'}
              >
                Fechar Janela
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Keyframe spin animation style declaration */}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};
