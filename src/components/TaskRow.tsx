import React, { useState, useRef, useEffect } from 'react';
import type { Task, TaskStatus, CustomField } from '../types';
import { supabaseService } from '../supabaseClient';

const maskCurrency = (val: string) => {
  let clean = val.replace(/\D/g, '');
  if (!clean) return '';
  const num = parseFloat(clean) / 100;
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(num);
};

export interface CustomStatus {
  id: string;
  label: string;
  category: TaskStatus;
  color: string;
  icon: string;
  textColor?: string;
  backgroundColor?: string;
}

interface TaskRowProps {
  task: Task;
  hasChildren: boolean;
  isExpanded: boolean;
  progress: number;
  subtasksCount?: number;
  visibleColumns?: {
    progress: boolean;
    status: boolean;
    startDate: boolean;
    endDate: boolean;
    financialValue: boolean;
    priority: boolean;
  };
  customStatuses: CustomStatus[];
  onUpdateTaskStatus: (taskId: string, category: TaskStatus, customLabel: string) => Promise<void>;
  onToggleExpand: (id: string) => void;
  onAddTask: (parentId: string) => void;
  onEditTask: (task: Task) => void;
  onDeleteTask: (id: string) => void;
  isReadOnly?: boolean;
  isFlatMode?: boolean;
  customFields?: CustomField[];
  visibleCustomColumns?: Record<string, boolean>;
  allTasks?: Task[];
  columnWidths?: Record<string, number>;
  onUpdateTaskField?: (taskId: string, fields: Partial<Task>) => Promise<void>;
  columnOrder?: string[];
  isSelected?: boolean;
  onToggleSelect?: (id: string, selected: boolean, shiftKey?: boolean) => void;
  onDragStart?: (taskId: string) => void;
  onDragOver?: (taskId: string, relativeX: number) => void;
  onDrop?: (draggedId: string, targetId: string, relativeX: number) => void;

  onDragEnd?: () => void;
  draggedTaskId?: string | null;
  activeThreeDotsTaskId?: string | null;
  setActiveThreeDotsTaskId?: (id: string | null) => void;
  onFilterByTag?: (tagId: string) => void;
  onShareClient?: (clientName: string) => void;
}

