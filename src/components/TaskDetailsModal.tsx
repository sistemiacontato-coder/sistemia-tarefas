import React, { useState, useEffect, useRef } from 'react';
import type { Task, TaskStatus, TaskPriority } from '../types';

interface TaskDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: Task | null;
  allTasks: Task[];
  onUpdateTaskField: (taskId: string, fields: Partial<Task>) => Promise<void>;
  onCreateSubtask: (description: string, parentId: string) => Promise<void>;
  onDeleteTask: (taskId: string) => Promise<void>;
}

interface Attachment {
  id: string;
  name: string;
  size: string;
  uploadedAt: string;
}

interface ChecklistItem {
  id: string;
  label: string;
  isChecked: boolean;
}

export const TaskDetailsModal: React.FC<TaskDetailsModalProps> = ({
  isOpen,
  onClose,
  task,
  allTasks,
  onUpdateTaskField,
  onCreateSubtask,
  onDeleteTask
}) => {
  const [description, setDescription] = useState('');
  const [contractValue, setContractValue] = useState(0);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [status, setStatus] = useState<TaskStatus>('A Fazer');
  const [priority, setPriority] = useState<TaskPriority>(null);

  // States para Seções ClickUp
  const [showCampos, setShowCampos] = useState(true);
  const [showSubtasks, setShowSubtasks] = useState(true);
  const [newSubtaskDesc, setNewSubtaskDesc] = useState('');

  // States para LocalStorage Extras
  const [assignee, setAssignee] = useState('Sem responsável');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [newChecklistItem, setNewChecklistItem] = useState('');

  // Timer/Rastrear Tempo State
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const timerIntervalRef = useRef<any>(null);

  // File Uploader Reference
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Carrega e sincroniza estados locais com a tarefa ativa
  useEffect(() => {
    if (isOpen && task) {
      setDescription(task.description);
      setContractValue(task.contract_value || 0);
      setStartDate(task.start_date || '');
      setEndDate(task.end_date || '');
      setStatus(task.status);
      setPriority(task.priority || null);

      // Carrega Assignee do LocalStorage
      const savedAssignee = localStorage.getItem(`task_assignee_${task.id}`);
      setAssignee(savedAssignee || 'Sem responsável');

      // Carrega Attachments
      const savedAttachments = localStorage.getItem(`task_attachments_${task.id}`);
      if (savedAttachments) {
        try { setAttachments(JSON.parse(savedAttachments)); } catch (e) { setAttachments([]); }
      } else {
        setAttachments([]);
      }

      // Carrega Checklist
      const savedChecklist = localStorage.getItem(`task_checklist_${task.id}`);
      if (savedChecklist) {
        try { setChecklist(JSON.parse(savedChecklist)); } catch (e) { setChecklist([]); }
      } else {
        setChecklist([]);
      }

      // Carrega Timer
      const savedSeconds = localStorage.getItem(`task_time_seconds_${task.id}`);
      setTimerSeconds(savedSeconds ? parseInt(savedSeconds, 10) : 0);

      const savedRunning = localStorage.getItem(`task_time_running_${task.id}`);
      setIsTimerRunning(savedRunning === 'true');
    }
  }, [isOpen, task]);

  // Efeito para rodar o Timer de Rastreamento de Tempo
  useEffect(() => {
    if (isTimerRunning && task) {
      timerIntervalRef.current = setInterval(() => {
        setTimerSeconds(prev => {
          const next = prev + 1;
          localStorage.setItem(`task_time_seconds_${task.id}`, next.toString());
          return next;
        });
      }, 1000);
    } else {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    }

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, [isTimerRunning, task]);

  if (!isOpen || !task) return null;

  // Busca subtarefas do banco para a tarefa atual
  const subtasks = allTasks.filter(t => t.parent_id === task.id);

  // Calcula o progresso real baseado em subtarefas ou status
  const calculateRealProgress = (): number => {
    if (subtasks.length === 0) {
      return task.status === 'Concluído' ? 100 : 0;
    }
    const completed = subtasks.filter(t => t.status === 'Concluído').length;
    return Math.round((completed / subtasks.length) * 100);
  };

  const progress = calculateRealProgress();

  // Handlers para Atualização de Campos em tempo real (Auto-salvar ao sair do campo)
  const handleUpdateDescription = async (newVal: string) => {
    setDescription(newVal);
    if (newVal.trim() !== task.description) {
      await onUpdateTaskField(task.id, { description: newVal });
    }
  };

  const handleUpdateValue = async (newVal: number) => {
    setContractValue(newVal);
    if (newVal !== task.contract_value) {
      await onUpdateTaskField(task.id, { contract_value: newVal });
    }
  };

  const handleUpdateStartDate = async (newVal: string) => {
    setStartDate(newVal);
    if (newVal !== task.start_date) {
      await onUpdateTaskField(task.id, { start_date: newVal });
    }
  };

  const handleUpdateEndDate = async (newVal: string) => {
    setEndDate(newVal);
    if (newVal !== task.end_date) {
      await onUpdateTaskField(task.id, { end_date: newVal });
    }
  };

  const handleUpdateStatus = async (newStatus: TaskStatus) => {
    setStatus(newStatus);
    if (newStatus !== task.status) {
      await onUpdateTaskField(task.id, { status: newStatus });
    }
  };

  const handleUpdatePriority = async (newPriority: TaskPriority) => {
    setPriority(newPriority);
    if (newPriority !== task.priority) {
      await onUpdateTaskField(task.id, { priority: newPriority });
    }
  };

  const handleUpdateAssignee = (newAssignee: string) => {
    setAssignee(newAssignee);
    localStorage.setItem(`task_assignee_${task.id}`, newAssignee);
  };

  // Timer Toggle Handler
  const toggleTimer = () => {
    const nextState = !isTimerRunning;
    setIsTimerRunning(nextState);
    localStorage.setItem(`task_time_running_${task.id}`, nextState ? 'true' : 'false');
  };

  const formatTimerTime = (totalSeconds: number): string => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // Checklist Handlers
  const handleAddChecklistItem = () => {
    if (!newChecklistItem.trim()) return;
    const newItem: ChecklistItem = {
      id: Math.random().toString(36).substr(2, 9),
      label: newChecklistItem.trim(),
      isChecked: false
    };
    const updated = [...checklist, newItem];
    setChecklist(updated);
    localStorage.setItem(`task_checklist_${task.id}`, JSON.stringify(updated));
    setNewChecklistItem('');
  };

  const toggleChecklistItem = (itemId: string) => {
    const updated = checklist.map(item => 
      item.id === itemId ? { ...item, isChecked: !item.isChecked } : item
    );
    setChecklist(updated);
    localStorage.setItem(`task_checklist_${task.id}`, JSON.stringify(updated));
  };

  const deleteChecklistItem = (itemId: string) => {
    const updated = checklist.filter(item => item.id !== itemId);
    setChecklist(updated);
    localStorage.setItem(`task_checklist_${task.id}`, JSON.stringify(updated));
  };

  // Attachment Handlers
  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newAttachments: Attachment[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const sizeKB = Math.round(file.size / 1024);
      const sizeStr = sizeKB > 1024 ? `${(sizeKB / 1024).toFixed(1)} MB` : `${sizeKB} KB`;
      
      newAttachments.push({
        id: Math.random().toString(36).substr(2, 9),
        name: file.name,
        size: sizeStr,
        uploadedAt: new Date().toLocaleDateString('pt-BR')
      });
    }

    const updated = [...attachments, ...newAttachments];
    setAttachments(updated);
    localStorage.setItem(`task_attachments_${task.id}`, JSON.stringify(updated));
  };

  const handleDeleteAttachment = (id: string) => {
    const updated = attachments.filter(a => a.id !== id);
    setAttachments(updated);
    localStorage.setItem(`task_attachments_${task.id}`, JSON.stringify(updated));
  };

  // Subtask Handler
  const handleAddSubtask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubtaskDesc.trim()) return;
    await onCreateSubtask(newSubtaskDesc.trim(), task.id);
    setNewSubtaskDesc('');
  };

  // Detalhe de Prioridade Style Helper
  const getPriorityFlagColor = (p: TaskPriority) => {
    switch (p) {
      case 'Urgente': return '#f43f5e';
      case 'Alta': return '#f97316';
      case 'Normal': return '#3b82f6';
      case 'Baixa': return '#a1a1aa';
      default: return 'var(--text-muted)';
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 99999,
      padding: '24px',
      boxSizing: 'border-box'
    }}>
      
      {/* Container Principal ClickUp-Style Adaptável */}
      <div style={{
        background: 'var(--surface)',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '920px',
        height: '90vh',
        boxShadow: 'var(--shadow-lg)',
        border: '1px solid var(--outline)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        color: 'var(--text-on-surface)',
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }}>
        
        {/* MODAL HEADER: Tipo & ID da Tarefa + Fechar */}
        <div style={{
          padding: '12px 24px',
          borderBottom: '1px solid var(--outline)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'var(--surface-low)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '15px', color: 'var(--primary)' }}>task</span>
            <span>Tarefa</span>
            <span>/</span>
            <span style={{ color: 'var(--primary)' }}>ID: {task.id.slice(0, 8)}</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* Botão Excluir Principal */}
            <button 
              onClick={async () => {
                if (confirm('Tem certeza que deseja excluir esta tarefa permanentemente?')) {
                  await onDeleteTask(task.id);
                  onClose();
                }
              }}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: '#ef4444',
                fontSize: '11px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 8px',
                borderRadius: '4px'
              }}
              onMouseOver={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'}
              onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>delete</span>
              Excluir
            </button>

            <button 
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-muted)',
                display: 'flex',
                padding: '4px',
                borderRadius: '50%'
              }}
              onMouseOver={(e) => e.currentTarget.style.color = 'var(--text-on-surface)'}
              onMouseOut={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>close</span>
            </button>
          </div>
        </div>

        {/* CORPO DO MODAL (Dividido em duas colunas ou scrollable único) */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
          boxSizing: 'border-box',
          background: 'var(--background)'
        }}>
          
          {/* TÍTULO DA TAREFA EDITÁVEL */}
          <div>
            <input 
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={() => handleUpdateDescription(description)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleUpdateDescription(description); }}
              placeholder="Nome da Tarefa"
              style={{
                width: '100%',
                background: 'transparent',
                border: 'none',
                fontSize: '24px',
                fontWeight: 700,
                color: 'var(--text-on-surface)',
                outline: 'none',
                padding: '4px 0',
                borderBottom: '1px solid transparent'
              }}
              onFocus={(e) => e.target.style.borderBottom = '1px solid var(--primary)'}
              onBlurCapture={(e) => e.target.style.borderBottom = '1px solid transparent'}
            />
          </div>

          {/* META BAR (Status, Responsável, Datas, Rastrear Tempo, Prioridade) */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '16px',
            background: 'var(--surface-low)',
            borderRadius: '12px',
            padding: '16px',
            border: '1px solid var(--outline)'
          }}>
            
            {/* Status */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Status</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '16px', color: status === 'Concluído' ? '#10b981' : 'var(--primary)' }}>
                  {status === 'Concluído' ? 'check_circle' : 'adjust'}
                </span>
                <select 
                  value={status} 
                  onChange={(e) => handleUpdateStatus(e.target.value as TaskStatus)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-on-surface)',
                    fontSize: '12px',
                    fontWeight: 700,
                    outline: 'none',
                    cursor: 'pointer'
                  }}
                >
                  <option value="A Fazer" style={{ background: 'var(--surface-low)', color: 'var(--text-on-surface)' }}>A Fazer</option>
                  <option value="Em Execução" style={{ background: 'var(--surface-low)', color: 'var(--text-on-surface)' }}>Em Execução</option>
                  <option value="Pendente" style={{ background: 'var(--surface-low)', color: 'var(--text-on-surface)' }}>Pendente</option>
                  <option value="Concluído" style={{ background: 'var(--surface-low)', color: 'var(--text-on-surface)' }}>Concluído</option>
                </select>
              </div>
            </div>

            {/* Responsáveis */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Responsáveis</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{
                  width: '20px',
                  height: '20px',
                  borderRadius: '50%',
                  background: 'var(--primary)',
                  color: '#ffffff',
                  fontSize: '9px',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  {assignee === 'Sem responsável' ? '?' : assignee.charAt(0).toUpperCase()}
                </div>
                <select 
                  value={assignee} 
                  onChange={(e) => handleUpdateAssignee(e.target.value)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-on-surface)',
                    fontSize: '12px',
                    fontWeight: 700,
                    outline: 'none',
                    cursor: 'pointer'
                  }}
                >
                  <option value="Sem responsável" style={{ background: 'var(--surface-low)', color: 'var(--text-on-surface)' }}>Sem responsável</option>
                  <option value="Saymon" style={{ background: 'var(--surface-low)', color: 'var(--text-on-surface)' }}>Saymon</option>
                  <option value="Time SistemIA" style={{ background: 'var(--surface-low)', color: 'var(--text-on-surface)' }}>Time SistemIA</option>
                  <option value="Cláudio" style={{ background: 'var(--surface-low)', color: 'var(--text-on-surface)' }}>Cláudio</option>
                </select>
              </div>
            </div>

            {/* Datas */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Datas</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 700 }}>
                <input 
                  type="date" 
                  value={startDate}
                  onChange={(e) => handleUpdateStartDate(e.target.value)}
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-on-surface)', fontSize: '11px', outline: 'none', cursor: 'pointer' }}
                />
                <span style={{ color: 'var(--text-muted)' }}>→</span>
                <input 
                  type="date" 
                  value={endDate}
                  onChange={(e) => handleUpdateEndDate(e.target.value)}
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-on-surface)', fontSize: '11px', outline: 'none', cursor: 'pointer' }}
                />
              </div>
            </div>

            {/* Rastrear tempo */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Rastrear Tempo</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button 
                  onClick={toggleTimer}
                  style={{
                    background: isTimerRunning ? '#ef4444' : 'var(--primary)',
                    border: 'none',
                    color: '#ffffff',
                    borderRadius: '4px',
                    padding: '2px 8px',
                    fontSize: '10px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>{isTimerRunning ? 'pause' : 'play_arrow'}</span>
                  <span>{isTimerRunning ? 'Stop' : 'Start'}</span>
                </button>
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-on-surface)' }}>
                  {formatTimerTime(timerSeconds)}
                </span>
              </div>
            </div>

            {/* Prioridade */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Prioridade</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '15px', color: getPriorityFlagColor(priority) }}>flag</span>
                <select 
                  value={priority || ''} 
                  onChange={(e) => handleUpdatePriority((e.target.value || null) as TaskPriority)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-on-surface)',
                    fontSize: '12px',
                    fontWeight: 700,
                    outline: 'none',
                    cursor: 'pointer'
                  }}
                >
                  <option value="" style={{ background: 'var(--surface-low)', color: 'var(--text-on-surface)' }}>Sem prioridade</option>
                  <option value="Urgente" style={{ background: 'var(--surface-low)', color: 'var(--text-on-surface)' }}>Urgente</option>
                  <option value="Alta" style={{ background: 'var(--surface-low)', color: 'var(--text-on-surface)' }}>Alta</option>
                  <option value="Normal" style={{ background: 'var(--surface-low)', color: 'var(--text-on-surface)' }}>Normal</option>
                  <option value="Baixa" style={{ background: 'var(--surface-low)', color: 'var(--text-on-surface)' }}>Baixa</option>
                </select>
              </div>
            </div>

          </div>

          {/* DESCRIÇÃO DA TAREFA */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Descrição</span>
            <textarea 
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={() => handleUpdateDescription(description)}
              placeholder="Adicionar descrição..."
              style={{
                width: '100%',
                minHeight: '80px',
                background: 'var(--surface-low)',
                border: '1px solid var(--outline)',
                borderRadius: '8px',
                padding: '12px',
                color: 'var(--text-on-surface)',
                fontSize: '13px',
                lineHeight: '1.5',
                outline: 'none',
                resize: 'vertical',
                boxSizing: 'border-box'
              }}
              onFocus={(e) => e.target.style.borderColor = 'var(--primary)'}
              onBlurCapture={(e) => e.target.style.borderColor = 'var(--outline)'}
            />
          </div>

          {/* SEÇÃO CAMPOS (Progresso, Valor) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <button 
              onClick={() => setShowCampos(!showCampos)}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-on-surface)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 0',
                width: '100%',
                textAlign: 'left',
                fontWeight: 700,
                fontSize: '13px'
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px', transform: showCampos ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.2s' }}>
                arrow_drop_down
              </span>
              <span>Campos</span>
            </button>

            {showCampos && (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                paddingLeft: '24px',
                marginTop: '4px'
              }}>
                {/* Progresso */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ width: '120px', fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>Progresso</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '200px' }}>
                    <div style={{
                      flex: 1,
                      background: 'rgba(16, 185, 129, 0.15)',
                      height: '4px',
                      borderRadius: '2px',
                      overflow: 'hidden'
                    }}>
                      <div style={{
                        width: `${progress}%`,
                        background: '#10b981',
                        height: '100%',
                        borderRadius: '2px'
                      }} />
                    </div>
                    <span style={{ fontSize: '11px', color: '#10b981', fontWeight: 700 }}>{progress}%</span>
                  </div>
                </div>

                {/* Valor Financeiro */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ width: '120px', fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>Valor Financeiro (R$)</div>
                  <input 
                    type="number"
                    value={contractValue}
                    onChange={(e) => setContractValue(Number(e.target.value))}
                    onFocus={(e) => { e.currentTarget.select(); e.currentTarget.style.borderColor = 'var(--primary)'; }}
                    onBlur={(e) => { handleUpdateValue(contractValue); e.currentTarget.style.borderColor = 'var(--outline)'; }}
                    style={{
                      background: 'var(--surface-low)',
                      border: '1px solid var(--outline)',
                      borderRadius: '6px',
                      padding: '4px 8px',
                      color: 'var(--text-on-surface)',
                      fontSize: '12px',
                      outline: 'none',
                      width: '120px'
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* SEÇÃO SUBTAREFAS */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <button 
              onClick={() => setShowSubtasks(!showSubtasks)}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-on-surface)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 0',
                width: '100%',
                textAlign: 'left',
                fontWeight: 700,
                fontSize: '13px'
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px', transform: showSubtasks ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.2s' }}>
                arrow_drop_down
              </span>
              <span>Subtarefas</span>
              <span style={{
                background: 'var(--surface-low)',
                color: 'var(--text-muted)',
                borderRadius: '12px',
                padding: '1px 6px',
                fontSize: '10px',
                fontWeight: 700,
                marginLeft: '4px',
                border: '1px solid var(--outline)'
              }}>
                {subtasks.length} disponível
              </span>
            </button>

            {showSubtasks && (
              <div style={{
                paddingLeft: '24px',
                marginTop: '6px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}>
                {/* Lista de Subtarefas */}
                {subtasks.length > 0 && (
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    border: '1px solid var(--outline)',
                    borderRadius: '8px',
                    background: 'var(--surface-low)',
                    overflow: 'hidden'
                  }}>
                    {subtasks.map(sub => {
                      const subAssignee = localStorage.getItem(`task_assignee_${sub.id}`) || 'Sem responsável';
                      return (
                        <div 
                          key={sub.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '8px 12px',
                            borderBottom: '1px solid var(--outline)',
                            fontSize: '12px'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span 
                              className="material-symbols-outlined" 
                              style={{ 
                                fontSize: '16px', 
                                color: sub.status === 'Concluído' ? '#10b981' : 'var(--text-muted)',
                                cursor: 'pointer'
                              }}
                              onClick={() => onUpdateTaskField(sub.id, { status: sub.status === 'Concluído' ? 'A Fazer' : 'Concluído' })}
                            >
                              {sub.status === 'Concluído' ? 'check_circle' : 'radio_button_unchecked'}
                            </span>
                            {/* NUNCA RISCADO (NO STRIKE-THROUGH) */}
                            <span style={{ textDecoration: 'none', color: sub.status === 'Concluído' ? 'var(--text-muted)' : 'var(--text-on-surface)' }}>
                              {sub.description}
                            </span>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            {/* Responsável da Subtarefa */}
                            <div style={{
                              width: '18px',
                              height: '18px',
                              borderRadius: '50%',
                              background: '#3b82f6',
                              color: '#ffffff',
                              fontSize: '8px',
                              fontWeight: 700,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}>
                              {subAssignee.charAt(0).toUpperCase()}
                            </div>
                            {/* Prioridade da Subtarefa */}
                            {sub.priority && (
                              <span className="material-symbols-outlined" style={{ fontSize: '14px', color: getPriorityFlagColor(sub.priority) }}>flag</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Input rápido para criar subtarefa */}
                <form onSubmit={handleAddSubtask} style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                  <input 
                    type="text" 
                    placeholder="+ Adicionar Subtarefa..."
                    value={newSubtaskDesc}
                    onChange={(e) => setNewSubtaskDesc(e.target.value)}
                    style={{
                      flex: 1,
                      background: 'var(--surface-low)',
                      border: '1px solid var(--outline)',
                      borderRadius: '6px',
                      padding: '6px 12px',
                      color: 'var(--text-on-surface)',
                      fontSize: '12px',
                      outline: 'none'
                    }}
                    onFocus={(e) => e.target.style.borderColor = 'var(--primary)'}
                    onBlur={(e) => e.target.style.borderColor = 'var(--outline)'}
                  />
                  <button 
                    type="submit" 
                    style={{
                      background: 'var(--primary)',
                      border: 'none',
                      color: '#ffffff',
                      borderRadius: '6px',
                      padding: '6px 12px',
                      fontSize: '11px',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    Adicionar
                  </button>
                </form>
              </div>
            )}
          </div>

          {/* SEÇÃO CHECKLIST */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>playlist_add_check</span>
              Checklist
            </span>

            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              padding: '12px',
              background: 'var(--surface-low)',
              border: '1px solid var(--outline)',
              borderRadius: '8px'
            }}>
              {checklist.map(item => (
                <div key={item.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', fontSize: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span 
                      className="material-symbols-outlined" 
                      onClick={() => toggleChecklistItem(item.id)}
                      style={{ fontSize: '18px', color: item.isChecked ? '#10b981' : 'var(--text-muted)', cursor: 'pointer' }}
                    >
                      {item.isChecked ? 'check_box' : 'check_box_outline_blank'}
                    </span>
                    <span style={{ textDecoration: item.isChecked ? 'line-through' : 'none', color: item.isChecked ? 'var(--text-muted)' : 'var(--text-on-surface)' }}>
                      {item.label}
                    </span>
                  </div>
                  <button 
                    onClick={() => deleteChecklistItem(item.id)}
                    style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', display: 'flex' }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>close</span>
                  </button>
                </div>
              ))}

              <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                <input 
                  type="text" 
                  placeholder="Novo item de checklist..."
                  value={newChecklistItem}
                  onChange={(e) => setNewChecklistItem(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleAddChecklistItem(); }}
                  style={{
                    flex: 1,
                    background: 'var(--surface)',
                    border: '1px solid var(--outline)',
                    borderRadius: '6px',
                    padding: '4px 8px',
                    color: 'var(--text-on-surface)',
                    fontSize: '11px',
                    outline: 'none'
                  }}
                />
                <button 
                  onClick={handleAddChecklistItem}
                  style={{
                    background: 'transparent',
                    border: '1px solid var(--primary)',
                    color: 'var(--primary)',
                    borderRadius: '6px',
                    padding: '4px 10px',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Adicionar
                </button>
              </div>
            </div>
          </div>

          {/* SEÇÃO ANEXOS (ANEXAR ARQUIVOS) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>attach_file</span>
              Arquivos Anexos
            </span>

            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              padding: '16px',
              background: 'var(--surface-low)',
              border: '1px dashed var(--outline)',
              borderRadius: '12px',
              textAlign: 'center'
            }}>
              
              {/* Lista de Arquivos Atuais */}
              {attachments.length > 0 ? (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                  gap: '8px',
                  textAlign: 'left',
                  marginBottom: '12px'
                }}>
                  {attachments.map(att => (
                    <div 
                      key={att.id}
                      style={{
                        background: 'var(--surface)',
                        border: '1px solid var(--outline)',
                        borderRadius: '8px',
                        padding: '8px 10px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '6px'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '20px', color: 'var(--primary)' }}>description</span>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-on-surface)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={att.name}>
                            {att.name}
                          </div>
                          <div style={{ fontSize: '9px', color: 'var(--text-muted)' }}>
                            {att.size} • {att.uploadedAt}
                          </div>
                        </div>
                      </div>

                      <button 
                        onClick={() => handleDeleteAttachment(att.id)}
                        style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', display: 'flex', padding: '2px' }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>delete</span>
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px' }}>Nenhum arquivo anexado ainda.</div>
              )}

              {/* Botão de Anexo */}
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                multiple
                style={{ display: 'none' }} 
              />
              <button 
                onClick={triggerFileSelect}
                style={{
                  alignSelf: 'center',
                  background: 'rgba(123, 104, 238, 0.1)',
                  border: '1px solid var(--primary)',
                  color: 'var(--primary)',
                  borderRadius: '6px',
                  padding: '6px 16px',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
                onMouseOver={(e) => e.currentTarget.style.background = 'rgba(123, 104, 238, 0.2)'}
                onMouseOut={(e) => e.currentTarget.style.background = 'rgba(123, 104, 238, 0.1)'}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>cloud_upload</span>
                Anexar arquivo
              </button>
            </div>
          </div>

        </div>

      </div>
      
    </div>
  );
};