export const TaskRow: React.FC<TaskRowProps> = ({
  task,
  hasChildren,
  isExpanded,
  progress,
  subtasksCount = 0,
  visibleColumns = {
    progress: true,
    status: true,
    startDate: true,
    endDate: true,
    financialValue: true,
    priority: true
  },
  customStatuses,
  onUpdateTaskStatus,
  onToggleExpand,
  onAddTask,
  onEditTask,
  onDeleteTask,
  onUpdateTaskField,
  isReadOnly = false,
  isFlatMode = false,
  customFields = [],
  visibleCustomColumns = {},
  allTasks = [],
  columnWidths = {
    taskName: 320,
    progress: 80,
    status: 90,
    startDate: 80,
    endDate: 80,
    financialValue: 110,
    priority: 95
  },
  columnOrder = ['progress', 'status', 'startDate', 'endDate', 'financialValue'],
  isSelected = false,
  onToggleSelect,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  draggedTaskId,
  activeThreeDotsTaskId = null,
  setActiveThreeDotsTaskId,
  onFilterByTag,
  onShareClient
}) => {
  const level = isFlatMode ? 0 : (task.level || 0);
  const [statusDropdownSource, setStatusDropdownSource] = useState<'bubble' | 'badge' | null>(null);
  const [searchStatusQuery, setSearchStatusQuery] = useState('');
  const [showManageStatus, setShowManageStatus] = useState(false);
  
  // Estados de edição inline
  const [isEditingStartDate, setIsEditingStartDate] = useState(false);
  const [tempStartDate, setTempStartDate] = useState(task.start_date || '');
  const [isEditingEndDate, setIsEditingEndDate] = useState(false);
  const [tempEndDate, setTempEndDate] = useState(task.end_date || '');
  const [isEditingFinancial, setIsEditingFinancial] = useState(false);
  const [tempFinancial, setTempFinancial] = useState(task.contract_value?.toString() || '0');
  const [showPriorityDropdown, setShowPriorityDropdown] = useState(false);
  const priorityDropdownRef = useRef<HTMLDivElement>(null);

  const showThreeDotsMenu = activeThreeDotsTaskId === task.id;
  const setShowThreeDotsMenu = (show: boolean) => {
    if (show) {
      window.dispatchEvent(new CustomEvent('close-all-tag-popovers'));
    }
    setActiveThreeDotsTaskId?.(show ? task.id : null);
  };
  const [threeDotsRect, setThreeDotsRect] = useState<DOMRect | null>(null);

  // ESTADOS DE ETIQUETAS / TAGS
  const [showTagDropdown, setShowTagDropdown] = useState(false);
  const [tagDropdownRect, setTagDropdownRect] = useState<DOMRect | null>(null);
  const [tagSearchQuery, setTagSearchQuery] = useState('');
  const [editingTagObj, setEditingTagObj] = useState<{ id: string; name: string; color: string } | null>(null);
  const [editingTagRect, setEditingTagRect] = useState<DOMRect | null>(null);

  // Auxiliares de Etiquetas / Tags
  const getGlobalTags = (): { id: string; name: string; color: string }[] => {
    const saved = localStorage.getItem('taskmaster_global_tags');
    return saved ? JSON.parse(saved) : [];
  };

  const saveGlobalTags = (tags: { id: string; name: string; color: string }[]) => {
    localStorage.setItem('taskmaster_global_tags', JSON.stringify(tags));
  };

  const handleToggleTaskTag = async (tagId: string) => {
    const currentTags: string[] = (task as any).tags || [];
    let newTags: string[];
    if (currentTags.includes(tagId)) {
      newTags = currentTags.filter(id => id !== tagId);
    } else {
      newTags = [...currentTags, tagId];
    }
    await onUpdateTaskField?.(task.id, { tags: newTags } as any);
  };

  const handleCreateNewGlobalTag = (name: string) => {
    const currentGlobal = getGlobalTags();
    const tagColors = ['#5f55ec', '#0080ff', '#db2777', '#10b981', '#f59e0b', '#7e7e88'];
    const randomColor = tagColors[Math.floor(Math.random() * tagColors.length)];
    const newTag = {
      id: 'tag_' + Math.random().toString(36).substr(2, 9),
      name,
      color: randomColor
    };
    saveGlobalTags([...currentGlobal, newTag]);
    handleToggleTaskTag(newTag.id);
    setTagSearchQuery('');
  };

  const handleDeleteGlobalTagPermanently = (tagId: string) => {
    const currentGlobal = getGlobalTags();
    saveGlobalTags(currentGlobal.filter(t => t.id !== tagId));
    
    // Remove de todas as tarefas
    allTasks.forEach(async (t) => {
      const taskTags: string[] = (t as any).tags || [];
      if (taskTags.includes(tagId)) {
        const nextTags = taskTags.filter(id => id !== tagId);
        await onUpdateTaskField?.(t.id, { tags: nextTags } as any);
      }
    });
  };

  // Auto-fechar o menu de três pontinhos ao clicar fora
  useEffect(() => {
    if (!showThreeDotsMenu) return;
    const handleOutsideClick = () => {
      setShowThreeDotsMenu(false);
    };
    // Aguarda um tick para evitar fechar no próprio clique de abertura
    const timeout = setTimeout(() => {
      document.addEventListener('click', handleOutsideClick);
    }, 10);
    return () => {
      clearTimeout(timeout);
      document.removeEventListener('click', handleOutsideClick);
    };
  }, [showThreeDotsMenu]);

  // Auto-fechar o menu de etiquetas ao clicar fora
  useEffect(() => {
    if (!showTagDropdown) return;
    const handleOutsideClick = () => {
      setShowTagDropdown(false);
    };
    const timeout = setTimeout(() => {
      document.addEventListener('click', handleOutsideClick);
    }, 10);
    return () => {
      clearTimeout(timeout);
      document.removeEventListener('click', handleOutsideClick);
    };
  }, [showTagDropdown]);

  // Auto-fechar o menu de edição de etiqueta ao clicar fora
  useEffect(() => {
    if (!editingTagObj) return;
    const handleOutsideClick = () => {
      setEditingTagObj(null);
    };
    const timeout = setTimeout(() => {
      document.addEventListener('click', handleOutsideClick);
    }, 10);
    return () => {
      clearTimeout(timeout);
      document.removeEventListener('click', handleOutsideClick);
    };
  }, [editingTagObj]);

  // Ouvir fechamento global para fechar tudo neste TaskRow
  useEffect(() => {
    const handleCloseAll = () => {
      setShowTagDropdown(false);
      setEditingTagObj(null);
      setShowThreeDotsMenu(false);
    };
    window.addEventListener('close-all-tag-popovers', handleCloseAll);
    return () => {
      window.removeEventListener('close-all-tag-popovers', handleCloseAll);
    };
  }, []);

  useEffect(() => {
    setTempStartDate(task.start_date || '');
    setTempEndDate(task.end_date || '');
    setTempFinancial(task.contract_value?.toString() || '0');
  }, [task]);
  const [showSubtasksTooltip, setShowSubtasksTooltip] = useState(false);
  const [showChecklistTooltip, setShowChecklistTooltip] = useState(false);
  const [isRowDraggable, setIsRowDraggable] = useState(false);

  const handleDuplicateTask = async () => {
    try {
      const newFormData = {
        description: `${task.description} (Cópia)`,
        parent_id: task.parent_id,
        client_name: task.client_name,
        contract_value: task.contract_value || 0,
        status: task.status,
        priority: task.priority || null,
        start_date: task.start_date,
        end_date: task.end_date,
        owner_id: task.owner_id || 'default_owner',
        level: task.level || 0
      };
      await supabaseService.createTask(newFormData);
      window.dispatchEvent(new Event('refreshTasks'));
    } catch (err) {
      console.error('Erro ao duplicar tarefa:', err);
    }
  };



  // Estados para gerenciar status CRUD com cores personalizadas
  const [manageView, setManageView] = useState<'list' | 'create' | 'edit'>('list');
  const [editingStatusId, setEditingStatusId] = useState<string | null>(null);
  const [statusLabelInput, setStatusLabelInput] = useState('');
  const [statusCategoryInput, setStatusCategoryInput] = useState<TaskStatus>('A Fazer');
  const [statusColorInput, setStatusColorInput] = useState('#7e7e88');
  const [statusTextColorInput, setStatusTextColorInput] = useState('#ffffff');

  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (target && target.classList && target.classList.contains('status-dropdown-trigger')) {
        return;
      }
      if (dropdownRef.current && !dropdownRef.current.contains(target)) {
        setStatusDropdownSource(null);
        setShowManageStatus(false);
      }
      if (priorityDropdownRef.current && !priorityDropdownRef.current.contains(target)) {
        setShowPriorityDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    const [year, month, day] = dateStr.split('-');
    const dayInt = parseInt(day, 10);
    const monthInt = parseInt(month, 10);
    return `${dayInt}/${monthInt}/${year.substring(2)}`;
  };

  const renderEndDate = (dateStr: string) => {
    if (!dateStr) return '-';

    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const todayStr = `${year}-${month}-${day}`;

    const isToday = dateStr === todayStr;
    const isPast = dateStr < todayStr;

    if (isToday) {
      return (
        <span style={{ fontWeight: 800, color: '#e5a93b' }}>Hoje</span>
      );
    }

    if (isPast) {
      const [y, m, dayVal] = dateStr.split('-');
      const dInt = parseInt(dayVal, 10);
      const mInt = parseInt(m, 10);
      return (
        <span style={{ color: '#F44336', fontWeight: 600 }}>
          {`${dInt}/${mInt}/${y.substring(2)}`}
        </span>
      );
    }

    const [y, m, dayVal] = dateStr.split('-');
    const dInt = parseInt(dayVal, 10);
    const mInt = parseInt(m, 10);
    return `${dInt}/${mInt}/${y.substring(2)}`;
  };

  // Busca o rótulo do status customizado persistido no localStorage para a tarefa atual
  const getCustomLabel = () => {
    const saved = localStorage.getItem(`task_custom_status_${task.id}`);
    if (saved) return saved;
    return task.status.toUpperCase();
  };

  const getStatusBadgeStyle = (status: TaskStatus): React.CSSProperties => {
    const currentLabel = getCustomLabel();
    const matched = customStatuses.find(s => s.label.toUpperCase() === currentLabel.toUpperCase());

    let background = 'rgba(126, 126, 136, 0.1)';
    let color = '#a1a1aa';
    let border = '1px solid #2d2d35';

    if (matched) {
      background = matched.color;
      color = matched.textColor || '#ffffff';
      border = 'none';
    } else {
      if (status === 'Em Execução') {
        background = '#0058be';
        color = '#ffffff';
        border = 'none';
      } else if (status === 'Pendente') {
        background = 'var(--primary)';
        color = '#ffffff';
        border = 'none';
      } else if (status === 'Concluído') {
        background = '#10b981';
        color = '#ffffff';
        border = 'none';
      }
    }

    return {
      background,
      color,
      border,
      display: 'inline-block',
      lineHeight: '18px',
      padding: '0 8px',
      borderRadius: '12px',
      fontSize: '9px',
      fontWeight: 700,
      letterSpacing: '0.03em',
      height: '18px',
      width: '100%',
      maxWidth: '95px',
      minWidth: '40px',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      textAlign: 'center',
      cursor: isReadOnly ? 'default' : 'pointer',
      userSelect: 'none',
      transition: 'opacity 0.2s',
      boxSizing: 'border-box',
      verticalAlign: 'middle'
    };
  };

  const handleSelectStatus = async (category: TaskStatus, label: string) => {
    await onUpdateTaskStatus(task.id, category, label.toUpperCase());
    setStatusDropdownSource(null);
  };

  const handleSaveStatus = () => {
    if (!statusLabelInput.trim()) return;

    const cleanLabel = statusLabelInput.trim().toUpperCase();
    const savedStatuses = localStorage.getItem('custom_statuses_list');
    let list: CustomStatus[] = savedStatuses ? JSON.parse(savedStatuses) : [];

    if (manageView === 'create') {
      const newStatusItem: CustomStatus = {
        id: Date.now().toString(),
        label: cleanLabel,
        category: statusCategoryInput,
        color: statusColorInput,
        icon: statusCategoryInput === 'Concluído' ? 'check_circle' : (statusCategoryInput === 'Em Execução' ? 'pending' : (statusCategoryInput === 'Pendente' ? 'schedule' : 'radio_button_unchecked')),
        textColor: statusTextColorInput
      };
      list.push(newStatusItem);
      localStorage.setItem('custom_statuses_list', JSON.stringify(list));
      window.dispatchEvent(new Event('customStatusesChanged'));
      handleSelectStatus(statusCategoryInput, cleanLabel);
    } else if (manageView === 'edit' && editingStatusId) {
      list = list.map(s => {
        if (s.id === editingStatusId) {
          return {
            ...s,
            label: cleanLabel,
            category: statusCategoryInput,
            color: statusColorInput,
            textColor: statusTextColorInput
          };
        }
        return s;
      });
      localStorage.setItem('custom_statuses_list', JSON.stringify(list));
      window.dispatchEvent(new Event('customStatusesChanged'));
    }

    setStatusLabelInput('');
    setManageView('list');
    setShowManageStatus(false);
  };

  const handleDeleteStatus = (id: string) => {
    const savedStatuses = localStorage.getItem('custom_statuses_list');
    if (!savedStatuses) return;
    let list: CustomStatus[] = JSON.parse(savedStatuses);
    list = list.filter(s => s.id !== id);
    localStorage.setItem('custom_statuses_list', JSON.stringify(list));
    window.dispatchEvent(new Event('customStatusesChanged'));
  };

  const filteredStatuses = customStatuses.filter(s =>
    s.label.toLowerCase().includes(searchStatusQuery.toLowerCase())
  );

  const renderDropdownContent = () => {
    return (
      <div
        ref={dropdownRef}
        style={{
          position: 'absolute',
          top: 'calc(100% + 4px)',
          left: '0px',
          background: 'var(--surface)',
          border: '1px solid var(--outline-variant)',
          borderRadius: 'var(--radius-md)',
          boxShadow: 'var(--shadow-lg)',
          padding: '8px',
          width: '210px',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}
      >
        {!showManageStatus ? (
          <>
            <div style={{ display: 'flex', borderBottom: '1px solid var(--outline)', paddingBottom: '4px' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-on-surface)', flex: 1 }}>Status</span>
              <span
                onClick={(e) => { e.stopPropagation(); setShowManageStatus(true); }}
                className="material-symbols-outlined"
                style={{ fontSize: '14px', color: 'var(--text-muted)', cursor: 'pointer' }}
                title="Criar Status Personalizado"
              >
                more_horiz
              </span>
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              background: 'var(--surface-low)',
              border: '1px solid var(--outline)',
              borderRadius: 'var(--radius-sm)',
              padding: '2px 6px'
            }} onClick={(e) => e.stopPropagation()}>
              <span className="material-symbols-outlined" style={{ fontSize: '12px', color: 'var(--text-muted)', marginRight: '4px' }}>search</span>
              <input
                type="text"
                value={searchStatusQuery}
                onChange={(e) => setSearchStatusQuery(e.target.value)}
                placeholder="Pesquisar..."
                style={{
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  fontSize: '11px',
                  color: 'var(--text-on-surface)',
                  width: '100%'
                }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }} onClick={(e) => e.stopPropagation()}>
              <div style={{ fontSize: '9px', fontWeight: 700, color: 'var(--text-muted-dark)', textTransform: 'uppercase', padding: '4px 4px 2px 4px' }}>Ativos</div>

              {filteredStatuses.filter(s => s.category !== 'Concluído').map(status => {
                const isCurrent = getCustomLabel() === status.label;
                return (
                  <button
                    key={status.id}
                    onClick={() => handleSelectStatus(status.category, status.label)}
                    style={{
                      background: isCurrent ? 'var(--primary-light)' : 'transparent',
                      border: 'none',
                      borderRadius: 'var(--radius-sm)',
                      color: isCurrent ? 'var(--text-on-surface)' : 'var(--text-on-surface)',
                      padding: '4px 6px',
                      fontSize: '11px',
                      fontWeight: isCurrent ? 600 : 500,
                      textAlign: 'left',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      width: '100%'
                    }}
                    onMouseOver={(e) => {
                      if (!isCurrent) e.currentTarget.style.background = 'var(--surface-low)';
                    }}
                    onMouseOut={(e) => {
                      if (!isCurrent) e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <span
                      className="material-symbols-outlined"
                      style={{
                        fontSize: '13px',
                        color: status.color
                      }}
                    >
                      {status.icon}
                    </span>
                    <span style={{ flex: 1 }}>{status.label}</span>
                    {isCurrent && (
                      <span className="material-symbols-outlined" style={{ fontSize: '11px', color: 'var(--primary)' }}>check</span>
                    )}
                  </button>
                );
              })}

              <div style={{ fontSize: '9px', fontWeight: 700, color: 'var(--text-muted-dark)', textTransform: 'uppercase', padding: '6px 4px 2px 4px', borderTop: '1px solid var(--outline)' }}>Fechado</div>

              {filteredStatuses.filter(s => s.category === 'Concluído').map(status => {
                const isCurrent = getCustomLabel() === status.label;
                return (
                  <button
                    key={status.id}
                    onClick={() => handleSelectStatus(status.category, status.label)}
                    style={{
                      background: isCurrent ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
                      border: 'none',
                      borderRadius: 'var(--radius-sm)',
                      color: isCurrent ? '#10b981' : 'var(--text-on-surface)',
                      padding: '4px 6px',
                      fontSize: '11px',
                      fontWeight: isCurrent ? 600 : 500,
                      textAlign: 'left',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      width: '100%'
                    }}
                    onMouseOver={(e) => {
                      if (!isCurrent) e.currentTarget.style.background = 'var(--surface-low)';
                    }}
                    onMouseOut={(e) => {
                      if (!isCurrent) e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '13px', color: '#10b981' }}>{status.icon}</span>
                    <span style={{ flex: 1 }}>{status.label}</span>
                    {isCurrent && (
                      <span className="material-symbols-outlined" style={{ fontSize: '11px', color: '#10b981' }}>check</span>
                    )}
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--outline-variant)', paddingBottom: '6px' }}>
              <span
                onClick={(e) => { 
                  e.stopPropagation(); 
                  if (manageView === 'list') {
                    setShowManageStatus(false); 
                  } else {
                    setManageView('list');
                  }
                }}
                className="material-symbols-outlined"
                style={{ fontSize: '16px', color: 'var(--text-muted)', cursor: 'pointer', marginRight: '4px' }}
              >
                arrow_back
              </span>
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-on-surface)', flex: 1 }}>
                {manageView === 'list' ? 'Gerenciar Status' : (manageView === 'create' ? 'Novo Status' : 'Editar Status')}
              </span>
              {manageView === 'list' && (
                <button
                  onClick={() => {
                    setManageView('create');
                    setEditingStatusId(null);
                    setStatusLabelInput('');
                    setStatusCategoryInput('A Fazer');
                    setStatusColorInput('#7e7e88');
                    setStatusTextColorInput('#ffffff');
                  }}
                  style={{
                    background: 'var(--primary)',
                    border: 'none',
                    borderRadius: 'var(--radius-sm)',
                    color: '#ffffff',
                    padding: '2px 6px',
                    fontSize: '10px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '2px'
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '11px' }}>add</span> Novo
                </button>
              )}
            </div>

            {manageView === 'list' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '180px', overflowY: 'auto', paddingRight: '2px' }}>
                {customStatuses.map(status => (
                  <div key={status.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px', borderRadius: 'var(--radius-sm)', background: 'var(--surface-low)', border: '1px solid var(--outline)' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '12px', color: status.color }}>{status.icon || 'circle'}</span>
                    <span style={{ 
                      flex: 1, 
                      fontSize: '10px', 
                      fontWeight: 700, 
                      color: status.textColor || '#ffffff', 
                      background: status.color, 
                      padding: '2px 6px', 
                      borderRadius: '8px',
                      textOverflow: 'ellipsis',
                      overflow: 'hidden',
                      whiteSpace: 'nowrap',
                      textAlign: 'center'
                    }}>
                      {status.label}
                    </span>
                    <span
                      onClick={() => {
                        setEditingStatusId(status.id);
                        setStatusLabelInput(status.label);
                        setStatusCategoryInput(status.category);
                        setStatusColorInput(status.color);
                        setStatusTextColorInput(status.textColor || '#ffffff');
                        setManageView('edit');
                      }}
                      className="material-symbols-outlined"
                      style={{ fontSize: '12px', color: 'var(--text-muted)', cursor: 'pointer' }}
                      title="Editar"
                    >
                      edit
                    </span>
                    <span
                      onClick={() => {
                        if (window.confirm(`Tem certeza que deseja excluir o status "${status.label}"?`)) {
                          handleDeleteStatus(status.id);
                        }
                      }}
                      className="material-symbols-outlined"
                      style={{ fontSize: '12px', color: '#ef4444', cursor: 'pointer' }}
                      title="Excluir"
                    >
                      delete
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <label style={{ fontSize: '8px', fontWeight: 700, color: 'var(--text-muted)' }}>Nome do Status</label>
                  <input
                    type="text"
                    value={statusLabelInput}
                    onChange={(e) => setStatusLabelInput(e.target.value)}
                    placeholder="EX: URGENTE, AVISOS"
                    style={{
                      background: 'var(--surface-low)',
                      border: '1px solid var(--outline)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '4px 6px',
                      fontSize: '11px',
                      color: 'var(--text-on-surface)',
                      outline: 'none'
                    }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <label style={{ fontSize: '8px', fontWeight: 700, color: 'var(--text-muted)' }}>Categoria de Progresso</label>
                  <select
                    value={statusCategoryInput}
                    onChange={(e) => setStatusCategoryInput(e.target.value as TaskStatus)}
                    style={{
                      width: '100%',
                      background: 'var(--surface-low)',
                      border: '1px solid var(--outline)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '4px 6px',
                      fontSize: '11px',
                      color: 'var(--text-on-surface)',
                      outline: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="A Fazer">A Fazer</option>
                    <option value="Em Execução">Em Execução</option>
                    <option value="Pendente">Pendente</option>
                    <option value="Concluído">Concluído</option>
                  </select>
                </div>

                <div style={{ display: 'flex', gap: '6px' }}>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <label style={{ fontSize: '7px', fontWeight: 700, color: 'var(--text-muted)' }}>Cor do Status (Badge e Círculo)</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--surface-low)', border: '1px solid var(--outline)', borderRadius: 'var(--radius-sm)', padding: '2px 4px' }}>
                      <input
                        type="color"
                        value={statusColorInput}
                        onChange={(e) => setStatusColorInput(e.target.value)}
                        style={{ border: 'none', background: 'none', width: '16px', height: '16px', padding: 0, cursor: 'pointer' }}
                      />
                      <span style={{ fontSize: '7px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{statusColorInput.toUpperCase()}</span>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '6px' }}>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <label style={{ fontSize: '7px', fontWeight: 700, color: 'var(--text-muted)' }}>Cor da Fonte (Texto)</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--surface-low)', border: '1px solid var(--outline)', borderRadius: 'var(--radius-sm)', padding: '2px 4px' }}>
                      <input
                        type="color"
                        value={statusTextColorInput}
                        onChange={(e) => setStatusTextColorInput(e.target.value)}
                        style={{ border: 'none', background: 'none', width: '16px', height: '16px', padding: 0, cursor: 'pointer' }}
                      />
                      <span style={{ fontSize: '7px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{statusTextColorInput.toUpperCase()}</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleSaveStatus}
                  disabled={!statusLabelInput.trim()}
                  style={{
                    background: statusLabelInput.trim() ? 'var(--primary)' : 'rgba(123, 104, 238, 0.4)',
                    border: 'none',
                    borderRadius: 'var(--radius-sm)',
                    color: '#ffffff',
                    padding: '6px',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: statusLabelInput.trim() ? 'pointer' : 'not-allowed',
                    marginTop: '4px'
                  }}
                >
                  {manageView === 'create' ? 'Cadastrar e Usar' : 'Salvar Alterações'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // LÓGICA DE GERAÇÃO DE ÍCONE DE STATUS CLICKUP-STYLE
  const renderStatusIcon = () => {
    const currentLabel = getCustomLabel().toUpperCase();
    const matched = customStatuses.find(s => s.label.toUpperCase() === currentLabel);

    let iconName = 'radio_button_unchecked';
    let iconColor = 'var(--text-muted)';

    if (matched) {
      iconName = matched.icon;
      iconColor = matched.color;

      // Mapeamento e refinamento estético ClickUp baseado na imagem do usuário
      if (matched.category === 'Concluído') {
        iconName = 'check_circle';
        iconColor = '#10b981'; // Verde da imagem
      } else if (matched.category === 'Pendente' && matched.label.includes('AGUARDANDO')) {
        iconName = 'schedule';
        iconColor = '#ba55d3'; // Lilás
      } else if (matched.category === 'Em Execução') {
        iconName = 'radio_button_unchecked';
        iconColor = '#0058be'; // Azul
      } else if (matched.category === 'A Fazer') {
        iconName = 'radio_button_unchecked';
        iconColor = '#7e7e88'; // Cinza
      }
    } else {
      if (task.status === 'Concluído') {
        iconName = 'check_circle';
        iconColor = '#10b981';
      } else if (task.status === 'Em Execução') {
        iconName = 'radio_button_unchecked';
        iconColor = '#0058be';
      } else if (task.status === 'Pendente') {
        iconName = 'schedule';
        iconColor = 'var(--primary)';
      }
    }

    return (
      <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', zIndex: 100 }}>
        <span className="material-symbols-outlined status-dropdown-trigger" style={{
          fontSize: '15px',
          marginRight: '6px',
          color: iconColor,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          userSelect: 'none'
        }}
          onClick={(e) => {
            e.stopPropagation();
            if (!isReadOnly) {
              setStatusDropdownSource(statusDropdownSource === 'bubble' ? null : 'bubble');
            }
          }}
        >
          {iconName}
        </span>
        {statusDropdownSource === 'bubble' && renderDropdownContent()}
      </div>
    );
  };

  return (
    <tr
      className="task-row transition-all-custom"
      draggable={!isReadOnly}
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', task.id);
        onDragStart?.(task.id);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        onDragOver?.(task.id, e.clientX - rect.left);
      }}
      onDrop={(e) => {
        e.preventDefault();
        const draggedId = e.dataTransfer.getData('text/plain');
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        onDrop?.(draggedId, task.id, e.clientX - rect.left);
      }}
      onDragEnd={() => {
        onDragEnd?.();
      }}
      style={{
        borderBottom: '1px solid var(--outline)',
        background: 'var(--surface)',
        height: '32px',
        opacity: draggedTaskId === task.id ? 0.4 : 1,
        position: statusDropdownSource !== null ? 'relative' : undefined,
        zIndex: statusDropdownSource !== null ? 999 : undefined,
        transition: 'opacity 0.15s ease'
      }}
      onMouseOver={(e) => {
        e.currentTarget.style.backgroundColor = 'var(--surface-hover)';
      }}
      onMouseOut={(e) => {
        e.currentTarget.style.backgroundColor = 'var(--surface)';
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setThreeDotsRect(new DOMRect(e.clientX, e.clientY, 0, 0));
        setShowThreeDotsMenu(true);
      }}
    >
      {/* Nome da Tarefa & Expansor discretos com Ações Inline no Hover */}
      <td style={{
        padding: '4px 8px 4px 16px',
        overflow: 'visible',
        width: columnWidths.taskName,
        maxWidth: columnWidths.taskName,
        boxSizing: 'border-box',
        position: 'relative',
        zIndex: statusDropdownSource === 'bubble' ? 1000 : 1
      }}>
        {/* Caixa de seleção e pontinhos (Drag Handle) ClickUp-Style - Posição Absoluta Fora do Card */}
        {!isReadOnly && (
          <div 
            className="task-row-drag-checkbox" 
            style={{ 
              position: 'absolute',
              left: '-36px',
              top: 0,
              bottom: 0,
              width: '36px',
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'flex-end',
              paddingRight: '2px',
              boxSizing: 'border-box',
              gap: '4px', 
              opacity: isSelected ? 1 : undefined,
              zIndex: 10
            }}
          >
            <span 
              className="material-symbols-outlined drag-handle" 
              style={{ 
                cursor: isRowDraggable ? 'grabbing' : 'grab', 
                color: 'var(--text-muted)', 
                fontSize: '14px',
                userSelect: 'none'
              }}
              onMouseEnter={() => setIsRowDraggable(true)}
              onMouseLeave={() => setIsRowDraggable(false)}
            >
              drag_indicator
            </span>
             <input 
              type="checkbox" 
              checked={isSelected}
              onChange={() => {}}
              onClick={(e) => onToggleSelect?.(task.id, !isSelected, e.shiftKey)}
              style={{ 
                width: '12px', 
                height: '12px', 
                cursor: 'pointer',
                accentColor: 'var(--primary)',
                outline: 'none',
                borderRadius: '2px',
                border: '1px solid var(--outline-variant)'
              }} 
            />
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', width: '100%', minWidth: 0 }}>
          {/* Espaçador de Indentação Dinâmico para manter o Alinhamento de Badges (Coluna Imaginária) */}
          {level > 0 && (
            <span style={{ width: `${Math.min(level, 6) * 22}px`, minWidth: `${Math.min(level, 6) * 22}px`, flexShrink: 0, display: 'inline-block' }} />
          )}

          {/* Botão Expansor / Seta discreta do ClickUp */}
          {!isFlatMode && hasChildren ? (
            <button
              onClick={() => onToggleExpand(task.id)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '2px',
                marginRight: '2px',
                color: 'var(--text-muted)',
                borderRadius: 'var(--radius-sm)',
                transition: 'background 0.2s'
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '14px', transform: isExpanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s ease' }}>
                play_arrow
              </span>
            </button>
          ) : (
            !isFlatMode && <span style={{ width: '20px', minWidth: '20px', flexShrink: 0, display: 'inline-block' }} />
          )}

          {/* ÍCONE DE STATUS DOURADO/VERDE/AZUL/LILÁS CLICKUP-STYLE */}
          {renderStatusIcon()}

          {/* Nome da Tarefa e Badges aninhados inline sem espaço branco artificial (Estilo ClickUp de Alta Fidelidade) */}
          <div style={{ display: 'flex', alignItems: 'center', minWidth: 0, flex: 1, marginRight: '10px' }}>
            <span 
              onClick={(e) => { e.stopPropagation(); onEditTask(task); }}
              style={{
                fontWeight: level === 0 ? 600 : 400,
                color: 'var(--text-on-surface)',
                fontSize: '13px',
                textDecoration: 'none',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                flexShrink: 1,
                minWidth: 0,
                cursor: 'pointer'
              }} 
              title={task.description}
              onMouseOver={(e) => e.currentTarget.style.color = 'var(--primary)'}
              onMouseOut={(e) => e.currentTarget.style.color = 'var(--text-on-surface)'}
            >
              {task.description}
            </span>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0, marginLeft: '6px' }}>
              
              {/* ETIQUETAS DO PROJETO CLICKUP-STYLE */}
              {(() => {
                const globalTags = getGlobalTags();
                const activeTags: string[] = (task as any).tags || [];
                if (activeTags.length === 0) return null;
                return activeTags.map(tagId => {
                  const tagObj = globalTags.find(t => t.id === tagId);
                  if (!tagObj) return null;
                  return (
                    <TagPill
                      key={tagId}
                      tag={tagObj}
                      onFilter={() => onFilterByTag?.(tagId)}
                      onRemove={() => handleToggleTaskTag(tagId)}
                      onColorChange={(tagId, newColor) => {
                        const currentGlobal = getGlobalTags();
                        const updated = currentGlobal.map(t => t.id === tagId ? { ...t, color: newColor } : t);
                        saveGlobalTags(updated);
                        const currentTags = (task as any).tags || [];
                        onUpdateTaskField?.(task.id, { tags: [...currentTags] } as any);
                      }}
                      onDeletePermanently={() => {
                        handleDeleteGlobalTagPermanently(tagId);
                      }}
                    />
                  );
                });
              })()}
              
              {/* INDICADOR DE SUBTAREFAS CONECTADAS CLICKUP-STYLE COM TOOLTIP DINÂMICO */}
              {subtasksCount > 0 && (() => {
                const directSubtasks = allTasks ? allTasks.filter(t => t.parent_id === task.id) : [];

                const subtasksByStatus = directSubtasks.reduce((acc, sub) => {
                  let label = (sub.status || 'A Fazer').toUpperCase();
                  let color = '#a1a1a1';

                  if (sub.status === 'Em Execução') {
                    label = 'EXECUTANDO';
                    color = '#0085ff';
                  } else if (sub.status === 'Pendente') {
                    label = 'AGUARDANDO';
                    color = '#e040fb';
                  } else if (sub.status === 'Concluído') {
                    label = 'CONCLUÍDO';
                    color = '#00c853';
                  } else {
                    const custom = customStatuses.find(s => s.label === sub.status);
                    if (custom) color = custom.color;
                  }

                  const key = `${color}_${label}`;
                  acc[key] = (acc[key] || 0) + 1;
                  return acc;
                }, {} as Record<string, number>);

                return (
                  <div
                    style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}
                    onMouseEnter={() => setShowSubtasksTooltip(true)}
                    onMouseLeave={() => setShowSubtasksTooltip(false)}
                  >
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '3px',
                      color: 'var(--text-muted)',
                      fontSize: '11px',
                      cursor: 'pointer'
                    }} title={`${subtasksCount} subtarefa(s) ativa(s)`}>
                      <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>account_tree</span>
                      <span style={{ fontWeight: 600 }}>{subtasksCount}</span>
                    </span>

                    {showSubtasksTooltip && Object.keys(subtasksByStatus).length > 0 && (
                      <div style={{
                        position: 'absolute',
                        bottom: 'calc(100% + 8px)',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        background: '#1b1b1f',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        borderRadius: '6px',
                        padding: '8px 12px',
                        boxShadow: '0 4px 14px rgba(0, 0, 0, 0.4)',
                        zIndex: 200,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                        whiteSpace: 'nowrap',
                        pointerEvents: 'none'
                      }}>
                        {Object.entries(subtasksByStatus).map(([key, count]) => {
                          const [color, label] = key.split('_');
                          return (
                            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', fontWeight: 600 }}>
                              <span style={{
                                display: 'inline-block',
                                width: '8px',
                                height: '8px',
                                borderRadius: '2px',
                                background: color
                              }} />
                              <span style={{ color: '#ffffff', fontWeight: 700 }}>{count}</span>
                              <span style={{ color: 'var(--text-muted)' }}>{label}</span>
                            </div>
                          );
                        })}
                        <div style={{
                          position: 'absolute',
                          top: '100%',
                          left: '50%',
                          transform: 'translateX(-50%)',
                          width: '0',
                          height: '0',
                          borderLeft: '5px solid transparent',
                          borderRight: '5px solid transparent',
                          borderTop: '5px solid #1b1b1f'
                        }} />
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* INDICADOR DE CHECKLIST PROGRESSO CLICKUP-STYLE COM BOTÃO E TOOLTIP DEDICADO */}
              {(() => {
                try {
                  const stored = localStorage.getItem(`task_checklist_${task.id}`);
                  if (stored) {
                    const items = JSON.parse(stored);
                    if (Array.isArray(items) && items.length > 0) {
                      const total = items.length;
                      const checked = items.filter((item: any) => item.isChecked).length;
                      return (
                        <div
                          style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}
                          onMouseEnter={() => setShowChecklistTooltip(true)}
                          onMouseLeave={() => setShowChecklistTooltip(false)}
                        >
                          <span 
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px',
                              color: 'var(--text-muted)',
                              fontSize: '11px',
                              fontWeight: 600,
                              background: 'transparent',
                              border: '1px solid transparent',
                              borderRadius: '4px',
                              padding: '1px 5px',
                              cursor: 'pointer',
                              transition: 'all 0.15s ease'
                            }} 
                            onMouseOver={(e) => {
                              e.currentTarget.style.background = 'var(--surface-low)';
                              e.currentTarget.style.borderColor = 'var(--outline)';
                              e.currentTarget.style.color = 'var(--text-on-surface)';
                            }}
                            onMouseOut={(e) => {
                              e.currentTarget.style.background = 'transparent';
                              e.currentTarget.style.borderColor = 'transparent';
                              e.currentTarget.style.color = 'var(--text-muted)';
                            }}
                            title={`${checked} de ${total} itens do checklist concluídos`}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>playlist_add_check</span>
                            <span>{checked}/{total}</span>
                          </span>

                          {showChecklistTooltip && (
                            <div style={{
                              position: 'absolute',
                              bottom: 'calc(100% + 8px)',
                              left: '50%',
                              transform: 'translateX(-50%)',
                              background: '#1b1b1f',
                              border: '1px solid rgba(255, 255, 255, 0.08)',
                              borderRadius: '6px',
                              padding: '8px 12px',
                              boxShadow: '0 4px 14px rgba(0, 0, 0, 0.4)',
                              zIndex: 200,
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '6px',
                              whiteSpace: 'nowrap',
                              pointerEvents: 'none'
                            }}>
                              {items.map((item: any, idx: number) => (
                                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', fontWeight: 600 }}>
                                  <span 
                                    className="material-symbols-outlined" 
                                    style={{ 
                                      fontSize: '13px', 
                                      color: item.isChecked ? '#00c853' : '#7e7e88' 
                                    }}
                                  >
                                    {item.isChecked ? 'check_circle' : 'radio_button_unchecked'}
                                  </span>
                                  <span style={{ 
                                    color: '#ffffff', 
                                    textDecoration: item.isChecked ? 'line-through' : 'none',
                                    opacity: item.isChecked ? 0.6 : 1
                                  }}>
                                    {item.text || `Item ${idx + 1}`}
                                  </span>
                                </div>
                              ))}
                              <div style={{
                                position: 'absolute',
                                top: '100%',
                                left: '50%',
                                transform: 'translateX(-50%)',
                                width: '0',
                                height: '0',
                                borderLeft: '5px solid transparent',
                                borderRight: '5px solid transparent',
                                borderTop: '5px solid #1b1b1f'
                              }} />
                            </div>
                          )}
                        </div>
                      );
                    }
                  }
                } catch (e) {}
                return null;
              })()}

            </div>
          </div>


          {/* BOTÕES DE AÇÕES INLINE CLICKUP-STYLE */}
          {!isReadOnly && (
            <div className="task-actions-inline" style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              marginLeft: '10px',
              background: 'var(--surface-low)',
              borderRadius: 'var(--radius-sm)',
              padding: '1px 3px',
              border: '1px solid var(--outline)',
              boxShadow: 'var(--shadow-sm)'
            }}>
              {/* Botão + (Adicionar Subtarefa) */}
              {level < 6 && (
                <button
                  onClick={(e) => { e.stopPropagation(); onAddTask(task.id); }}
                  title="Adicionar Subtarefa"
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--primary)',
                    cursor: 'pointer',
                    padding: '2px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 'var(--radius-sm)'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.background = 'var(--primary-light)'}
                  onMouseOut={(e) => e.currentTarget.style.background = 'none'}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>add</span>
                </button>
              )}

              {/* Botão de Etiquetas / Tags */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  window.dispatchEvent(new CustomEvent('close-all-tag-popovers'));
                  const rect = e.currentTarget.getBoundingClientRect();
                  setTagDropdownRect(rect);
                  setShowTagDropdown(true);
                }}
                title="Editar Etiquetas / Tags"
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted-dark)',
                  cursor: 'pointer',
                  padding: '2px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 'var(--radius-sm)'
                }}
                onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'}
                onMouseOut={(e) => e.currentTarget.style.background = 'none'}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>sell</span>
              </button>

              {/* Botão de Editar / Renomear Nome da Tarefa */}
              <button
                onClick={(e) => { e.stopPropagation(); onEditTask(task); }}
                title="Renomear Tarefa"
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted-dark)',
                  cursor: 'pointer',
                  padding: '2px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 'var(--radius-sm)'
                }}
                onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'}
                onMouseOut={(e) => e.currentTarget.style.background = 'none'}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>edit</span>
              </button>
            </div>
          )}

        </div>
      </td>

      {columnOrder.map(key => {
        // 1. Column: progress
        if (key === 'progress' && visibleColumns.progress) {
          return (
            <td key="progress" style={{ padding: '4px 8px', width: columnWidths.progress, maxWidth: columnWidths.progress, overflow: 'hidden', boxSizing: 'border-box' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', width: '100%' }}>
                <div style={{
                  flex: 1,
                  background: 'rgba(16, 185, 129, 0.15)',
                  height: '3px',
                  borderRadius: '1.5px',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    width: `${progress}%`,
                    background: '#10b981',
                    height: '100%',
                    borderRadius: '1.5px'
                  }} />
                </div>
                <span style={{ fontSize: '10px', color: '#10b981', fontWeight: 700, minWidth: '28px', textAlign: 'right' }}>
                  {progress}%
                </span>
              </div>
            </td>
          );
        }

        // 2. Column: status
        if (key === 'status' && visibleColumns.status) {
          return (
            <td key="status" style={{ padding: '4px 8px', position: 'relative', width: columnWidths.status, maxWidth: columnWidths.status, overflow: 'visible', boxSizing: 'border-box', textAlign: 'left' }}>
              <div style={{ position: 'relative', display: 'inline-flex', justifyContent: 'flex-start', width: '100%' }}>
                <span
                  className="status-dropdown-trigger"
                  onClick={() => !isReadOnly && setStatusDropdownSource(statusDropdownSource === 'badge' ? null : 'badge')}
                  style={getStatusBadgeStyle(task.status)}
                  onMouseOver={(e) => {
                    if (!isReadOnly) e.currentTarget.style.opacity = '0.85';
                  }}
                  onMouseOut={(e) => {
                    if (!isReadOnly) e.currentTarget.style.opacity = '1';
                  }}
                >
                  {getCustomLabel()}
                </span>
                {statusDropdownSource === 'badge' && renderDropdownContent()}
              </div>
            </td>
          );
        }

        // 3. Column: startDate
        if (key === 'startDate' && visibleColumns.startDate) {
          return (
            <td 
              key="startDate"
              onClick={() => {
                if (!isReadOnly && !isEditingStartDate) {
                  setIsEditingStartDate(true);
                }
              }}
              style={{ 
                padding: '4px 8px', 
                fontSize: '11px', 
                color: 'var(--text-muted-dark)', 
                fontWeight: 500, 
                width: columnWidths.startDate, 
                maxWidth: columnWidths.startDate, 
                overflow: 'hidden', 
                textOverflow: 'ellipsis', 
                whiteSpace: 'nowrap', 
                boxSizing: 'border-box',
                cursor: isReadOnly ? 'default' : 'pointer'
              }}
            >
              {isEditingStartDate ? (
                <input
                  type="date"
                  value={tempStartDate}
                  onChange={(e) => setTempStartDate(e.target.value)}
                  onFocus={(e) => { try { e.target.select(); } catch(err) {} }}
                  onBlur={async () => {
                    setIsEditingStartDate(false);
                    if (tempStartDate !== task.start_date && onUpdateTaskField) {
                      await onUpdateTaskField(task.id, { start_date: tempStartDate });
                    }
                  }}
                  onKeyDown={async (e) => {
                    if (e.key === 'Enter') {
                      setIsEditingStartDate(false);
                      if (tempStartDate !== task.start_date && onUpdateTaskField) {
                        await onUpdateTaskField(task.id, { start_date: tempStartDate });
                      }
                    } else if (e.key === 'Escape') {
                      setIsEditingStartDate(false);
                      setTempStartDate(task.start_date || '');
                    }
                  }}
                  autoFocus
                  style={{
                    width: '100%',
                    background: 'var(--surface-low)',
                    border: '1px solid var(--primary)',
                    borderRadius: '4px',
                    color: 'var(--text-on-surface)',
                    fontSize: '11px',
                    padding: '2px',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              ) : (
                formatDate(task.start_date)
              )}
            </td>
          );
        }

        // 4. Column: endDate
        if (key === 'endDate' && visibleColumns.endDate) {
          return (
            <td 
              key="endDate"
              onClick={() => {
                if (!isReadOnly && !isEditingEndDate) {
                  setIsEditingEndDate(true);
                }
              }}
              style={{ 
                padding: '4px 8px', 
                fontSize: '11px', 
                color: 'var(--text-muted-dark)', 
                fontWeight: 500, 
                width: columnWidths.endDate, 
                maxWidth: columnWidths.endDate, 
                overflow: 'hidden', 
                textOverflow: 'ellipsis', 
                whiteSpace: 'nowrap', 
                boxSizing: 'border-box',
                cursor: isReadOnly ? 'default' : 'pointer'
              }}
            >
              {isEditingEndDate ? (
                <input
                  type="date"
                  value={tempEndDate}
                  onChange={(e) => setTempEndDate(e.target.value)}
                  onFocus={(e) => { try { e.target.select(); } catch(err) {} }}
                  onBlur={async () => {
                    setIsEditingEndDate(false);
                    if (tempEndDate !== task.end_date && onUpdateTaskField) {
                      await onUpdateTaskField(task.id, { end_date: tempEndDate });
                    }
                  }}
                  onKeyDown={async (e) => {
                    if (e.key === 'Enter') {
                      setIsEditingEndDate(false);
                      if (tempEndDate !== task.end_date && onUpdateTaskField) {
                        await onUpdateTaskField(task.id, { end_date: tempEndDate });
                      }
                    } else if (e.key === 'Escape') {
                      setIsEditingEndDate(false);
                      setTempEndDate(task.end_date || '');
                    }
                  }}
                  autoFocus
                  style={{
                    width: '100%',
                    background: 'var(--surface-low)',
                    border: '1px solid var(--primary)',
                    borderRadius: '4px',
                    color: 'var(--text-on-surface)',
                    fontSize: '11px',
                    padding: '2px',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              ) : (
                renderEndDate(task.end_date)
              )}
            </td>
          );
        }

        // 5. Column: financialValue
        if (key === 'financialValue' && visibleColumns.financialValue) {
          return (
            <td 
              key="financialValue"
              onClick={() => {
                if (!isReadOnly && !isEditingFinancial) {
                  const rawVal = task.contract_value || 0;
                  const formatted = new Intl.NumberFormat('pt-BR', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                  }).format(rawVal);
                  setTempFinancial(formatted);
                  setIsEditingFinancial(true);
                }
              }}
              style={{ 
                padding: '4px 16px 4px 8px', 
                fontSize: '11px', 
                color: 'var(--text-on-surface)', 
                fontWeight: 600, 
                textAlign: 'left', 
                width: columnWidths.financialValue, 
                maxWidth: columnWidths.financialValue, 
                overflow: 'hidden', 
                textOverflow: 'ellipsis', 
                whiteSpace: 'nowrap', 
                boxSizing: 'border-box',
                cursor: isReadOnly ? 'default' : 'pointer'
              }}
            >
              {isEditingFinancial ? (
                <input
                  type="text"
                  value={tempFinancial}
                  onChange={(e) => {
                    setTempFinancial(maskCurrency(e.target.value));
                  }}
                  onFocus={(e) => e.target.select()}
                  onBlur={async () => {
                    setIsEditingFinancial(false);
                    const clean = tempFinancial.replace(/\./g, '').replace(',', '.');
                    const parsed = parseFloat(clean) || 0;
                    if (parsed !== task.contract_value && onUpdateTaskField) {
                      await onUpdateTaskField(task.id, { contract_value: parsed });
                    }
                  }}
                  onKeyDown={async (e) => {
                    if (e.key === 'Enter') {
                      setIsEditingFinancial(false);
                      const clean = tempFinancial.replace(/\./g, '').replace(',', '.');
                      const parsed = parseFloat(clean) || 0;
                      if (parsed !== task.contract_value && onUpdateTaskField) {
                        await onUpdateTaskField(task.id, { contract_value: parsed });
                      }
                    } else if (e.key === 'Escape') {
                      setIsEditingFinancial(false);
                      const rawVal = task.contract_value || 0;
                      const formatted = new Intl.NumberFormat('pt-BR', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                      }).format(rawVal);
                      setTempFinancial(formatted);
                    }
                  }}
                  autoFocus
                  style={{
                    width: '100%',
                    background: 'var(--surface-low)',
                    border: '1px solid var(--primary)',
                    borderRadius: '4px',
                    color: 'var(--text-on-surface)',
                    fontSize: '11px',
                    padding: '2px',
                    textAlign: 'right',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              ) : (
                formatCurrency(task.contract_value)
              )}
            </td>
          );
        }

        // Column: priority
        if (key === 'priority' && visibleColumns.priority) {
          const currentPriority = task.priority || null;
          
          let flagColor = '#9ca3af'; // Default grey for Baixa/clear
          if (currentPriority === 'Urgente') flagColor = '#ef4444';
          else if (currentPriority === 'Alta') flagColor = '#fb923c';
          else if (currentPriority === 'Normal') flagColor = '#3b82f6';
          else if (currentPriority === 'Baixa') flagColor = '#9ca3af';

          return (
            <td 
              key="priority" 
              style={{ padding: '4px 8px', position: 'relative', width: columnWidths.priority || 110, maxWidth: columnWidths.priority || 110, overflow: 'visible', boxSizing: 'border-box', textAlign: 'left' }}
            >
              <div 
                ref={priorityDropdownRef}
                style={{ position: 'relative', display: 'inline-flex', justifyContent: 'flex-start', width: '100%' }}
              >
                <button
                  onClick={() => !isReadOnly && setShowPriorityDropdown(!showPriorityDropdown)}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: '4px 6px',
                    paddingLeft: '0px',
                    borderRadius: '4px',
                    cursor: isReadOnly ? 'default' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'flex-start',
                    gap: '6px',
                    color: currentPriority ? flagColor : 'var(--text-muted)',
                    opacity: currentPriority ? 1 : 0.7,
                    fontSize: '11px',
                    fontWeight: 500,
                    transition: 'background 0.2s',
                    minWidth: '24px'
                  }}
                  onMouseOver={(e) => {
                    if (!isReadOnly) e.currentTarget.style.background = 'var(--surface-low)';
                  }}
                  onMouseOut={(e) => {
                    if (!isReadOnly) e.currentTarget.style.background = 'none';
                  }}
                >
                  <span 
                    className="material-symbols-outlined" 
                    style={{ 
                      fontSize: '16px', 
                      color: currentPriority ? flagColor : 'var(--text-muted)',
                      fontVariationSettings: currentPriority ? "'FILL' 1" : "'FILL' 0",
                      marginLeft: '-3px'
                    }}
                  >
                    flag
                  </span>
                  {currentPriority && (
                    <span style={{ color: 'var(--text-on-surface)' }}>
                      {currentPriority}
                    </span>
                  )}
                </button>

                {showPriorityDropdown && (
                  <div style={{
                    position: 'absolute',
                    top: 'calc(100% + 4px)',
                    left: 0,
                    background: 'var(--surface)',
                    border: '1px solid var(--outline-variant)',
                    borderRadius: 'var(--radius-md)',
                    boxShadow: 'var(--shadow-lg)',
                    padding: '4px',
                    width: '140px',
                    zIndex: 9999,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2px'
                  }}>
                    {[
                      { val: 'Urgente' as const, label: 'Urgente', color: '#ef4444' },
                      { val: 'Alta' as const, label: 'Alta', color: '#fb923c' },
                      { val: 'Normal' as const, label: 'Normal', color: '#3b82f6' },
                      { val: 'Baixa' as const, label: 'Baixa', color: '#9ca3af' }
                    ].map(opt => (
                      <button
                        key={opt.val}
                        onClick={async () => {
                          setShowPriorityDropdown(false);
                          if (onUpdateTaskField) {
                            await onUpdateTaskField(task.id, { priority: opt.val });
                          }
                        }}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          borderRadius: 'var(--radius-sm)',
                          color: 'var(--text-on-surface)',
                          padding: '6px 8px',
                          fontSize: '11px',
                          fontWeight: 500,
                          textAlign: 'left',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          transition: 'background 0.2s'
                        }}
                        onMouseOver={(e) => e.currentTarget.style.background = 'var(--surface-low)'}
                        onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '15px', color: opt.color, fontVariationSettings: "'FILL' 1" }}>flag</span>
                        <span>{opt.label}</span>
                      </button>
                    ))}
                    <div style={{ height: '1px', background: 'var(--outline-variant)', margin: '4px 0' }} />
                    <button
                      onClick={async () => {
                        setShowPriorityDropdown(false);
                        if (onUpdateTaskField) {
                          await onUpdateTaskField(task.id, { priority: null });
                        }
                      }}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        borderRadius: 'var(--radius-sm)',
                        color: '#ef4444',
                        padding: '6px 8px',
                        fontSize: '11px',
                        fontWeight: 600,
                        textAlign: 'left',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        transition: 'background 0.2s'
                      }}
                      onMouseOver={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'}
                      onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '15px', color: '#ef4444' }}>block</span>
                      <span>Limpar</span>
                    </button>
                  </div>
                )}
              </div>
            </td>
          );
        }

        // 6. Custom field column
        const customField = customFields.find(f => f.key === key);
        if (customField) {
          const isShown = visibleCustomColumns[customField.key] !== false;
          if (!isShown) return null;
          const colWidth = columnWidths[customField.key] || 120;
          return (
            <td key={customField.key} style={{ padding: '2px 8px', width: colWidth, maxWidth: colWidth, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', boxSizing: 'border-box' }}>
              <CustomFieldCell
                taskId={task.id}
                field={customField}
                isReadOnly={isReadOnly}
              />
            </td>
          );
        }

        return null;
      })}

      {/* Célula correspondente à coluna de gerenciar campos (+) no cabeçalho */}
      <td
        onClick={(e) => {
          e.stopPropagation();
          const rect = e.currentTarget.getBoundingClientRect();
          setThreeDotsRect(rect);
          setShowThreeDotsMenu(true);
        }}
        style={{
          width: '40px',
          maxWidth: '40px',
          padding: '0 8px',
          textAlign: 'center',
          cursor: 'pointer',
          position: 'relative',
          boxSizing: 'border-box'
        }}
        onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.03)'}
        onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
      >
        <div className="row-three-dots" style={{
          display: showThreeDotsMenu ? 'flex' : undefined,
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          height: '100%'
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: '15px', color: 'var(--text-muted-dark)' }}>
            more_horiz
          </span>
        </div>
      </td>

      {/* Célula filler para absorver espaço restante no final ClickUp-Style */}
      <td style={{ background: 'transparent' }} />

      {/* DROPDOWN DE ETIQUETAS FLUTUANTE */}
      {showTagDropdown && tagDropdownRect && (() => {
        const menuWidth = 240;
        const menuHeight = 280; // Altura estimada do menu de etiquetas
        let left = tagDropdownRect.left;
        if (left + menuWidth > window.innerWidth) {
          left = Math.max(16, tagDropdownRect.right - menuWidth);
        }
        let top = tagDropdownRect.bottom + 6;
        if (top + menuHeight > window.innerHeight) {
          top = Math.max(16, tagDropdownRect.top - menuHeight - 6);
        }

        const globalTags = getGlobalTags();
        const activeTags: string[] = (task as any).tags || [];
        const filteredTags = globalTags.filter(t => 
          t.name.toLowerCase().includes(tagSearchQuery.toLowerCase())
        );

        return (
          <td style={{ position: 'absolute', width: 0, height: 0, padding: 0, border: 'none' }}>
            <div 
              style={{
                position: 'fixed',
                top: `${top}px`,
                left: `${left}px`,
                zIndex: 999999,
                background: 'var(--surface)',
                border: '1px solid var(--outline-variant)',
                borderRadius: '12px',
                boxShadow: 'var(--shadow-lg)',
                width: '240px',
                padding: '10px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                fontFamily: 'system-ui, -apple-system, sans-serif',
                color: 'var(--text-on-surface)',
                textAlign: 'left'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Pesquise ou adicione tags... */}
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <input
                  type="text"
                  value={tagSearchQuery}
                  onChange={(e) => setTagSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const query = tagSearchQuery.trim();
                      if (query !== '') {
                        const existing = globalTags.find(t => t.name.toLowerCase() === query.toLowerCase());
                        if (existing) {
                          handleToggleTaskTag(existing.id);
                          setTagSearchQuery('');
                        } else {
                          handleCreateNewGlobalTag(query);
                          setTagSearchQuery('');
                        }
                      }
                    }
                  }}
                  placeholder="Pesquise ou adicione tags..."
                  autoFocus
                  style={{
                    width: '100%',
                    background: 'var(--surface-variant, rgba(0, 0, 0, 0.03))',
                    border: '1px solid var(--outline-variant)',
                    borderRadius: '8px',
                    padding: '6px 8px',
                    fontSize: '11px',
                    color: 'var(--text-on-surface)',
                    outline: 'none'
                  }}
                />
              </div>

              {/* Lista de tags selecionadas da tarefa (com X para remover) */}
              {activeTags.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', borderBottom: '1px solid var(--outline-variant)', paddingBottom: '8px' }}>
                  {activeTags.map(tagId => {
                    const tagObj = globalTags.find(t => t.id === tagId);
                    if (!tagObj) return null;
                    return (
                      <span key={tagId} style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        background: tagObj.color || '#4f46e5',
                        color: '#ffffff',
                        fontSize: '9px',
                        fontWeight: 600,
                        padding: '2px 6px',
                        borderRadius: '12px'
                      }}>
                        <span>{tagObj.name}</span>
                        <span 
                          onClick={() => handleToggleTaskTag(tagId)}
                          style={{ cursor: 'pointer', fontSize: '9px', fontWeight: 'bold' }}
                        >✕</span>
                      </span>
                    );
                  })}
                </div>
              )}

              {/* Selecione uma opção */}
              <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)', marginTop: '2px' }}>
                Selecione uma opção
              </div>

              {/* Lista de Tags Globais existentes */}
              <div style={{
                maxHeight: '140px',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px'
              }}>
                {filteredTags.length > 0 ? (
                  filteredTags.map(tagObj => {
                    const isActive = activeTags.includes(tagObj.id);
                    return (
                      <div 
                        key={tagObj.id}
                        onClick={() => handleToggleTaskTag(tagObj.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '6px 8px',
                          borderRadius: '6px',
                          background: isActive ? 'rgba(95, 85, 236, 0.1)' : 'transparent',
                          cursor: 'pointer',
                          transition: 'background 0.2s'
                        }}
                        onMouseOver={(e) => e.currentTarget.style.background = 'var(--surface-variant, rgba(0, 0, 0, 0.05))'}
                        onMouseOut={(e) => e.currentTarget.style.background = isActive ? 'rgba(95, 85, 236, 0.1)' : 'transparent'}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            background: tagObj.color
                          }} />
                          <span style={{
                            fontSize: '11px',
                            fontWeight: isActive ? 600 : 400,
                            color: isActive ? '#5f55ec' : 'var(--text-on-surface)'
                          }}>{tagObj.name}</span>
                        </div>
                        {/* Botão de Configurações e Excluir Permanente */}
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                          <span 
                            title="Editar Etiqueta"
                            onClick={(e) => {
                              e.stopPropagation();
                              window.dispatchEvent(new CustomEvent('close-all-tag-popovers'));
                              const rect = e.currentTarget.getBoundingClientRect();
                              setEditingTagRect(rect);
                              setEditingTagObj(tagObj);
                            }}
                            className="material-symbols-outlined"
                            style={{ fontSize: '13px', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px' }}
                            onMouseOver={(e) => e.currentTarget.style.color = '#5f55ec'}
                            onMouseOut={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
                          >
                            settings
                          </span>
                          <span 
                            title="Excluir Permanentemente"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteGlobalTagPermanently(tagObj.id);
                            }}
                            className="material-symbols-outlined"
                            style={{ fontSize: '12px', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px' }}
                            onMouseOver={(e) => e.currentTarget.style.color = '#ef4444'}
                            onMouseOut={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
                          >
                            delete
                          </span>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  tagSearchQuery.trim() === '' && (
                    <div style={{ fontStyle: 'italic', fontSize: '10px', color: 'var(--text-muted)', padding: '4px 8px' }}>
                      Nenhuma etiqueta criada
                    </div>
                  )
                )}

                {/* Opção para CRIAR a etiqueta pesquisada se não existir */}
                {tagSearchQuery.trim() !== '' && !globalTags.some(t => t.name.toLowerCase() === tagSearchQuery.trim().toLowerCase()) && (
                  <div 
                    onClick={() => handleCreateNewGlobalTag(tagSearchQuery.trim())}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '6px 8px',
                      borderRadius: '6px',
                      background: 'rgba(95, 85, 236, 0.15)',
                      border: '1px dashed #5f55ec',
                      cursor: 'pointer'
                    }}
                  >
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Criar</span>
                    <span style={{
                      background: '#5f55ec',
                      color: '#ffffff',
                      fontSize: '9px',
                      fontWeight: 600,
                      padding: '2px 6px',
                      borderRadius: '10px'
                    }}>{tagSearchQuery.trim()}</span>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>⏎</span>
                  </div>
                )}
              </div>
            </div>
          </td>
        );
      })()}

      {/* DROPDOWN DE EDICAO DE ETIQUETA SECUNDARIO (IMAGEM 2) */}
      {editingTagObj && editingTagRect && (() => {
        const menuWidth = 220;
        const menuHeight = 240;
        let left = editingTagRect.right + 8;
        if (left + menuWidth > window.innerWidth) {
          left = Math.max(16, editingTagRect.left - menuWidth - 8);
        }
        let top = editingTagRect.top;
        if (top + menuHeight > window.innerHeight) {
          top = Math.max(16, window.innerHeight - menuHeight - 16);
        }

        const colorsRow1 = ['#5f55ec', '#1a5fb4', '#0080ff', '#10b981', '#2ec27e', '#f59e0b', '#a2703f'];
        const colorsRow2 = ['#c01c28', '#db2777', '#613583', '#c061cb', '#3d3d3d', '#7e7e88', 'transparent'];

        const handleColorSelect = (newColor: string) => {
          const currentGlobal = getGlobalTags();
          const updated = currentGlobal.map(t => t.id === editingTagObj.id ? { ...t, color: newColor } : t);
          saveGlobalTags(updated);
          setEditingTagObj({ ...editingTagObj, color: newColor });
          const currentTags = (task as any).tags || [];
          onUpdateTaskField?.(task.id, { tags: [...currentTags] } as any);
        };

        const handleRename = (newName: string) => {
          const currentGlobal = getGlobalTags();
          const updated = currentGlobal.map(t => t.id === editingTagObj.id ? { ...t, name: newName } : t);
          saveGlobalTags(updated);
          setEditingTagObj({ ...editingTagObj, name: newName });
          const currentTags = (task as any).tags || [];
          onUpdateTaskField?.(task.id, { tags: [...currentTags] } as any);
        };

        return (
          <td style={{ position: 'absolute', width: 0, height: 0, padding: 0, border: 'none' }}>
            <div 
              style={{
                position: 'fixed',
                top: `${top}px`,
                left: `${left}px`,
                zIndex: 9999999,
                background: 'var(--surface)',
                border: '1px solid var(--outline-variant)',
                borderRadius: '12px',
                boxShadow: 'var(--shadow-lg)',
                width: '220px',
                padding: '12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                fontFamily: 'system-ui, -apple-system, sans-serif',
                color: 'var(--text-on-surface)',
                textAlign: 'left'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Nome da Etiqueta Input */}
              <input
                type="text"
                value={editingTagObj.name}
                onChange={(e) => handleRename(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    e.currentTarget.blur();
                    setEditingTagObj(null);
                  }
                }}
                placeholder="Nome da etiqueta..."
                style={{
                  width: '100%',
                  background: 'var(--surface-variant, rgba(0, 0, 0, 0.03))',
                  border: '1px solid var(--outline-variant)',
                  borderRadius: '6px',
                  padding: '5px 8px',
                  fontSize: '11px',
                  color: 'var(--text-on-surface)',
                  outline: 'none',
                  fontWeight: 600
                }}
              />

              {/* Grid de Cores (Linha 1) */}
              <div style={{ display: 'flex', flexWrap: 'nowrap', gap: '5px', justifyContent: 'space-between' }}>
                {colorsRow1.map(c => {
                  const isSelected = editingTagObj.color === c;
                  return (
                    <span
                      key={c}
                      onClick={() => handleColorSelect(c)}
                      style={{
                        width: '18px',
                        height: '18px',
                        borderRadius: '50%',
                        background: c,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: isSelected ? '1.5px solid var(--text-on-surface)' : '1px solid transparent',
                        boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.2)',
                        transition: 'transform 0.15s'
                      }}
                      onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.15)'}
                      onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
                    />
                  );
                })}
              </div>

              {/* Grid de Cores (Linha 2 + Diagonal Sem Cor) */}
              <div style={{ display: 'flex', flexWrap: 'nowrap', gap: '5px', justifyContent: 'space-between', alignItems: 'center' }}>
                {colorsRow2.map((c, idx) => {
                  const isNoColor = c === 'transparent';
                  const isSelected = isNoColor ? (!editingTagObj.color || editingTagObj.color === '') : (editingTagObj.color === c);
                  
                  return (
                    <span
                      key={idx}
                      onClick={() => handleColorSelect(isNoColor ? '' : c)}
                      style={{
                        width: '18px',
                        height: '18px',
                        borderRadius: '50%',
                        background: isNoColor ? 'transparent' : c,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: isSelected 
                          ? '1.5px solid var(--text-on-surface)' 
                          : (isNoColor ? '1px dashed var(--outline-variant)' : '1px solid transparent'),
                        boxShadow: isNoColor ? 'none' : 'inset 0 1px 3px rgba(0,0,0,0.2)',
                        transition: 'transform 0.15s',
                        position: 'relative'
                      }}
                      onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.15)'}
                      onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
                    >
                      {isNoColor && (
                        <svg width="100%" height="100%" viewBox="0 0 18 18" style={{ position: 'absolute', top: 0, left: 0 }}>
                          <line x1="2" y1="16" x2="16" y2="2" stroke="var(--text-muted)" strokeWidth="1.5" />
                        </svg>
                      )}
                    </span>
                  );
                })}
              </div>

              {/* Botão + Plus extra */}
              <div style={{ display: 'flex', alignItems: 'center', marginTop: '-2px' }}>
                <span 
                  className="material-symbols-outlined" 
                  style={{ fontSize: '14px', color: 'var(--text-muted)', cursor: 'default' }}
                >
                  add
                </span>
              </div>

              <span style={{ height: '1px', background: 'var(--outline-variant)', margin: '2px 0' }} />

              {/* Ações */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {/* Filtrar por Etiqueta */}
                <button
                  onClick={() => {
                    onFilterByTag?.(editingTagObj.id);
                    setEditingTagObj(null);
                    setShowTagDropdown(false);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    width: '100%',
                    background: 'transparent',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '6px 8px',
                    fontSize: '11px',
                    color: 'var(--text-on-surface)',
                    textAlign: 'left',
                    cursor: 'pointer',
                    transition: 'background 0.2s'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.background = 'var(--surface-variant, rgba(0, 0, 0, 0.05))'}
                  onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '14px', color: 'var(--text-muted)' }}>filter_alt</span>
                  <span>Filtrar por Etiqueta</span>
                </button>

                {/* Excluir Permanente */}
                <button
                  onClick={() => {
                    handleDeleteGlobalTagPermanently(editingTagObj.id);
                    setEditingTagObj(null);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    width: '100%',
                    background: 'transparent',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '6px 8px',
                    fontSize: '11px',
                    color: '#ef4444',
                    textAlign: 'left',
                    cursor: 'pointer',
                    transition: 'background 0.2s'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'}
                  onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '14px', color: '#ef4444' }}>delete</span>
                  <span>Excluir</span>
                </button>
              </div>
            </div>
          </td>
        );
      })()}

      {/* MENU DE TRÊS PONTINHOS FLUTUANTE */}
      {showThreeDotsMenu && threeDotsRect && (() => {
        const menuWidth = 240;
        const menuHeight = 320; // Altura estimada do menu de ações
        let left = threeDotsRect.left;
        if (left + menuWidth > window.innerWidth) {
          left = Math.max(16, threeDotsRect.right - menuWidth);
        }
        let top = threeDotsRect.bottom + 6;
        if (top + menuHeight > window.innerHeight) {
          top = Math.max(16, threeDotsRect.top - menuHeight - 6);
        }

        return (
          <td style={{ position: 'absolute', width: 0, height: 0, padding: 0, border: 'none' }}>
            <div style={{
              position: 'fixed',
              top: `${top}px`,
              left: `${left}px`,
              zIndex: 999999,
              background: '#1e1f21',
              border: '1px solid #2d2e30',
              borderRadius: '12px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
              width: '190px',
              padding: '8px',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
              fontFamily: 'system-ui, -apple-system, sans-serif',
              color: '#f4f4f5',
              textAlign: 'left'
            }}
            onClick={(e) => e.stopPropagation()}
            >
            {/* Menu Items */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', paddingTop: '4px' }}>

              {/* Ver tarefa pai — só aparece quando é subtarefa */}
              {task.parent_id && (() => {
                const parentTask = allTasks.find(t => t.id === task.parent_id);
                if (!parentTask) return null;
                return (
                  <div
                    onClick={() => { onEditTask(parentTask); setShowThreeDotsMenu(false); }}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', borderRadius: '6px', cursor: 'pointer', fontSize: '11px' }}
                    onMouseOver={(e) => e.currentTarget.style.background = '#2d2e30'}
                    onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '14px', color: '#a1a1aa' }}>arrow_upward</span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                      <span style={{ fontWeight: 600 }}>Ver tarefa pai</span>
                      <span style={{ fontSize: '10px', color: '#71717a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '130px' }}>{parentTask.description}</span>
                    </div>
                  </div>
                );
              })()}

              {/* Renomear */}
              <div
                onClick={() => {
                  onEditTask(task);
                  setShowThreeDotsMenu(false);
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', borderRadius: '6px',
                  cursor: 'pointer', fontSize: '11px'
                }}
                onMouseOver={(e) => e.currentTarget.style.background = '#2d2e30'}
                onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '14px', color: '#a1a1aa' }}>edit</span>
                <span>Renomear</span>
              </div>

              {/* Duplicar */}
              <div 
                onClick={async () => {
                  await handleDuplicateTask();
                  setShowThreeDotsMenu(false);
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', borderRadius: '6px',
                  cursor: 'pointer', fontSize: '11px'
                }}
                onMouseOver={(e) => e.currentTarget.style.background = '#2d2e30'}
                onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '14px', color: '#a1a1aa' }}>content_copy</span>
                <span>Duplicar</span>
              </div>

              {/* Temporizador */}
              <div 
                onClick={() => {
                  const isRunning = localStorage.getItem(`task_time_running_${task.id}`) === 'true';
                  localStorage.setItem(`task_time_running_${task.id}`, isRunning ? 'false' : 'true');
                  window.dispatchEvent(new Event('refreshTasks'));
                  setShowThreeDotsMenu(false);
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', borderRadius: '6px',
                  cursor: 'pointer', fontSize: '11px'
                }}
                onMouseOver={(e) => e.currentTarget.style.background = '#2d2e30'}
                onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '14px', color: '#a1a1aa' }}>schedule</span>
                <span>{localStorage.getItem(`task_time_running_${task.id}`) === 'true' ? 'Parar temporizador' : 'Iniciar temporizador'}</span>
              </div>

              {/* Excluir */}
              <div 
                onClick={() => {
                  onDeleteTask(task.id);
                  setShowThreeDotsMenu(false);
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', borderRadius: '6px',
                  cursor: 'pointer', fontSize: '11px', color: '#ef4444'
                }}
                onMouseOver={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'}
                onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '14px', color: '#ef4444' }}>delete</span>
                <span>Excluir</span>
              </div>
            </div>

            {/* Compartilhar */}
            <button 
              onClick={() => {
                if (onShareClient) {
                  onShareClient(task.client_name);
                }
                setShowThreeDotsMenu(false);
              }}
              style={{
                marginTop: '6px', background: '#5f55ec', border: 'none', borderRadius: '6px', color: '#ffffff',
                fontSize: '11px', padding: '8px', cursor: 'pointer', fontWeight: 600, width: '100%'
              }}
              onMouseOver={(e) => e.currentTarget.style.background = '#4f45dc'}
              onMouseOut={(e) => e.currentTarget.style.background = '#5f55ec'}
            >
              Compartilhar
            </button>
          </div>
        </td>
      );
    })()}
    </tr>
  );
};

// COMPONENTE DE CÉLULA DINÂMICA DE CAMPO PERSONALIZADO
interface CustomFieldCellProps {
  taskId: string;
  field: CustomField;
  isReadOnly: boolean;
}

const CustomFieldCell: React.FC<CustomFieldCellProps> = ({ taskId, field, isReadOnly }) => {
  const storageKey = `task_custom_val_${taskId}_${field.key}`;

  // Lê do cache local, se não existir, usa o defaultValue configurado na criação do campo!
  const [value, setValue] = useState(() => {
    const stored = localStorage.getItem(storageKey);
    if (stored !== null) return stored;
    return field.defaultValue || '';
  });

  useEffect(() => {
    const stored = localStorage.getItem(storageKey);
    const expected = stored !== null ? stored : (field.defaultValue || '');
    if (expected !== value) {
      setValue(expected);
    }
  }, [taskId, field.key, field.defaultValue]);

  const handleBlur = () => {
    localStorage.setItem(storageKey, value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur();
    }
  };

  // Função de formatação brasileira de telefone em tempo real
  const maskPhone = (val: string) => {
    let raw = val.replace(/\D/g, '');
    if (raw.length > 11) raw = raw.slice(0, 11);

    if (raw.length > 10) {
      // Formato celular: (11) 99999-9999
      return `(${raw.slice(0, 2)}) ${raw.slice(2, 7)}-${raw.slice(7)}`;
    } else if (raw.length > 5) {
      // Formato fixo: (11) 9999-9999
      return `(${raw.slice(0, 2)}) ${raw.slice(2, 6)}-${raw.slice(6)}`;
    } else if (raw.length > 2) {
      return `(${raw.slice(0, 2)}) ${raw.slice(2)}`;
    } else if (raw.length > 0) {
      return `(${raw}`;
    }
    return raw;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value;
    if (field.type === 'phone') {
      val = maskPhone(val);
    }
    setValue(val);
  };

  // RENDERIZADOR DO MODO CHECKBOX
  if (field.type === 'checkbox') {
    const isChecked = value === 'true';
    const handleCheckboxToggle = () => {
      if (isReadOnly) return;
      const nextVal = !isChecked ? 'true' : 'false';
      setValue(nextVal);
      localStorage.setItem(storageKey, nextVal);
    };

    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '24px' }}>
        <button
          onClick={handleCheckboxToggle}
          disabled={isReadOnly}
          style={{
            background: isChecked ? 'var(--primary)' : 'transparent',
            border: isChecked ? 'none' : '1px solid var(--outline-variant)',
            borderRadius: '4px',
            width: '16px',
            height: '16px',
            cursor: isReadOnly ? 'default' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'background 0.2s, border 0.2s',
            padding: 0
          }}
        >
          {isChecked && (
            <span className="material-symbols-outlined" style={{ fontSize: '12px', color: '#ffffff', fontWeight: 'bold' }}>
              check
            </span>
          )}
        </button>
      </div>
    );
  }

  // RENDERIZADOR DO MODO RATING (ESTRELAS)
  if (field.type === 'rating') {
    const score = parseInt(value, 10) || 0;
    const [hoverScore, setHoverScore] = useState<number | null>(null);

    const handleRate = (num: number) => {
      if (isReadOnly) return;
      const nextScore = score === num ? 0 : num; // Clique duplo zera a avaliação
      setValue(String(nextScore));
      localStorage.setItem(storageKey, String(nextScore));
    };

    return (
      <div
        style={{ display: 'flex', alignItems: 'center', gap: '2px', cursor: isReadOnly ? 'default' : 'pointer', height: '24px' }}
        onMouseLeave={() => setHoverScore(null)}
      >
        {[1, 2, 3, 4, 5].map((star) => {
          const active = hoverScore !== null ? star <= hoverScore : star <= score;
          return (
            <span
              key={star}
              className="material-symbols-outlined"
              onClick={() => handleRate(star)}
              onMouseEnter={() => !isReadOnly && setHoverScore(star)}
              style={{
                fontSize: '15px',
                color: active ? '#FFD700' : 'rgba(126, 126, 136, 0.3)',
                transition: 'color 0.15s, transform 0.1s',
                transform: hoverScore === star ? 'scale(1.2)' : 'scale(1)'
              }}
            >
              star
            </span>
          );
        })}
      </div>
    );
  }

  // RENDERIZADOR DO MODO DROPDOWN (MENU SUSPENSO)
  if (field.type === 'dropdown') {
    const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const val = e.target.value;
      setValue(val);
      localStorage.setItem(storageKey, val);
    };

    if (isReadOnly) {
      return (
        <div style={{
          padding: '4px 8px',
          fontSize: '12px',
          color: 'var(--text-on-surface)',
          textAlign: 'left',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}>
          {value || '-'}
        </div>
      );
    }

    return (
      <div 
        style={{ 
          position: 'relative', 
          display: 'flex', 
          alignItems: 'center', 
          width: '100%', 
          height: '24px', 
          cursor: 'pointer',
          boxSizing: 'border-box'
        }}
      >
        {/* Camada visual de texto perfeitamente alinhada e com reticências (...) */}
        {field.key === 'cliente_ecosystem' && value && (field.optionColors?.[value] || field.bgColor) ? (
          <div style={{ display: 'inline-flex', alignItems: 'center', padding: '1px 8px', borderRadius: 4, background: field.optionColors?.[value] || field.bgColor, fontSize: '11px', fontWeight: 600, color: '#fff', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', pointerEvents: 'none' }}>
            {value}
          </div>
        ) : (
          <div
            style={{
              width: '100%',
              padding: '0px',
              fontSize: '12px',
              color: 'var(--text-on-surface)',
              textAlign: 'left',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
              boxSizing: 'border-box'
            }}
          >
            {value || '-'}
          </div>
        )}

        {/* Select invisível posicionado de forma absoluta por cima */}
        <select
          value={value}
          onChange={handleSelectChange}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            opacity: 0,
            cursor: 'pointer',
            background: 'transparent',
            border: 'none',
            outline: 'none',
            padding: 0,
            margin: 0
          }}
        >
          <option value="" style={{ background: 'var(--surface-container)', color: 'var(--text-muted)' }}>Selecionar...</option>
          {(field.options || []).map(opt => (
            <option key={opt} value={opt} style={{ background: 'var(--surface-container)', color: 'var(--text-on-surface)' }}>
              {opt}
            </option>
          ))}
        </select>
      </div>
    );
  }

  // COMPORTAMENTO NO MODO DE VISUALIZAÇÃO EXTERNA (READ ONLY)
  if (isReadOnly) {
    let displayValue = value;
    if (field.type === 'currency' && value) {
      const rawNum = parseFloat(value.replace(/[^0-9.-]/g, '')) || 0;
      displayValue = new Intl.NumberFormat('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(rawNum);
    }
    return (
      <div style={{
        padding: '4px 8px',
        fontSize: '12px',
        color: 'var(--text-on-surface)',
        textAlign: 'left',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap'
      }}>
        {displayValue || '-'}
      </div>
    );
  }

  // RENDERIZADOR DEDICADO PARA CAMPO DE MOEDA (CURRENCY)
  if (field.type === 'currency') {
    const formattedVal = maskCurrency(value);
    return (
      <div style={{ display: 'flex', alignItems: 'center', width: '100%', height: '24px' }}>
        <input
          type="text"
          placeholder="0,00"
          value={formattedVal}
          onChange={(e) => setValue(maskCurrency(e.target.value))}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          onFocus={(e) => { try { e.target.select(); } catch(err) {} }}
          style={{
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: 'var(--text-on-surface)',
            fontSize: '12px',
            width: '100%',
            padding: '4px 6px',
            borderRadius: 'var(--radius-sm)',
            textAlign: 'left',
            boxSizing: 'border-box'
          }}
        />
      </div>
    );
  }

  // RENDERIZADOR PADRÃO (INPUT TEXT/DATE/EMAIL/PHONE)
  const inputStyle: React.CSSProperties = {
    background: 'transparent',
    border: 'none',
    outline: 'none',
    color: 'var(--text-on-surface)',
    fontSize: '12px',
    width: '100%',
    padding: '4px 6px',
    borderRadius: 'var(--radius-sm)',
    textAlign: 'left'
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', width: '100%', padding: '0 4px', height: '24px' }}>
      <input
        type={field.type === 'date' ? 'date' : (field.type === 'email' ? 'email' : 'text')}
        value={value}
        onChange={handleChange}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        onFocus={(e) => { try { e.target.select(); } catch(err) {} }}
        placeholder={field.type === 'phone' ? '(00) 00000-0000' : '...'}
        style={inputStyle}
      />
    </div>
  );
};

// COMPONENTE DE PÍLULA DE ETIQUETA COM SELETORES E TOOLTIPS PREMIUM
const TagPill: React.FC<{
  tag: { id: string; name: string; color: string };
  onFilter: () => void;
  onRemove: () => void;
  onColorChange?: (tagId: string, newColor: string) => void;
  onDeletePermanently?: () => void;
}> = ({ tag, onFilter, onRemove, onColorChange, onDeletePermanently }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [showFilterTooltip, setShowFilterTooltip] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [menuRect, setMenuRect] = useState<DOMRect | null>(null);

  // Auto-fechar o menu ao clicar fora
  useEffect(() => {
    if (!showMenu) return;
    const handleOutsideClick = () => {
      setShowMenu(false);
    };
    const timeout = setTimeout(() => {
      document.addEventListener('click', handleOutsideClick);
    }, 10);
    return () => {
      clearTimeout(timeout);
      document.removeEventListener('click', handleOutsideClick);
    };
  }, [showMenu]);

  // Ouvir fechamento global
  useEffect(() => {
    const handleCloseAll = () => {
      setShowMenu(false);
    };
    window.addEventListener('close-all-tag-popovers', handleCloseAll);
    return () => {
      window.removeEventListener('close-all-tag-popovers', handleCloseAll);
    };
  }, []);

  const handlePillClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextShow = !showMenu;
    if (nextShow) {
      window.dispatchEvent(new CustomEvent('close-all-tag-popovers'));
    }
    const rect = e.currentTarget.getBoundingClientRect();
    setMenuRect(rect);
    setShowMenu(nextShow);
  };

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setShowFilterTooltip(false);
      }}
      onClick={handlePillClick}
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        background: tag.color || '#4f46e5',
        color: '#ffffff',
        fontSize: '10px',
        fontWeight: 600,
        padding: '2px 8px',
        borderRadius: '12px',
        transition: 'all 0.15s ease',
        cursor: 'pointer',
        userSelect: 'none',
        height: '18px',
        boxSizing: 'border-box'
      }}
    >
      <span>{tag.name}</span>
      
      {isHovered && (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', marginLeft: '2px' }}>
          {/* Ícone de Funil para filtrar */}
          <div 
            style={{ position: 'relative', display: 'flex', alignItems: 'center' }}
            onMouseEnter={() => setShowFilterTooltip(true)}
            onMouseLeave={() => setShowFilterTooltip(false)}
          >
            <span
              onClick={(e) => {
                e.stopPropagation();
                onFilter();
              }}
              className="material-symbols-outlined"
              style={{
                fontSize: '11px',
                color: '#ffffff',
                cursor: 'pointer',
                opacity: 0.8,
                transition: 'opacity 0.15s'
              }}
              onMouseOver={(e) => e.currentTarget.style.opacity = '1'}
              onMouseOut={(e) => e.currentTarget.style.opacity = '0.8'}
            >
              filter_alt
            </span>

            {showFilterTooltip && (
              <div style={{
                position: 'absolute',
                bottom: 'calc(100% + 8px)',
                left: '50%',
                transform: 'translateX(-50%)',
                background: '#1b1b1f',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '6px',
                padding: '4px 8px',
                boxShadow: '0 4px 14px rgba(0, 0, 0, 0.4)',
                zIndex: 200,
                fontSize: '9px',
                color: '#ffffff',
                whiteSpace: 'nowrap',
                pointerEvents: 'none'
              }}>
                Filtrar por Etiqueta
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: '0',
                  height: '0',
                  borderLeft: '4px solid transparent',
                  borderRight: '4px solid transparent',
                  borderTop: '4px solid #1b1b1f'
                }} />
              </div>
            )}
          </div>

          {/* Ícone X para fechar / desvincular */}
          <span
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            style={{
              fontSize: '9px',
              color: '#ffffff',
              cursor: 'pointer',
              opacity: 0.8,
              fontWeight: 'bold',
              transition: 'opacity 0.15s'
            }}
            onMouseOver={(e) => e.currentTarget.style.opacity = '1'}
            onMouseOut={(e) => e.currentTarget.style.opacity = '0.8'}
          >
            ✕
          </span>
        </div>
      )}

      {/* DROPDOWN DE OPÇÕES E CORES DA ETIQUETA */}
      {showMenu && menuRect && (() => {
        const menuWidth = 180;
        const menuHeight = 200;
        let left = menuRect.left;
        if (left + menuWidth > window.innerWidth) {
          left = Math.max(16, menuRect.right - menuWidth);
        }
        let top = menuRect.bottom + 6;
        if (top + menuHeight > window.innerHeight) {
          top = Math.max(16, menuRect.top - menuHeight - 6);
        }

        const colors = ['#5f55ec', '#0080ff', '#db2777', '#10b981', '#fb923c', '#f59e0b', '#7e7e88'];

        return (
          <span style={{ position: 'absolute', width: 0, height: 0, padding: 0, border: 'none' }} onClick={(e) => e.stopPropagation()}>
            <span
              style={{
                position: 'fixed',
                top: `${top}px`,
                left: `${left}px`,
                zIndex: 9999999,
                background: 'var(--surface)',
                border: '1px solid var(--outline-variant)',
                borderRadius: '12px',
                boxShadow: 'var(--shadow-lg)',
                width: '180px',
                padding: '10px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                fontFamily: 'system-ui, -apple-system, sans-serif',
                color: 'var(--text-on-surface)',
                textAlign: 'left'
              }}
            >
              {/* Alterar cor */}
              <span style={{ fontSize: '9px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Alterar cor
              </span>

              {/* Grid de cores */}
              <span style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px', padding: '2px 0' }}>
                {colors.map(c => {
                  const isSelected = tag.color === c;
                  return (
                    <span
                      key={c}
                      onClick={() => {
                        onColorChange?.(tag.id, c);
                        setShowMenu(false);
                      }}
                      style={{
                        width: '20px',
                        height: '20px',
                        borderRadius: '50%',
                        background: c,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: isSelected ? '1.5px solid #ffffff' : '1px solid transparent',
                        boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.2)',
                        transition: 'transform 0.15s'
                      }}
                      onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.15)'}
                      onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
                    >
                      {isSelected && (
                        <span className="material-symbols-outlined" style={{ fontSize: '11px', color: '#ffffff', fontWeight: 'bold' }}>
                          check
                        </span>
                      )}
                    </span>
                  );
                })}
              </span>

              <span style={{ height: '1px', background: 'var(--outline-variant)', margin: '2px 0' }} />

              {/* Ações */}
              <span style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {/* Filtrar por etiqueta */}
                <button
                  onClick={() => {
                    onFilter();
                    setShowMenu(false);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    width: '100%',
                    background: 'transparent',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '6px 8px',
                    fontSize: '11px',
                    color: 'var(--text-on-surface)',
                    textAlign: 'left',
                    cursor: 'pointer',
                    transition: 'background 0.2s',
                    paddingLeft: '8px'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.background = 'var(--surface-variant, rgba(0, 0, 0, 0.05))'}
                  onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '13px', color: 'var(--text-muted)' }}>filter_alt</span>
                  <span>Filtrar por etiqueta</span>
                </button>

                {/* Remover desta tarefa */}
                <button
                  onClick={() => {
                    onRemove();
                    setShowMenu(false);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    width: '100%',
                    background: 'transparent',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '6px 8px',
                    fontSize: '11px',
                    color: 'var(--text-on-surface)',
                    textAlign: 'left',
                    cursor: 'pointer',
                    transition: 'background 0.2s',
                    paddingLeft: '8px'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.background = 'var(--surface-variant, rgba(0, 0, 0, 0.05))'}
                  onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '13px', color: 'var(--text-muted)' }}>close</span>
                  <span>Remover da tarefa</span>
                </button>

                {/* Excluir permanentemente */}
                <button
                  onClick={() => {
                    onDeletePermanently?.();
                    setShowMenu(false);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    width: '100%',
                    background: 'transparent',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '6px 8px',
                    fontSize: '11px',
                    color: '#ef4444',
                    textAlign: 'left',
                    cursor: 'pointer',
                    transition: 'background 0.2s',
                    paddingLeft: '8px'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'}
                  onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '13px', color: '#ef4444' }}>delete</span>
                  <span>Excluir</span>
                </button>
              </span>
            </span>
          </span>
        );
      })()}
    </div>
  );
};
