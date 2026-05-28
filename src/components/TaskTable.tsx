import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { Task, TaskStatus, CustomField } from '../types';
import { TaskRow } from './TaskRow';
import type { CustomStatus } from './TaskRow';

interface TaskTableProps {
  tasks: Task[];
  onAddTask: (parentId: string | null) => void;
  onEditTask: (task: Task) => void;
  onDeleteTask: (id: string) => void;
  onBulkDeleteTasks?: (ids: string[]) => Promise<void>;
  onQuickSaveTask?: (description: string, parentId: string | null) => Promise<void>;
  onUpdateTaskStatus?: (taskId: string, category: TaskStatus, customLabel: string) => Promise<void>;
  onUpdateMultipleTasksStatus?: (taskIds: string[], category: TaskStatus, customLabel: string) => Promise<void>;
  onUpdateTaskField?: (taskId: string, fields: Partial<Task>) => Promise<void>;
  isReadOnly?: boolean;
  onShareClient?: (clientName: string) => void;
}

// COMPONENTE DE INPUT INLINE CLICKUP-STYLE
interface QuickAddRowProps {
  level: number;
  activeColsCount: number;
  onSave: (description: string) => void;
  onCancel: () => void;
}

const QuickAddRow: React.FC<QuickAddRowProps> = ({ level, activeColsCount, onSave, onCancel }) => {
  const [description, setDescription] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (description.trim()) {
        onSave(description.trim());
        setDescription('');
        // Re-foca para a próxima tarefa
        setTimeout(() => inputRef.current?.focus(), 0);
      } else {
        onCancel(); // Enter vazio fecha o input
      }
    } else if (e.key === 'Escape') {
      onCancel();
    }
  };

  const handleSaveClick = () => {
    if (description.trim()) {
      onSave(description.trim());
    }
  };

  return (
    <tr style={{
      borderBottom: '1px solid var(--outline)',
      background: 'rgba(123, 104, 238, 0.04)', /* Destaque leve lilás do ClickUp */
      height: '32px'
    }}>
      <td colSpan={activeColsCount} style={{ padding: '4px 8px 4px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center' }} className={`tree-indent-${Math.min(level, 6)}`}>
          {/* Espaçador para simular botão expansor */}
          <span style={{ width: '20px', minWidth: '20px', flexShrink: 0, display: 'inline-block' }} />

          {/* Círculo Checkbox tracejado do ClickUp */}
          <span className="material-symbols-outlined" style={{
            fontSize: '14px',
            marginRight: '6px',
            color: 'var(--text-muted)'
          }}>
            radio_button_unchecked
          </span>

          {/* Input Principal do Nome da Tarefa */}
          <input
            ref={inputRef}
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={onCancel}
            placeholder="Nome da Tarefa ou digite '/' para inserir comandos"
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--text-on-surface)',
              fontSize: '13px',
              fontWeight: 400,
              padding: '2px 0',
              marginRight: '12px'
            }}
          />

          {/* Botões Cancelar e Salvar ClickUp-Style */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginRight: '8px' }}>
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={onCancel}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                fontSize: '11px',
                fontWeight: 600,
                padding: '4px 8px',
                borderRadius: 'var(--radius-sm)'
              }}
              onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'}
              onMouseOut={(e) => e.currentTarget.style.background = 'none'}
            >
              Cancelar
            </button>
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleSaveClick}
              disabled={!description.trim()}
              style={{
                background: description.trim() ? 'var(--primary)' : 'rgba(123, 104, 238, 0.4)',
                border: 'none',
                color: '#ffffff',
                cursor: description.trim() ? 'pointer' : 'not-allowed',
                fontSize: '11px',
                fontWeight: 600,
                padding: '4px 10px',
                borderRadius: 'var(--radius-sm)',
                display: 'flex',
                alignItems: 'center',
                gap: '2px',
                transition: 'background 0.2s'
              }}
            >
              Salvar ↵
            </button>
          </div>
        </div>
      </td>
    </tr>
  );
};

export const TaskTable: React.FC<TaskTableProps> = ({
  tasks,
  onAddTask,
  onEditTask,
  onDeleteTask,
  onBulkDeleteTasks,
  onQuickSaveTask,
  onUpdateTaskStatus,
  onUpdateMultipleTasksStatus,
  onUpdateTaskField,
  isReadOnly = false,
  onShareClient
}) => {
  // Container fixo no body para a toolbar de ações em massa (evita problemas de stacking context)
  const bulkToolbarContainerRef = useRef<HTMLDivElement | null>(null);
  if (!bulkToolbarContainerRef.current) {
    const el = document.createElement('div');
    el.id = 'bulk-toolbar-mount';
    el.style.cssText = 'position:fixed;bottom:24px;left:0;width:100%;display:flex;justify-content:center;padding-left:200px;z-index:99999;pointer-events:none;box-sizing:border-box;';
    document.body.appendChild(el);
    bulkToolbarContainerRef.current = el;
  }
  useEffect(() => {
    return () => {
      const el = bulkToolbarContainerRef.current;
      if (el && el.parentNode) el.parentNode.removeChild(el);
      bulkToolbarContainerRef.current = null;
    };
  }, []);

  // Estado que armazena os IDs das tarefas expandidas
  const [expandedTasks, setExpandedTasks] = useState<Record<string, boolean>>({});

  // Estado que armazena onde o Quick Add inline está ativo (undefined = inativo, null = raiz, string = id do pai)
  const [quickAddParentId, setQuickAddParentId] = useState<string | null | undefined>(undefined);

  // Estado para armazenar os IDs das tarefas selecionadas para ações em massa
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [lastSelectedTaskId, setLastSelectedTaskId] = useState<string | null>(null);

  // ESTADOS DE FILTRO CLICKUP-STYLE
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'Todos' | TaskStatus>('Todos');

  // CONTROLE VISUAL MINIMALISTA DA LUPA DE BUSCA
  const [showSearchInput, setShowSearchInput] = useState(false);

  // ESTADO PARA MOSTRAR/OCULTAR TAREFAS FECHADAS
  const [showClosedTasks, setShowClosedTasks] = useState(false);

  // ESTADOS PARA DROPDOWN DE SUBTAREFAS (DUAS BOLINHAS CONNECTADAS)
  const [showSubtasksDropdown, setShowSubtasksDropdown] = useState(false);
  const [subtaskVisibilityMode, setSubtaskVisibilityMode] = useState<'recolhidas' | 'expandidas' | 'separar'>('recolhidas');

  // CONTROLES DE VISIBILIDADE E CAMPOS DA TOOLBAR FLUTUANTE DE AÇÕES EM MASSA
  const [visibleBulkActions, setVisibleBulkActions] = useState<Record<string, boolean>>(() => {
    const stored = localStorage.getItem('bulk_actions_visibility');
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {
        // ignore
      }
    }
    return { status: true, priority: true, startDate: true, endDate: true, financialValue: true, delete: true, cliente_ecosystem: true };
  });
  const [showBulkSettingsDropdown, setShowBulkSettingsDropdown] = useState(false);
  const [showBulkValuePopover, setShowBulkValuePopover] = useState(false);
  const [bulkValueInputValue, setBulkValueInputValue] = useState('');

  // REDIMENSIONAMENTO DE COLUNAS CLICKUP-STYLE
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
    const defaults = {
      taskName: 320,
      progress: 80,
      status: 90,
      startDate: 80,
      endDate: 80,
      financialValue: 110,
      priority: 95,
      cliente_ecosystem: 130
    };

    // Migração automática para garantir que as novas colunas perfeitamente ajustadas apareçam instantaneamente
    const hasOptimized = localStorage.getItem('task_column_widths_optimized_v3');
    if (!hasOptimized) {
      localStorage.setItem('task_column_widths', JSON.stringify(defaults));
      localStorage.setItem('task_column_widths_optimized_v3', 'true');
      return defaults;
    }

    const saved = localStorage.getItem('task_column_widths');
    return saved ? { ...defaults, ...JSON.parse(saved) } : defaults;
  });

  // Controle centralizado para garantir apenas um menu de três pontinhos aberto por vez
  const [activeThreeDotsTaskId, setActiveThreeDotsTaskId] = useState<string | null>(null);

  // Filtro de etiquetas ClickUp-style
  const [selectedTagFilter, setSelectedTagFilter] = useState<string | null>(null);

  // DRAG AND DROP DE COLUNAS
  const [columnOrder, setColumnOrder] = useState<string[]>(() => {
    const saved = localStorage.getItem('task_column_order');
    return saved ? JSON.parse(saved) : ['progress', 'status', 'startDate', 'endDate', 'financialValue', 'priority'];
  });

  // Estados para reordenamento Drag and Drop das tarefas
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverTaskId, setDragOverTaskId] = useState<string | null>(null);
  const [dragOverRelativeX, setDragOverRelativeX] = useState<number>(0);

  const getOrderedColumns = () => {
    const defaultKeys = ['progress', 'status', 'startDate', 'endDate', 'financialValue', 'priority'];
    const customKeys = customFields.map(f => f.key);
    const allKeys = [...defaultKeys, ...customKeys];
    
    const filteredOrder = columnOrder.filter(k => allKeys.includes(k));
    const missingKeys = allKeys.filter(k => !filteredOrder.includes(k));
    return [...filteredOrder, ...missingKeys];
  };

  const handleColumnDragStart = (e: React.DragEvent, colKey: string) => {
    e.dataTransfer.setData('text/plain', colKey);
  };

  const handleColumnDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleColumnDrop = (e: React.DragEvent, targetColKey: string) => {
    e.preventDefault();
    const sourceColKey = e.dataTransfer.getData('text/plain');
    if (!sourceColKey || sourceColKey === targetColKey) return;

    const currentOrder = getOrderedColumns();
    const sourceIndex = currentOrder.indexOf(sourceColKey);
    const targetIndex = currentOrder.indexOf(targetColKey);

    if (sourceIndex === -1 || targetIndex === -1) return;

    const newOrder = [...currentOrder];
    newOrder.splice(sourceIndex, 1);
    newOrder.splice(targetIndex, 0, sourceColKey);

    setColumnOrder(newOrder);
    localStorage.setItem('task_column_order', JSON.stringify(newOrder));
  };

  const handleResizeStart = (e: React.MouseEvent, colKey: string) => {
    e.preventDefault();
    const startX = e.pageX;
    const startWidth = columnWidths[colKey] !== undefined ? columnWidths[colKey] : (colKey === 'taskName' ? 400 : 120);

    // Obtém o título da coluna correspondente
    let columnTitle = '';
    if (colKey === 'taskName') {
      columnTitle = 'Nome da Tarefa / Etapa';
    } else {
      const nativeLabel = nativeColumnNames[colKey];
      if (nativeLabel) {
        columnTitle = nativeLabel;
      } else {
        const field = customFields.find(f => f.key === colKey);
        columnTitle = field ? field.label : '';
      }
    }

    // Calcula limite mínimo seguro para caber a palavra inteira (aproximadamente 6.5px por caractere + 22px de padding/gap)
    const minLimit = Math.max(50, columnTitle.length * 6.5 + 22);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.pageX - startX;
      const newWidth = Math.max(minLimit, startWidth + deltaX);
      setColumnWidths(prev => ({
        ...prev,
        [colKey]: newWidth
      }));
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      
      setColumnWidths(prev => {
        localStorage.setItem('task_column_widths', JSON.stringify(prev));
        return prev;
      });
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // ESTADO DE COLUNAS/CAMPOS DINÂMICOS CLICKUP-STYLE
  const [showColumnDropdown, setShowColumnDropdown] = useState(false);
  const [searchColumnQuery, setSearchColumnQuery] = useState('');
  const [visibleColumns, setVisibleColumns] = useState({
    progress: true,
    status: true,
    startDate: true,
    endDate: true,
    financialValue: true,
    priority: true
  });

  // ESTADO DE STATUS PERSONALIZADOS
  const [customStatuses, setCustomStatuses] = useState<CustomStatus[]>([]);

  // ESTADOS PARA CRIAÇÃO E CONTROLE DE CAMPOS CUSTOMIZADOS (FLUXO CLICKUP-STYLE)
  const [showCreateFieldPanel, setShowCreateFieldPanel] = useState(false);
  const [showManageFieldsPanel, setShowManageFieldsPanel] = useState(false);
  const [renamingFieldKey, setRenamingFieldKey] = useState<string | null>(null);
  const [tempRenameValue, setTempRenameValue] = useState('');
  const [activeTab, setActiveTab] = useState<'criar' | 'adicionar'>('criar');
  const [searchNewFieldQuery, setSearchNewFieldQuery] = useState('');

  // Passo 2: Configurações do Tipo Selecionado
  const [selectedFieldType, setSelectedFieldType] = useState<'text' | 'number' | 'date' | 'currency' | 'phone' | 'checkbox' | 'rating' | 'email' | null>(null);
  const [newFieldName, setNewFieldName] = useState('');
  const [expandMoreConfigs, setExpandMoreConfigs] = useState(false);
  const [newFieldDescription, setNewFieldDescription] = useState('');
  const [newFieldDefaultValue, setNewFieldDefaultValue] = useState('');
  const [newFieldIsRequired, setNewFieldIsRequired] = useState(false);
  const [newFieldIsPinned, setNewFieldIsPinned] = useState(false);
  const [editingField, setEditingField] = useState<CustomField | null>(null);
  const [editFieldName, setEditFieldName] = useState('');
  const [nativeColumnNames, setNativeColumnNames] = useState<Record<string, string>>(() => {
    return {
      progress: localStorage.getItem('col_label_progress') || 'Progresso',
      status: localStorage.getItem('col_label_status') || 'Status',
      startDate: localStorage.getItem('col_label_startDate') || 'Início',
      endDate: localStorage.getItem('col_label_endDate') || 'Previsão',
      financialValue: localStorage.getItem('col_label_financialValue') || 'Valor Fin. (BRL)',
      priority: localStorage.getItem('col_label_priority') || 'Prioridade'
    };
  });

  const [customFields, setCustomFields] = useState<CustomField[]>(() => {
    const SYSTEM_DEFAULT_FIELDS: CustomField[] = [
      {
        key: 'cliente_ecosystem',
        label: 'Cliente',
        icon: 'group',
        type: 'dropdown',
        description: 'Cliente vinculado à tarefa no ecossistema',
        options: ['TechNova Solutions', 'Global Logistics', 'Alpha Developers'],
        isSystemDefault: true,
        isPinned: true
      }
    ];

    const savedFields = localStorage.getItem('custom_fields_list');
    if (savedFields) {
      try {
        const parsed = JSON.parse(savedFields) as CustomField[];
        // Mescla dados salvos do cliente_ecosystem (optionColors, bgColor, label) com o padrão
        const savedClientField = parsed.find(f => f.key === 'cliente_ecosystem');
        const mergedSystem = SYSTEM_DEFAULT_FIELDS.map(def =>
          savedClientField && def.key === 'cliente_ecosystem'
            ? { ...def, ...savedClientField, isSystemDefault: true, isPinned: true }
            : def
        );
        const filtered = parsed.filter(f => f.key !== 'cliente_ecosystem');
        return [...mergedSystem, ...filtered];
      } catch (e) {
        return SYSTEM_DEFAULT_FIELDS;
      }
    }
    return SYSTEM_DEFAULT_FIELDS;
  });

  const [visibleCustomColumns, setVisibleCustomColumns] = useState<Record<string, boolean>>(() => {
    const saved = localStorage.getItem('custom_fields_visibility');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // ignore
      }
    }
    return {};
  });

  useEffect(() => {
    const savedFields = localStorage.getItem('custom_fields_list');
    if (savedFields) {
      try {
        const parsed = JSON.parse(savedFields) as CustomField[];
        setColumnWidths(prev => {
          const updated = { ...prev };
          parsed.forEach(f => {
            if (updated[f.key] === undefined) {
              updated[f.key] = 120;
            }
          });
          if (updated['cliente_ecosystem'] === undefined) {
            updated['cliente_ecosystem'] = 120;
          }
          return updated;
        });
      } catch (e) {}
    } else {
      setColumnWidths(prev => {
        const updated = { ...prev };
        if (updated['cliente_ecosystem'] === undefined) {
          updated['cliente_ecosystem'] = 120;
        }
        return updated;
      });
    }
    const savedVisibility = localStorage.getItem('custom_fields_visibility');
    if (savedVisibility) {
      setVisibleCustomColumns(JSON.parse(savedVisibility));
    }
  }, []);

  /*
  const handleStartEditField = (field: CustomField) => {
    setEditingField(field);
    setSelectedFieldType(field.type);
    setEditFieldName(field.label);
    setNewFieldDescription(field.description || '');
    setNewFieldDefaultValue(field.defaultValue || '');
    setNewFieldIsRequired(field.isRequired || false);
    setNewFieldIsPinned(field.isPinned || false);
    setShowCreateFieldPanel(true);
  };
  */

  const handleSaveEditField = () => {
    if (!editingField || !editFieldName.trim()) return;

    const updatedFields = customFields.map(f => {
      if (f.key === editingField.key) {
        return {
          ...f,
          label: editFieldName.trim(),
          description: newFieldDescription.trim() || undefined,
          defaultValue: newFieldDefaultValue.trim() || undefined,
          isRequired: newFieldIsRequired,
          isPinned: newFieldIsPinned
        };
      }
      return f;
    });

    setCustomFields(updatedFields);
    localStorage.setItem('custom_fields_list', JSON.stringify(updatedFields));

    setEditingField(null);
    setEditFieldName('');
    setSelectedFieldType(null);
    setNewFieldDescription('');
    setNewFieldDefaultValue('');
    setNewFieldIsRequired(false);
    setNewFieldIsPinned(false);
    setExpandMoreConfigs(false);
  };

  const handleDeleteCustomField = (key: string) => {
    if (key === 'cliente_ecosystem') return;
    if (!window.confirm('Tem certeza de que deseja excluir este campo personalizado? Todos os dados preenchidos para ele nas tarefas serão perdidos.')) return;

    const updatedFields = customFields.filter(f => f.key !== key);
    setCustomFields(updatedFields);
    localStorage.setItem('custom_fields_list', JSON.stringify(updatedFields));

    const updatedVisibility = { ...visibleCustomColumns };
    delete updatedVisibility[key];
    setVisibleCustomColumns(updatedVisibility);
    localStorage.setItem('custom_fields_visibility', JSON.stringify(updatedVisibility));

    // Limpar valores salvos desse campo nas tarefas
    Object.keys(localStorage).forEach(k => {
      if (k.includes('_custom_val_') && k.endsWith(`_${key}`)) {
        localStorage.removeItem(k);
      }
    });

    setEditingField(null);
    setEditFieldName('');
    setSelectedFieldType(null);
    setNewFieldDescription('');
    setNewFieldDefaultValue('');
    setNewFieldIsRequired(false);
    setNewFieldIsPinned(false);
    setExpandMoreConfigs(false);
  };

  const handleCreateCustomField = () => {
    if (!newFieldName.trim() || !selectedFieldType) return;

    const key = `custom_col_${Date.now()}`;

    // Mapeamento de ícones do Material Symbols
    let icon = 'notes';
    if (selectedFieldType === 'number') icon = 'numbers';
    else if (selectedFieldType === 'date') icon = 'calendar_month';
    else if (selectedFieldType === 'currency') icon = 'attach_money';
    else if (selectedFieldType === 'phone') icon = 'call';
    else if (selectedFieldType === 'checkbox') icon = 'check_box';
    else if (selectedFieldType === 'rating') icon = 'star';
    else if (selectedFieldType === 'email') icon = 'mail';

    const newField: CustomField = {
      key,
      label: newFieldName.trim(),
      icon,
      type: selectedFieldType,
      description: newFieldDescription.trim() || undefined,
      defaultValue: newFieldDefaultValue.trim() || undefined,
      isRequired: newFieldIsRequired,
      isPinned: newFieldIsPinned
    };

    const updatedFields = [...customFields, newField];
    setCustomFields(updatedFields);
    localStorage.setItem('custom_fields_list', JSON.stringify(updatedFields));

    const updatedVisibility = { ...visibleCustomColumns, [key]: true };
    setVisibleCustomColumns(updatedVisibility);
    localStorage.setItem('custom_fields_visibility', JSON.stringify(updatedVisibility));

    // Inicializa a largura padrão do resize
    setColumnWidths(prev => {
      const updated = { ...prev, [key]: 120 };
      localStorage.setItem('task_column_widths', JSON.stringify(updated));
      return updated;
    });

    // Limpa os estados do formulário
    setNewFieldName('');
    setSelectedFieldType(null);
    setNewFieldDescription('');
    setNewFieldDefaultValue('');
    setNewFieldIsRequired(false);
    setNewFieldIsPinned(false);
    setExpandMoreConfigs(false);
    setShowCreateFieldPanel(false);
  };

  const [showHeaderPlusDropdown, setShowHeaderPlusDropdown] = useState(false);
  const [inlineColorPickerFor, setInlineColorPickerFor] = useState<string | null>(null);
  const PALETTE = ['#ef4444','#f97316','#eab308','#22c55e','#14b8a6','#3b82f6','#6366f1','#8b5cf6','#ec4899','#6b7280'];
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const handleSortCol = (col: string) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('asc'); }
  };
  const filterRef = useRef<HTMLDivElement>(null);
  const columnRef = useRef<HTMLDivElement>(null);
  const subtasksRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLDivElement>(null);
  const headerPlusRef = useRef<HTMLTableHeaderCellElement>(null);

  // Carrega e gerencia a lista dinâmica de status
  const loadStatuses = () => {
    const defaultStatuses: CustomStatus[] = [
      { id: '1', label: 'PARA FAZER', category: 'A Fazer', color: '#9ca3af', icon: 'radio_button_unchecked' },
      { id: '2', label: 'AGUARDANDO DADOS', category: 'Pendente', color: '#ba55d3', icon: 'schedule' },
      { id: '3', label: 'EXECUTANDO', category: 'Em Execução', color: '#3b82f6', icon: 'pending' },
      { id: '4', label: 'AVISOS', category: 'Pendente', color: '#f59e0b', icon: 'warning' },
      { id: '5', label: 'DESCARTADO', category: 'Pendente', color: '#ef4444', icon: 'cancel' },
      { id: '6', label: 'FEITO', category: 'Concluído', color: '#10b981', icon: 'check_circle' }
    ];

    const colorMap: Record<string, Partial<CustomStatus>> = {
      '1': { color: '#9ca3af', icon: 'radio_button_unchecked' },
      '4': { color: '#f59e0b', icon: 'warning' },
      '5': { color: '#ef4444', icon: 'cancel' },
    };

    const saved = localStorage.getItem('custom_statuses_list');
    if (saved) {
      const parsed: CustomStatus[] = JSON.parse(saved);
      const migrated = parsed.map(s => colorMap[s.id] ? { ...s, ...colorMap[s.id] } : s);
      localStorage.setItem('custom_statuses_list', JSON.stringify(migrated));
      setCustomStatuses(migrated);
    } else {
      localStorage.setItem('custom_statuses_list', JSON.stringify(defaultStatuses));
      setCustomStatuses(defaultStatuses);
    }
  };

  useEffect(() => {
    loadStatuses();

    // Escuta evento global de mudança de status personalizados para recarga reativa
    const handleStatusReload = () => {
      loadStatuses();
    };
    window.addEventListener('customStatusesChanged', handleStatusReload);
    return () => window.removeEventListener('customStatusesChanged', handleStatusReload);
  }, []);

  // Por padrão, expande os nós de nível 1 na primeira carga para uma melhor visualização inicial
  useEffect(() => {
    if (tasks.length > 0 && Object.keys(expandedTasks).length === 0) {
      const initialExpands: Record<string, boolean> = {};
      tasks.forEach(t => {
        if (t.parent_id === null) {
          initialExpands[t.id] = true;
        }
      });
      setExpandedTasks(initialExpands);
    }
  }, [tasks]);

  // Fechar os dropdowns ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
        setShowFilterDropdown(false);
      }
      if (columnRef.current && !columnRef.current.contains(event.target as Node)) {
        setShowColumnDropdown(false);
      }
      if (headerPlusRef.current && !headerPlusRef.current.contains(event.target as Node)) {
        setShowHeaderPlusDropdown(false);
      }
      if (subtasksRef.current && !subtasksRef.current.contains(event.target as Node)) {
        setShowSubtasksDropdown(false);
      }
      if (searchInputRef.current && !searchInputRef.current.contains(event.target as Node)) {
        // Apenas fecha a lupa se o campo estiver vazio!
        if (!searchQuery.trim()) {
          setShowSearchInput(false);
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [searchQuery]);

  useEffect(() => {
    const main = document.querySelector('.main-content') as HTMLElement | null;
    if (!main) return;
    if (selectedTaskIds.length > 0 && !isReadOnly) {
      main.style.paddingBottom = '90px';
    } else {
      main.style.paddingBottom = '';
    }
    return () => { if (main) main.style.paddingBottom = ''; };
  }, [selectedTaskIds.length, isReadOnly]);

  const handleToggleExpand = (id: string) => {
    setExpandedTasks(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const handleClearSelection = () => {
    setSelectedTaskIds([]);
  };

  const handleBulkDelete = async () => {
    if (onBulkDeleteTasks && selectedTaskIds.length > 0) {
      await onBulkDeleteTasks(selectedTaskIds);
      handleClearSelection();
    }
  };

  const handleBulkStatusChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const valueStr = e.target.value;
    if (!valueStr) return;

    try {
      const { category, label } = JSON.parse(valueStr);
      if (selectedTaskIds.length > 0) {
        if (window.confirm(`Tem certeza que deseja alterar o status de ${selectedTaskIds.length} tarefas para "${label}"?`)) {
          if (onUpdateMultipleTasksStatus) {
            await onUpdateMultipleTasksStatus(selectedTaskIds, category, label.toUpperCase());
          } else if (onUpdateTaskStatus) {
            for (const id of selectedTaskIds) {
              localStorage.setItem(`task_custom_status_${id}`, label.toUpperCase());
              await onUpdateTaskStatus(id, category, label.toUpperCase());
            }
          }
          handleClearSelection();
        }
      }
    } catch (err) {
      console.error('Erro ao atualizar status em lote:', err);
    }
    e.target.value = '';
  };

  const handleBulkPriorityChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newPriority = e.target.value;
    if (!newPriority) return;
    if (onUpdateTaskField && selectedTaskIds.length > 0) {
      if (window.confirm(`Tem certeza que deseja alterar a prioridade de ${selectedTaskIds.length} tarefas?`)) {
        for (const id of selectedTaskIds) {
          await onUpdateTaskField(id, { priority: newPriority === 'clear' ? undefined : (newPriority as any) });
        }
        handleClearSelection();
      }
    }
    e.target.value = '';
  };


  const handleBulkStartDateChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = e.target.value;
    if (!newDate) return;
    if (onUpdateTaskField && selectedTaskIds.length > 0) {
      if (window.confirm(`Tem certeza que deseja alterar a data inicial de ${selectedTaskIds.length} tarefas?`)) {
        for (const id of selectedTaskIds) {
          await onUpdateTaskField(id, { start_date: newDate });
        }
        handleClearSelection();
      }
    }
    e.target.value = '';
  };

  const handleBulkEndDateChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = e.target.value;
    if (!newDate) return;
    if (onUpdateTaskField && selectedTaskIds.length > 0) {
      if (window.confirm(`Tem certeza que deseja alterar a data final de ${selectedTaskIds.length} tarefas?`)) {
        for (const id of selectedTaskIds) {
          await onUpdateTaskField(id, { end_date: newDate });
        }
        handleClearSelection();
      }
    }
    e.target.value = '';
  };

  const handleBulkValueChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val === '') return;
    const newValue = parseFloat(val);
    if (isNaN(newValue)) return;
    if (onUpdateTaskField && selectedTaskIds.length > 0) {
      if (window.confirm(`Tem certeza que deseja alterar o valor contratual de ${selectedTaskIds.length} tarefas?`)) {
        for (const id of selectedTaskIds) {
          await onUpdateTaskField(id, { contract_value: newValue });
        }
        handleClearSelection();
      }
    }
    e.target.value = '';
  };

  const handleBulkClientChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newClient = e.target.value;
    if (!newClient) return;
    if (selectedTaskIds.length > 0) {
      if (window.confirm(`Tem certeza que deseja alterar o cliente de ${selectedTaskIds.length} tarefas para "${newClient}"?`)) {
        for (const id of selectedTaskIds) {
          const storageKey = `task_custom_val_${id}_cliente_ecosystem`;
          localStorage.setItem(storageKey, newClient);
          if (onUpdateTaskField) {
            await onUpdateTaskField(id, { client_name: newClient });
          }
        }
        handleClearSelection();
      }
    }
    e.target.value = '';
  };

  const handleExpandAll = () => {
    const allExpands: Record<string, boolean> = {};
    tasks.forEach(t => {
      allExpands[t.id] = true;
    });
    setExpandedTasks(allExpands);
  };

  const handleCollapseAll = () => {
    setExpandedTasks({});
  };

  // --- INTELIGÊNCIA DE FILTRAGEM RECURSIVA ---
  // Identifica quais IDs de tarefas correspondem diretamente aos filtros aplicados
  const matchingIds = new Set<string>();
  tasks.forEach(task => {
    const matchSearch = searchQuery.trim() === '' || task.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchStatus = statusFilter === 'Todos' || task.status === statusFilter;
    const taskTags: string[] = (task as any).tags || [];
    const matchTag = !selectedTagFilter || taskTags.includes(selectedTagFilter);

    if (matchSearch && matchStatus && matchTag) {
      matchingIds.add(task.id);
    }
  });

  // Conjunto final contendo os itens válidos E todos os seus ancestrais para manter a estrutura da árvore intacta
  const activeFilterIds = new Set<string>();
  matchingIds.forEach(id => {
    activeFilterIds.add(id);
    const task = tasks.find(t => t.id === id);
    if (task && task.path_route) {
      task.path_route.forEach(ancestorId => {
        activeFilterIds.add(ancestorId);
      });
    }
  });

  const hasActiveFilters = searchQuery.trim() !== '' || statusFilter !== 'Todos' || selectedTagFilter !== null;

  // Busca a categoria de status da tarefa (considera rótulos dinâmicos personalizados)
  const getTaskCustomCategory = (task: Task): TaskStatus => {
    const savedLabel = localStorage.getItem(`task_custom_status_${task.id}`);
    if (savedLabel) {
      const matched = customStatuses.find(s => s.label.toUpperCase() === savedLabel.toUpperCase());
      if (matched) return matched.category;
    }
    return task.status;
  };

  // Lógica de filtragem e Lazy Rendering:
  const isTaskVisible = (task: Task): boolean => {
    // Ocultar tarefas fechadas se showClosedTasks for false (padrão do ClickUp!)
    if (!showClosedTasks) {
      const category = getTaskCustomCategory(task);
      if (category === 'Concluído') {
        return false;
      }
    }

    // Se há algum filtro ativo (busca ou status) e a tarefa não pertence ao conjunto final, ela fica invisível!
    if (hasActiveFilters && !activeFilterIds.has(task.id)) {
      return false;
    }

    if (task.parent_id === null) return true; // Raiz é sempre visível se atende

    const path = task.path_route || [];
    for (let i = 0; i < path.length - 1; i++) {
      const ancestorId = path[i];
      if (!expandedTasks[ancestorId]) {
        return false;
      }
    }

    return true;
  };

  // Algoritmo de Progresso ClickUp de alta fidelidade
  const getTaskProgress = (task: Task): number => {
    const getLeafDescendants = (tId: string): Task[] => {
      const children = tasks.filter(t => t.parent_id === tId);
      if (children.length === 0) {
        const current = tasks.find(t => t.id === tId);
        return current ? [current] : [];
      }
      return children.flatMap(c => getLeafDescendants(c.id));
    };

    const leaves = getLeafDescendants(task.id);
    if (leaves.length === 0) return 0;

    const totalProgress = leaves.reduce((sum, t) => {
      const category = getTaskCustomCategory(t);
      if (category === 'Concluído') return sum + 100;
      if (category === 'Em Execução') return sum + 50;
      return sum;
    }, 0);

    return Math.round(totalProgress / leaves.length);
  };

  // Intercepta a adição de tarefas para ativar o Quick Add inline se disponível
  const handleTriggerAddTask = (parentId: string | null) => {
    if (onQuickSaveTask) {
      setQuickAddParentId(parentId);
      if (parentId) {
        // Expande o pai automaticamente para garantir que o input inline fique visível!
        setExpandedTasks(prev => ({
          ...prev,
          [parentId]: true
        }));
      }
    } else {
      onAddTask(parentId);
    }
  };

  const handleSaveQuickAdd = async (description: string, parentId: string | null) => {
    if (onQuickSaveTask) {
      await onQuickSaveTask(description, parentId);
      // Mantém o input aberto para adicionar a próxima tarefa
    }
  };

  const handleDropTask = async (draggedId: string, targetId: string, relativeX: number) => {
    setDraggedTaskId(null);
    setDragOverTaskId(null);
    setDragOverRelativeX(0);

    if (draggedId === targetId) return;

    const draggedTask = tasks.find(t => t.id === draggedId);
    const targetTask = tasks.find(t => t.id === targetId);
    if (!draggedTask || !targetTask) return;

    // Limiar baseado no nível da tarefa alvo: quanto mais aninhada, maior o limiar
    const subtaskThreshold = (targetTask.level || 0) * 22 + 80;

    try {
      if (relativeX > subtaskThreshold) {
        // Soltar à DIREITA do limiar → virar subtarefa da tarefa alvo
        if (onUpdateTaskField && draggedId !== targetId) {
          await onUpdateTaskField(draggedId, { parent_id: targetTask.id });
        }
      } else if (relativeX < 30 && draggedTask.parent_id !== null) {
        // Soltar muito à ESQUERDA → promover um nível
        const currentParent = tasks.find(t => t.id === draggedTask.parent_id);
        const newParentId = currentParent ? currentParent.parent_id : null;
        if (onUpdateTaskField) {
          await onUpdateTaskField(draggedId, { parent_id: newParentId });
        }
      } else {
        // Zona neutra → reordenar no mesmo nível da tarefa alvo
        if (draggedTask.parent_id !== targetTask.parent_id) {
          if (onUpdateTaskField) {
            await onUpdateTaskField(draggedId, { parent_id: targetTask.parent_id });
          }
        }
      }

      // Reordena posição no localStorage
      const currentOrderIds = tasks.map(t => t.id);
      const filteredOrderIds = currentOrderIds.filter(id => id !== draggedId);
      const targetIdx = filteredOrderIds.indexOf(targetId);
      if (targetIdx !== -1) {
        filteredOrderIds.splice(targetIdx, 0, draggedId);
      } else {
        filteredOrderIds.push(draggedId);
      }

      const clientName = targetTask.client_name;
      localStorage.setItem(`taskmasters_order_${clientName}`, JSON.stringify(filteredOrderIds));
      window.dispatchEvent(new Event('refreshTasks'));
    } catch (err) {
      console.error('Erro ao reordenar tarefas:', err);
    }
  };

  const clearFilters = () => {
    setSearchQuery('');
    setStatusFilter('Todos');
  };

  const toggleColumn = (col: keyof typeof visibleColumns) => {
    setVisibleColumns(prev => ({
      ...prev,
      [col]: !prev[col]
    }));
  };

  const visibleTasks = (() => {
    const base = tasks.filter(isTaskVisible);
    if (!sortCol) return base;

    const getTaskSortValue = (t: Task): string | number => {
      if (sortCol === 'taskName') return t.description || '';
      if (sortCol === 'progress') return getTaskProgress(t);
      if (sortCol === 'status') return t.status || '';
      if (sortCol === 'startDate') return t.start_date || '';
      if (sortCol === 'endDate') return t.end_date || '';
      if (sortCol === 'financialValue') return t.contract_value || 0;
      if (sortCol === 'priority') {
        const ord: Record<string, number> = { Urgente: 0, Alta: 1, Normal: 2, Baixa: 3, '': 4 };
        return ord[t.priority || ''] ?? 4;
      }
      if (sortCol === 'cliente_ecosystem') return t.client_name || '';
      return localStorage.getItem(`task_custom_val_${t.id}_${sortCol}`) || '';
    };

    const compareSortValues = (va: string | number, vb: string | number) => {
      if (typeof va === 'number' && typeof vb === 'number') return sortDir === 'asc' ? va - vb : vb - va;
      return sortDir === 'asc' ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
    };

    // Identifica "raiz visível": tarefa cujo pai não está na lista visível
    const baseIds = new Set(base.map(t => t.id));
    const isVisibleRoot = (t: Task) => !t.parent_id || !baseIds.has(t.parent_id);

    // Encontra o ancestral raiz visível de uma tarefa
    const getVisibleRoot = (t: Task): Task => {
      if (isVisibleRoot(t)) return t;
      const parent = tasks.find(p => p.id === t.parent_id);
      return parent ? getVisibleRoot(parent) : t;
    };

    // Agrupa descendentes por raiz, mantendo ordem original de `base`
    const groups = new Map<string, Task[]>();
    base.forEach(t => {
      const root = getVisibleRoot(t);
      if (!groups.has(root.id)) groups.set(root.id, []);
      groups.get(root.id)!.push(t);
    });

    // Ordena apenas as raízes
    const roots = [...groups.keys()].map(id => tasks.find(t => t.id === id)!).filter(Boolean);
    roots.sort((a, b) => compareSortValues(getTaskSortValue(a), getTaskSortValue(b)));

    // Reconstrói lista: raiz + seus descendentes visíveis (ordem original)
    return roots.flatMap(root => groups.get(root.id) || []);
  })();

  const handleToggleSelect = (id: string, selected: boolean, shiftKey?: boolean) => {
    setSelectedTaskIds(prev => {
      let nextSelection = [...prev];

      if (shiftKey && lastSelectedTaskId && lastSelectedTaskId !== id) {
        // Encontra os índices na lista de tarefas atualmente visíveis
        const indexCurrent = visibleTasks.findIndex(t => t.id === id);
        const indexLast = visibleTasks.findIndex(t => t.id === lastSelectedTaskId);

        if (indexCurrent !== -1 && indexLast !== -1) {
          const start = Math.min(indexCurrent, indexLast);
          const end = Math.max(indexCurrent, indexLast);
          
          // Obtém todas as tarefas no intervalo visível
          const rangeTasks = visibleTasks.slice(start, end + 1);
          const rangeIds = rangeTasks.map(t => t.id);

          if (selected) {
            // Adiciona todas do intervalo
            rangeIds.forEach(rangeId => {
              if (!nextSelection.includes(rangeId)) {
                nextSelection.push(rangeId);
              }
            });
          } else {
            // Remove todas do intervalo
            nextSelection = nextSelection.filter(rangeId => !rangeIds.includes(rangeId));
          }
        }
      } else {
        // Seleção individual normal
        if (selected) {
          if (!nextSelection.includes(id)) {
            nextSelection.push(id);
          }
        } else {
          nextSelection = nextSelection.filter(taskId => taskId !== id);
        }
      }

      return nextSelection;
    });

    // Atualiza o ID do último item selecionado individualmente
    setLastSelectedTaskId(id);
  };

  // Contagem de colunas ativas para calcular o colspan
  const activeColsCount = 1
    + (visibleColumns.progress ? 1 : 0)
    + (visibleColumns.status ? 1 : 0)
    + (visibleColumns.startDate ? 1 : 0)
    + (visibleColumns.endDate ? 1 : 0)
    + (visibleColumns.financialValue ? 1 : 0)
    + (visibleColumns.priority ? 1 : 0)
    + customFields.filter(f => visibleCustomColumns[f.key] !== false).length;

  // Mapeamento dos campos disponíveis para busca dinâmica no painel de colunas
  const columnsList = [
    { key: 'progress' as const, label: 'Progresso', icon: 'trending_up' },
    { key: 'status' as const, label: 'Status', icon: 'radio_button_checked' },
    { key: 'startDate' as const, label: 'Data inicial', icon: 'calendar_today' },
    { key: 'endDate' as const, label: 'Data de vencimento', icon: 'event_busy' },
    { key: 'financialValue' as const, label: 'Valor Financeiro', icon: 'payments' },
    { key: 'priority' as const, label: 'Prioridade', icon: 'flag' },
  ];

  const AVAILABLE_FIELD_TYPES = [
    { type: 'text' as const, label: 'Texto', icon: 'notes', color: '#64B5F6' },
    { type: 'number' as const, label: 'Número', icon: 'numbers', color: '#4DB6AC' },
    { type: 'currency' as const, label: 'Dinheiro', icon: 'attach_money', color: '#81C784' },
    { type: 'phone' as const, label: 'Telefone', icon: 'call', color: '#FF8A65' },
    { type: 'date' as const, label: 'Data', icon: 'calendar_month', color: '#BA68C8' },
    { type: 'checkbox' as const, label: 'Caixa de seleção', icon: 'check_box', color: '#F06292' },
    { type: 'rating' as const, label: 'Avaliação', icon: 'star', color: '#FFD54F' },
    { type: 'email' as const, label: 'E-mail', icon: 'mail', color: '#4DD0E1' }
  ];

  const filteredColumnsList = columnsList.filter(col =>
    col.label.toLowerCase().includes(searchColumnQuery.toLowerCase())
  );

  return (
    <div style={{
      background: 'transparent',
      borderRadius: '0px',
      border: 'none',
      boxShadow: 'none',
      overflow: 'visible',
      paddingBottom: selectedTaskIds.length > 0 && !isReadOnly ? '90px' : '0'
    }}>

      {/* TOOLBAR FLUTUANTE DE AÇÕES EM MASSA */}
      {createPortal(
        selectedTaskIds.length > 0 && !isReadOnly ? (
        <div style={{
          pointerEvents: 'auto',
          background: 'var(--surface-high, #26262e)',
          border: '2px solid var(--primary, #7b68ee)',
          borderRadius: '14px',
          boxShadow: '0 12px 48px rgba(0,0,0,0.55), 0 0 0 1px rgba(123,104,238,0.15)',
          padding: '10px 18px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          width: 'fit-content',
          maxWidth: 'calc(100vw - 240px)',
          flexWrap: 'wrap',
          animation: 'fadeInUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--primary)', fontWeight: 700, fontSize: '13px' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>check_circle</span>
            {selectedTaskIds.length} {selectedTaskIds.length === 1 ? 'tarefa' : 'tarefas'}
          </div>
          
          <div style={{ width: '1px', height: '16px', background: 'var(--outline-variant)' }} />

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Seletor de Status em Massa */}
            {visibleBulkActions.status !== false && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '15px', color: 'var(--text-muted)' }}>adjust</span>
                  <select 
                    onChange={handleBulkStatusChange} 
                    style={{ 
                      background: 'transparent', 
                      border: 'none', 
                      outline: 'none', 
                      color: 'var(--text-on-surface)', 
                      fontSize: '11px', 
                      fontWeight: 600, 
                      cursor: 'pointer',
                      width: '60px',
                      paddingRight: '0px'
                    }}
                  >
                    <option value="">Status</option>
                    {customStatuses.map(s => <option key={s.id} value={JSON.stringify({ category: s.category, label: s.label })}>{s.label || s.category}</option>)}
                  </select>
                </div>
                <div style={{ width: '1px', height: '12px', background: 'var(--outline-variant)' }} />
              </>
            )}

            {/* Seletor de Cliente em Massa */}
            {visibleBulkActions.cliente_ecosystem !== false && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '15px', color: 'var(--text-muted)' }}>group</span>
                  <select 
                    onChange={handleBulkClientChange} 
                    style={{ 
                      background: 'transparent', 
                      border: 'none', 
                      outline: 'none', 
                      color: 'var(--text-on-surface)', 
                      fontSize: '11px', 
                      fontWeight: 600, 
                      cursor: 'pointer',
                      width: '65px',
                      paddingRight: '0px'
                    }}
                  >
                    <option value="">Cliente</option>
                    {[...new Set(tasks.map(t => t.client_name).filter(Boolean))].map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
                <div style={{ width: '1px', height: '12px', background: 'var(--outline-variant)' }} />
              </>
            )}

            {/* Seletor de Prioridade em Massa */}
            {visibleBulkActions.priority !== false && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '15px', color: 'var(--text-muted)' }}>flag</span>
                  <select 
                    onChange={handleBulkPriorityChange} 
                    style={{ 
                      background: 'transparent', 
                      border: 'none', 
                      outline: 'none', 
                      color: 'var(--text-on-surface)', 
                      fontSize: '11px', 
                      fontWeight: 600, 
                      cursor: 'pointer',
                      width: '80px',
                      paddingRight: '0px'
                    }}
                  >
                    <option value="">Prioridade</option>
                    <option value="Urgente">Urgente</option>
                    <option value="Alta">Alta</option>
                    <option value="Normal">Normal</option>
                    <option value="Baixa">Baixa</option>
                    <option value="clear">Sem prioridade</option>
                  </select>
                </div>
                <div style={{ width: '1px', height: '12px', background: 'var(--outline-variant)' }} />
              </>
            )}

            {/* Seletor de Data Inicial em Massa */}
            {visibleBulkActions.startDate !== false && (
              <>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <button 
                    style={{
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      color: 'var(--text-on-surface)',
                      fontSize: '11px',
                      fontWeight: 600,
                      padding: '4px 6px',
                      borderRadius: '4px',
                      position: 'relative',
                      overflow: 'hidden'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.background = 'var(--surface-hover)'}
                    onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '15px', color: 'var(--text-muted)' }}>calendar_today</span>
                    <span>Início</span>
                    {/* Input invisível absoluto que cobre o botão para disparar calendário nativo de forma limpa */}
                    <input 
                      type="date" 
                      onChange={handleBulkStartDateChange} 
                      style={{ 
                        position: 'absolute', 
                        top: 0, 
                        left: 0, 
                        width: '100%', 
                        height: '100%', 
                        opacity: 0, 
                        cursor: 'pointer' 
                      }} 
                    />
                  </button>
                </div>
                <div style={{ width: '1px', height: '12px', background: 'var(--outline-variant)' }} />
              </>
            )}

            {/* Seletor de Data de Vencimento em Massa (Prazo) */}
            {visibleBulkActions.endDate !== false && (
              <>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <button 
                    style={{
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      color: 'var(--text-on-surface)',
                      fontSize: '11px',
                      fontWeight: 600,
                      padding: '4px 6px',
                      borderRadius: '4px',
                      position: 'relative',
                      overflow: 'hidden'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.background = 'var(--surface-hover)'}
                    onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '15px', color: 'var(--text-muted)' }}>event</span>
                    <span>Prazo</span>
                    {/* Input invisível absoluto que cobre o botão para disparar calendário nativo de forma limpa */}
                    <input 
                      type="date" 
                      onChange={handleBulkEndDateChange} 
                      style={{ 
                        position: 'absolute', 
                        top: 0, 
                        left: 0, 
                        width: '100%', 
                        height: '100%', 
                        opacity: 0, 
                        cursor: 'pointer' 
                      }} 
                    />
                  </button>
                </div>
                <div style={{ width: '1px', height: '12px', background: 'var(--outline-variant)' }} />
              </>
            )}

            {/* Seletor de Valor em Massa */}
            {visibleBulkActions.financialValue !== false && (
              <>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <button 
                    onClick={() => { setShowBulkValuePopover(!showBulkValuePopover); setBulkValueInputValue(''); }}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      color: 'var(--text-on-surface)',
                      fontSize: '11px',
                      fontWeight: 600,
                      padding: '4px 6px',
                      borderRadius: '4px'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.background = 'var(--surface-hover)'}
                    onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '15px', color: 'var(--text-muted)' }}>payments</span>
                    <span>Valor</span>
                  </button>

                  {showBulkValuePopover && (
                    <div style={{
                      position: 'absolute',
                      bottom: 'calc(100% + 8px)',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      background: 'var(--surface)',
                      border: '1px solid var(--outline-variant)',
                      borderRadius: '8px',
                      boxShadow: 'var(--shadow-lg)',
                      padding: '8px',
                      width: '150px',
                      zIndex: 10000,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px'
                    }}>
                      <div style={{ fontSize: '9px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', padding: '2px 4px' }}>Inserir Valor (R$)</div>
                      <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                        <input 
                          type="number"
                          placeholder="R$ 0,00"
                          value={bulkValueInputValue}
                          onChange={(e) => setBulkValueInputValue(e.target.value)}
                          onFocus={e => e.currentTarget.select()}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleBulkValueChange({ target: { value: bulkValueInputValue } } as any);
                              setShowBulkValuePopover(false);
                            }
                          }}
                          autoFocus
                          style={{
                            background: 'var(--surface-low)',
                            border: '1px solid var(--outline)',
                            borderRadius: '4px',
                            padding: '4px 6px',
                            fontSize: '11px',
                            color: 'var(--text-on-surface)',
                            outline: 'none',
                            width: '100%',
                            height: '24px',
                            boxSizing: 'border-box'
                          }}
                        />
                        <button 
                          onClick={() => {
                            handleBulkValueChange({ target: { value: bulkValueInputValue } } as any);
                            setShowBulkValuePopover(false);
                          }}
                          style={{
                            background: 'var(--primary)',
                            border: 'none',
                            color: '#ffffff',
                            borderRadius: '4px',
                            width: '24px',
                            height: '24px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer'
                          }}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>check</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                <div style={{ width: '1px', height: '12px', background: 'var(--outline-variant)' }} />
              </>
            )}

            {/* Botão de Excluir em Massa */}
            {visibleBulkActions.delete !== false && (
              <button onClick={handleBulkDelete} title="Excluir tarefas" style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', color: '#ef4444', fontSize: '11px', fontWeight: 600 }}>
                <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>delete</span>
                Excluir
              </button>
            )}
          </div>

          <div style={{ width: '1px', height: '16px', background: 'var(--outline-variant)' }} />

          {/* Botão de Engrenagem de Configuração de Ações em Massa */}
          <div style={{ position: 'relative' }}>
            <button 
              onClick={() => setShowBulkSettingsDropdown(!showBulkSettingsDropdown)}
              title="Gerenciar Ações em Massa"
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '4px',
                borderRadius: '50%',
                color: 'var(--text-muted)'
              }}
              onMouseOver={(e) => e.currentTarget.style.color = 'var(--primary)'}
              onMouseOut={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>settings</span>
            </button>

            {showBulkSettingsDropdown && (
              <div style={{
                position: 'absolute',
                bottom: 'calc(100% + 8px)',
                right: 0,
                background: 'var(--surface)',
                border: '1px solid var(--outline-variant)',
                borderRadius: '8px',
                boxShadow: 'var(--shadow-lg)',
                padding: '8px',
                width: '180px',
                zIndex: 10000,
                display: 'flex',
                flexDirection: 'column',
                gap: '2px',
                textAlign: 'left'
              }}>
                <div style={{ fontSize: '9px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', padding: '4px 6px', borderBottom: '1px solid var(--outline-variant)', marginBottom: '4px' }}>Ações Visíveis</div>
                {[
                  { key: 'status', label: 'Status', icon: 'adjust' },
                  { key: 'cliente_ecosystem', label: 'Cliente', icon: 'group' },
                  { key: 'priority', label: 'Prioridade', icon: 'flag' },
                  { key: 'startDate', label: 'Data de Início', icon: 'calendar_today' },
                  { key: 'endDate', label: 'Prazo (Previsão)', icon: 'event' },
                  { key: 'financialValue', label: 'Valor', icon: 'payments' },
                  { key: 'delete', label: 'Excluir', icon: 'delete' }
                ].map(opt => (
                  <button
                    key={opt.key}
                    onClick={() => {
                      const updated = { ...visibleBulkActions, [opt.key]: !visibleBulkActions[opt.key] };
                      setVisibleBulkActions(updated);
                      localStorage.setItem('bulk_actions_visibility', JSON.stringify(updated));
                    }}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      borderRadius: '4px',
                      color: 'var(--text-on-surface)',
                      padding: '6px 8px',
                      fontSize: '11px',
                      fontWeight: 500,
                      textAlign: 'left',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      width: '100%'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.background = 'var(--surface-hover)'}
                    onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '14px', color: 'var(--text-muted)' }}>{opt.icon}</span>
                      <span>{opt.label}</span>
                    </div>
                    <span className="material-symbols-outlined" style={{ fontSize: '15px', color: visibleBulkActions[opt.key] ? 'var(--primary)' : 'var(--text-muted)' }}>
                      {visibleBulkActions[opt.key] ? 'check_box' : 'check_box_outline_blank'}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
          
          <button onClick={handleClearSelection} title="Limpar Seleção" style={{ background: 'var(--surface-low)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px', borderRadius: '50%', color: 'var(--text-muted)' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>close</span>
          </button>
        </div>
        ) : null,
        bulkToolbarContainerRef.current!
      )}


      {/* BARRA DE FERRAMENTAS ULTRA-MINIMALISTA CLICKUP */}
      <div style={{
        padding: '6px 36px',
        background: 'transparent',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        height: '32px',
        position: 'relative',
        zIndex: 50,
        marginBottom: '4px'
      }}>
        {/* Lado Esquerdo: Estatísticas rápidas de tarefas */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted-dark)', letterSpacing: '-0.1px' }}>
            {visibleTasks.length} tarefas
          </span>
          {!isReadOnly && (
            <button
              onClick={() => handleTriggerAddTask(null)}
              title="Nova tarefa principal"
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                borderRadius: '50%',
                padding: '4px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '24px',
                width: '24px'
              }}
              onMouseOver={(e) => e.currentTarget.style.color = 'var(--primary)'}
              onMouseOut={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>add</span>
            </button>
          )}
        </div>

        {/* Lado Direito: Sequência de Ícones Ultra-Minimalistas (sem textos!) */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>

          {/* Lupa de busca compacta ClickUp-Style (Apenas o ícone puro!) */}
          <div style={{ position: 'relative' }} ref={searchInputRef}>
            <button
              onClick={() => setShowSearchInput(!showSearchInput)}
              title="Pesquisar tarefas"
              style={{
                background: showSearchInput || searchQuery ? 'var(--primary-light)' : 'transparent',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                padding: '4px',
                cursor: 'pointer',
                color: showSearchInput || searchQuery ? 'var(--primary)' : 'var(--text-muted)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '24px',
                width: '24px'
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '17px' }}>search</span>
            </button>

            {showSearchInput && (
              <div style={{
                position: 'absolute',
                top: 'calc(100% + 4px)',
                right: 0,
                background: 'var(--surface)',
                border: '1px solid var(--outline-variant)',
                borderRadius: 'var(--radius-sm)',
                boxShadow: 'var(--shadow-md)',
                padding: '4px 6px',
                zIndex: 500,
                display: 'flex',
                alignItems: 'center',
                width: '180px'
              }}>
                <span className="material-symbols-outlined" style={{ fontSize: '13px', color: 'var(--text-muted)', marginRight: '4px' }}>search</span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Pesquisar..."
                  autoFocus
                  style={{
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    fontSize: '11px',
                    color: 'var(--text-on-surface)',
                    width: '100%'
                  }}
                />
                {searchQuery && (
                  <span
                    onClick={() => { setSearchQuery(''); setShowSearchInput(false); }}
                    className="material-symbols-outlined"
                    style={{ fontSize: '12px', color: 'var(--text-muted)', cursor: 'pointer' }}
                  >
                    close
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Indicador de Filtro por Etiqueta Ativo */}
          {selectedTagFilter && (() => {
            const saved = localStorage.getItem('taskmaster_global_tags');
            const globalTags = saved ? JSON.parse(saved) : [];
            const matchedTag = globalTags.find((t: any) => t.id === selectedTagFilter);
            if (!matchedTag) return null;
            return (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: 'var(--surface-variant, rgba(95, 85, 236, 0.15))',
                border: `1px solid ${matchedTag.color || '#5f55ec'}`,
                borderRadius: '16px',
                padding: '3px 10px',
                fontSize: '10px',
                color: 'var(--text-on-surface)',
                fontWeight: 600,
                boxShadow: 'var(--shadow-sm)'
              }}>
                <span style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: matchedTag.color || '#5f55ec'
                }} />
                <span>Etiqueta: {matchedTag.name}</span>
                <span
                  onClick={() => setSelectedTagFilter(null)}
                  className="material-symbols-outlined"
                  style={{ fontSize: '11px', cursor: 'pointer', opacity: 0.8, color: 'var(--text-muted)' }}
                  onMouseOver={(e) => e.currentTarget.style.opacity = '1'}
                  onMouseOut={(e) => e.currentTarget.style.opacity = '0.8'}
                >
                  close
                </span>
              </div>
            );
          })()}

          {/* Filtro minimalista (Apenas o ícone puro!) */}
          <div style={{ position: 'relative' }} ref={filterRef}>
            <button
              onClick={() => setShowFilterDropdown(!showFilterDropdown)}
              title="Filtros"
              style={{
                background: showFilterDropdown || hasActiveFilters ? 'var(--primary-light)' : 'transparent',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                padding: '4px',
                cursor: 'pointer',
                color: showFilterDropdown || hasActiveFilters ? 'var(--primary)' : 'var(--text-muted)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '24px',
                width: '24px'
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>filter_list</span>
            </button>

            {/* DROPDOWN DE FILTROS SUSPENSO CLICKUP-STYLE */}
            {showFilterDropdown && (
              <div style={{
                position: 'absolute',
                top: 'calc(100% + 4px)',
                right: 0,
                background: 'var(--surface)',
                border: '1px solid var(--outline-variant)',
                borderRadius: 'var(--radius-md)',
                boxShadow: 'var(--shadow-lg)',
                padding: '12px',
                width: '260px',
                zIndex: 9999,
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-on-surface)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '14px', color: 'var(--text-muted)' }}>info</span>
                    Filtros
                  </span>
                  {hasActiveFilters && (
                    <button
                      onClick={clearFilters}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--primary)',
                        fontSize: '10px',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      Limpar Tudo
                    </button>
                  )}
                </div>

                <div>
                  <label style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
                    Filtrar por Status
                  </label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {(['Todos', 'A Fazer', 'Em Execução', 'Pendente', 'Concluído'] as const).map(status => {
                      const isActive = statusFilter === status;
                      return (
                        <button
                          key={status}
                          onClick={() => setStatusFilter(status)}
                          style={{
                            background: isActive ? 'var(--primary-light)' : 'transparent',
                            border: 'none',
                            borderRadius: 'var(--radius-sm)',
                            color: isActive ? 'var(--text-on-surface)' : 'var(--text-muted-dark)',
                            padding: '6px 8px',
                            fontSize: '11px',
                            fontWeight: isActive ? 600 : 500,
                            textAlign: 'left',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            width: '100%'
                          }}
                          onMouseOver={(e) => {
                            if (!isActive) e.currentTarget.style.background = 'var(--surface-low)';
                          }}
                          onMouseOut={(e) => {
                            if (!isActive) e.currentTarget.style.background = 'transparent';
                          }}
                        >
                          <span>{status === 'Todos' ? 'Todos os Status' : status}</span>
                          {isActive && (
                            <span className="material-symbols-outlined" style={{ fontSize: '12px', color: 'var(--primary)' }}>check</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Mostrar/Ocultar tarefas fechadas (Círculo de Check e Close inteligente ClickUp!) */}
          <button
            onClick={() => setShowClosedTasks(!showClosedTasks)}
            title="Mostrar rapidamente tarefas fechadas"
            style={{
              background: showClosedTasks ? 'rgba(123, 104, 238, 0.12)' : 'transparent',
              border: showClosedTasks ? '1px solid var(--primary)' : 'none',
              borderRadius: '12px',
              padding: showClosedTasks ? '2px 8px' : '4px',
              height: '24px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              transition: 'all 0.2s',
            }}
          >
            <span
              className="material-symbols-outlined"
              style={{
                fontSize: '16px',
                color: showClosedTasks ? 'var(--primary)' : 'var(--text-muted)',
                display: 'inline-flex',
                alignItems: 'center'
              }}
            >
              check_circle
            </span>
            {showClosedTasks && (
              <span
                className="material-symbols-outlined"
                style={{
                  fontSize: '11px',
                  color: 'var(--text-muted)',
                  display: 'inline-flex',
                  alignItems: 'center'
                }}
              >
                close
              </span>
            )}
          </button>

          {/* DUAS BOLINHAS CONNECTADAS (Schema) - Dropdown de Subtarefas */}
          <div style={{ position: 'relative' }} ref={subtasksRef}>
            <button
              onClick={() => setShowSubtasksDropdown(!showSubtasksDropdown)}
              title="Mostrar subtarefas"
              style={{
                background: showSubtasksDropdown ? 'rgba(255, 255, 255, 0.05)' : 'transparent',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                padding: '4px',
                cursor: 'pointer',
                color: 'var(--text-muted)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '24px',
                width: '24px'
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '17px', transform: 'scaleX(-1)', display: 'inline-block' }}>schema</span>
            </button>

            {showSubtasksDropdown && (
              <div style={{
                position: 'absolute',
                top: 'calc(100% + 4px)',
                right: 0,
                background: 'var(--surface)',
                border: '1px solid var(--outline-variant)',
                borderRadius: 'var(--radius-md)',
                boxShadow: 'var(--shadow-lg)',
                padding: '8px',
                width: '220px',
                zIndex: 9999,
                display: 'flex',
                flexDirection: 'column',
                gap: '4px'
              }}>
                <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', padding: '4px 6px' }}>
                  Mostrar subtarefas
                </div>
                <button
                  onClick={() => {
                    setSubtaskVisibilityMode('recolhidas');
                    handleCollapseAll();
                    setShowSubtasksDropdown(false);
                  }}
                  style={{
                    background: subtaskVisibilityMode === 'recolhidas' ? 'var(--primary-light)' : 'transparent',
                    border: 'none',
                    borderRadius: 'var(--radius-sm)',
                    color: subtaskVisibilityMode === 'recolhidas' ? 'var(--text-on-surface)' : 'var(--text-muted-dark)',
                    padding: '6px 8px',
                    fontSize: '11px',
                    fontWeight: subtaskVisibilityMode === 'recolhidas' ? 600 : 500,
                    textAlign: 'left',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%'
                  }}
                >
                  <span>Recolhidas <span style={{ opacity: 0.6 }}>(padrão)</span></span>
                  {subtaskVisibilityMode === 'recolhidas' && (
                    <span className="material-symbols-outlined" style={{ fontSize: '12px', color: 'var(--primary)' }}>check</span>
                  )}
                </button>

                <button
                  onClick={() => {
                    setSubtaskVisibilityMode('expandidas');
                    handleExpandAll();
                    setShowSubtasksDropdown(false);
                  }}
                  style={{
                    background: subtaskVisibilityMode === 'expandidas' ? 'var(--primary-light)' : 'transparent',
                    border: 'none',
                    borderRadius: 'var(--radius-sm)',
                    color: subtaskVisibilityMode === 'expandidas' ? 'var(--text-on-surface)' : 'var(--text-muted-dark)',
                    padding: '6px 8px',
                    fontSize: '11px',
                    fontWeight: subtaskVisibilityMode === 'expandidas' ? 600 : 500,
                    textAlign: 'left',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%'
                  }}
                >
                  <span>Expandidas</span>
                  {subtaskVisibilityMode === 'expandidas' && (
                    <span className="material-symbols-outlined" style={{ fontSize: '12px', color: 'var(--primary)' }}>check</span>
                  )}
                </button>

                <button
                  onClick={() => {
                    setSubtaskVisibilityMode('separar');
                    setShowSubtasksDropdown(false);
                  }}
                  style={{
                    background: subtaskVisibilityMode === 'separar' ? 'var(--primary-light)' : 'transparent',
                    border: 'none',
                    borderRadius: 'var(--radius-sm)',
                    color: subtaskVisibilityMode === 'separar' ? 'var(--text-on-surface)' : 'var(--text-muted-dark)',
                    padding: '6px 8px',
                    fontSize: '11px',
                    fontWeight: subtaskVisibilityMode === 'separar' ? 600 : 500,
                    textAlign: 'left',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%',
                    borderTop: '1px solid var(--outline)',
                    marginTop: '4px',
                    paddingTop: '8px'
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span>Separar</span>
                    <span style={{ fontSize: '9px', opacity: 0.7, fontWeight: 400 }}>Usar isto para filtrar subtarefas (lista geral)</span>
                  </div>
                  {subtaskVisibilityMode === 'separar' && (
                    <span className="material-symbols-outlined" style={{ fontSize: '12px', color: 'var(--primary)' }}>check</span>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Colunas (Apenas o lindo ícone splitscreen/view_week sem texto!) */}
          <div style={{ position: 'relative' }} ref={columnRef}>
            <button
              onClick={() => setShowColumnDropdown(!showColumnDropdown)}
              title="Campos e Colunas"
              style={{
                background: showColumnDropdown ? 'rgba(255, 255, 255, 0.05)' : 'transparent',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                padding: '4px',
                cursor: 'pointer',
                color: 'var(--text-muted)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '24px',
                width: '24px'
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '17px' }}>view_week</span>
            </button>

            {/* PAINEL DE CAMPOS CLICKUP-STYLE SUSPENSO */}
            {showColumnDropdown && (
              <div style={{
                position: 'absolute',
                top: 'calc(100% + 4px)',
                right: 0,
                background: 'var(--surface)',
                border: '1px solid var(--outline-variant)',
                borderRadius: 'var(--radius-md)',
                boxShadow: 'var(--shadow-lg)',
                padding: '12px',
                width: '270px',
                zIndex: 9999,
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}>
                {/* CABEÇALHO DO DROPDOWN */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--outline)', paddingBottom: '6px' }}>
                  {showManageFieldsPanel ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <button
                        onClick={() => { setShowManageFieldsPanel(false); setRenamingFieldKey(null); }}
                        title="Voltar para campos ativos"
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          color: 'var(--text-muted)',
                          padding: '2px',
                          borderRadius: '4px'
                        }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>arrow_back</span>
                      </button>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-on-surface)' }}>Gerenciar Campos</span>
                    </div>
                  ) : showCreateFieldPanel ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {selectedFieldType !== null ? (
                        <>
                          <button
                            onClick={() => setSelectedFieldType(null)}
                            title="Voltar para lista de tipos"
                            style={{
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              color: 'var(--text-muted)',
                              padding: '2px',
                              borderRadius: '4px'
                            }}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>arrow_back</span>
                          </button>
                          <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-on-surface)', textTransform: 'capitalize' }}>
                            {AVAILABLE_FIELD_TYPES.find(f => f.type === selectedFieldType)?.label}
                          </span>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => setShowCreateFieldPanel(false)}
                            title="Voltar para campos ativos"
                            style={{
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              color: 'var(--text-muted)',
                              padding: '2px',
                              borderRadius: '4px'
                            }}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>arrow_back</span>
                          </button>
                          <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-on-surface)' }}>Campos</span>
                        </>
                      )}
                    </div>
                  ) : (
                    <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-on-surface)' }}>Campos</span>
                  )}

                  {!showCreateFieldPanel && !showManageFieldsPanel && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      {/* Botão de Adicionar Campo */}
                      <button
                        onClick={() => setShowCreateFieldPanel(true)}
                        title="Criar Novo Campo"
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          color: 'var(--text-muted)',
                          padding: '2px',
                          borderRadius: '4px',
                          transition: 'color 0.2s'
                        }}
                        onMouseOver={(e) => e.currentTarget.style.color = 'var(--primary)'}
                        onMouseOut={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>add</span>
                      </button>

                      {/* Botão de Engrenagem (Gerenciar) */}
                      <button
                        onClick={() => setShowManageFieldsPanel(true)}
                        title="Gerenciar Campos"
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          color: 'var(--text-muted)',
                          padding: '2px',
                          borderRadius: '4px',
                          transition: 'color 0.2s'
                        }}
                        onMouseOver={(e) => e.currentTarget.style.color = 'var(--primary)'}
                        onMouseOut={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>settings</span>
                      </button>
                    </div>
                  )}

                  {showCreateFieldPanel && selectedFieldType !== null && (
                    <button
                      onClick={() => {
                        setShowCreateFieldPanel(false);
                        setSelectedFieldType(null);
                      }}
                      title="Fechar"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', color: 'var(--text-muted)', padding: '2px', borderRadius: '4px' }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>close</span>
                    </button>
                  )}
                </div>

                {showManageFieldsPanel ? (
                  /* PAINEL DE GERENCIAMENTO E RENOMEAÇÃO DE CAMPOS */
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>
                      Clique no lápis para renomear
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '220px', overflowY: 'auto' }}>
                      {filteredColumnsList.map(col => {
                        const label = nativeColumnNames[col.key] || col.label;
                        const isEditing = renamingFieldKey === col.key;
                        return (
                          <div key={col.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 6px', background: 'var(--surface-low)', borderRadius: 'var(--radius-sm)', minHeight: '28px' }}>
                            {isEditing ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', width: '100%' }}>
                                <input
                                  type="text" value={tempRenameValue} onChange={(e) => setTempRenameValue(e.target.value)} autoFocus onFocus={(e) => e.target.select()}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      if (tempRenameValue.trim()) {
                                        const updated = { ...nativeColumnNames, [col.key]: tempRenameValue.trim() };
                                        setNativeColumnNames(updated);
                                        localStorage.setItem(`col_label_${col.key}`, tempRenameValue.trim());
                                      }
                                      setRenamingFieldKey(null);
                                    } else if (e.key === 'Escape') setRenamingFieldKey(null);
                                  }}
                                  style={{ background: 'var(--surface)', border: '1px solid var(--primary)', borderRadius: 'var(--radius-xs)', padding: '2px 4px', fontSize: '11px', color: 'var(--text-on-surface)', outline: 'none', width: '100%' }}
                                />
                                <button onClick={() => { if (tempRenameValue.trim()) { const updated = { ...nativeColumnNames, [col.key]: tempRenameValue.trim() }; setNativeColumnNames(updated); localStorage.setItem(`col_label_${col.key}`, tempRenameValue.trim()); } setRenamingFieldKey(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#10b981', padding: '2px' }}><span className="material-symbols-outlined" style={{ fontSize: '14px' }}>check</span></button>
                                <button onClick={() => setRenamingFieldKey(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', color: 'var(--text-muted)', padding: '2px' }}><span className="material-symbols-outlined" style={{ fontSize: '14px' }}>close</span></button>
                              </div>
                            ) : (
                              <>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-on-surface)', fontSize: '12px' }}>
                                  <span className="material-symbols-outlined" style={{ fontSize: '14px', color: 'var(--text-muted)' }}>{col.icon}</span>
                                  <span style={{ fontWeight: 500 }}>{label}</span>
                                </div>
                                <button onClick={() => { setRenamingFieldKey(col.key); setTempRenameValue(label); }} title="Renomear campo" style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', color: 'var(--text-muted)' }} onMouseOver={(e) => e.currentTarget.style.color = 'var(--primary)'} onMouseOut={(e) => e.currentTarget.style.color = 'var(--text-muted)'}><span className="material-symbols-outlined" style={{ fontSize: '13px' }}>edit</span></button>
                              </>
                            )}
                          </div>
                        );
                      })}
                      {customFields.map(field => {
                        const isEditing = renamingFieldKey === field.key;
                        return (
                          <React.Fragment key={field.key}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 6px', background: 'var(--surface-low)', borderRadius: 'var(--radius-sm)', minHeight: '28px' }}>
                            {isEditing ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', width: '100%' }}>
                                <input
                                  type="text" value={tempRenameValue} onChange={(e) => setTempRenameValue(e.target.value)} autoFocus onFocus={(e) => e.target.select()}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      if (tempRenameValue.trim() && tempRenameValue.trim() !== field.label) {
                                        const updatedFields = customFields.map(f => f.key === field.key ? { ...f, label: tempRenameValue.trim() } : f);
                                        setCustomFields(updatedFields); localStorage.setItem('custom_fields_list', JSON.stringify(updatedFields));
                                      }
                                      setRenamingFieldKey(null);
                                    } else if (e.key === 'Escape') setRenamingFieldKey(null);
                                  }}
                                  style={{ background: 'var(--surface)', border: '1px solid var(--primary)', borderRadius: 'var(--radius-xs)', padding: '2px 4px', fontSize: '11px', color: 'var(--text-on-surface)', outline: 'none', width: '100%' }}
                                />
                                <button onClick={() => { if (tempRenameValue.trim() && tempRenameValue.trim() !== field.label) { const updatedFields = customFields.map(f => f.key === field.key ? { ...f, label: tempRenameValue.trim() } : f); setCustomFields(updatedFields); localStorage.setItem('custom_fields_list', JSON.stringify(updatedFields)); } setRenamingFieldKey(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#10b981', padding: '2px' }}><span className="material-symbols-outlined" style={{ fontSize: '14px' }}>check</span></button>
                                <button onClick={() => setRenamingFieldKey(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', color: 'var(--text-muted)', padding: '2px' }}><span className="material-symbols-outlined" style={{ fontSize: '14px' }}>close</span></button>
                              </div>
                            ) : (
                              <>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-on-surface)', fontSize: '12px', minWidth: 0 }}>
                                  <span className="material-symbols-outlined" style={{ fontSize: '14px', color: 'var(--text-muted)', flexShrink: 0 }}>{field.icon}</span>
                                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }}>{field.label}</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  {!field.isSystemDefault && (
                                    <>
                                      <button onClick={() => { setRenamingFieldKey(field.key); setTempRenameValue(field.label); }} title="Renomear campo" style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', color: 'var(--text-muted)' }} onMouseOver={(e) => e.currentTarget.style.color = 'var(--primary)'} onMouseOut={(e) => e.currentTarget.style.color = 'var(--text-muted)'}><span className="material-symbols-outlined" style={{ fontSize: '13px' }}>edit</span></button>
                                      <button onClick={() => handleDeleteCustomField(field.key)} title="Excluir campo" style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', color: 'var(--text-muted)' }} onMouseOver={(e) => e.currentTarget.style.color = '#ef4444'} onMouseOut={(e) => e.currentTarget.style.color = 'var(--text-muted)'}><span className="material-symbols-outlined" style={{ fontSize: '13px' }}>delete</span></button>
                                    </>
                                  )}
                                </div>
                              </>
                            )}
                            </div>
                            {field.key === 'cliente_ecosystem' && (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingLeft: 8, marginTop: -4 }}>
                                {[...new Set(tasks.map(t => t.client_name).filter(Boolean))].map(client => {
                                  const currentColor = field.optionColors?.[client] || '#6366f1';
                                  const pickerKey = `mgmt_${client}`;
                                  return (
                                    <div key={client} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 6px', background: 'var(--surface)', borderRadius: 4 }}>
                                      <div style={{ position: 'relative', flexShrink: 0 }}>
                                        <button onClick={() => setInlineColorPickerFor(inlineColorPickerFor === pickerKey ? null : pickerKey)} style={{ width: 14, height: 14, borderRadius: 4, background: currentColor, border: '1px solid var(--outline)', cursor: 'pointer' }} />
                                        {inlineColorPickerFor === pickerKey && (<>
                                          <div onClick={() => setInlineColorPickerFor(null)} style={{ position: 'fixed', inset: 0, zIndex: 999 }} />
                                          <div style={{ position: 'absolute', top: '18px', left: 0, zIndex: 1000, background: 'var(--surface)', border: '1px solid var(--outline)', borderRadius: 8, padding: 8, boxShadow: '0 4px 20px rgba(0,0,0,0.5)', display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 5 }}>
                                            {PALETTE.map(c => <button key={c} onClick={() => { const updated = customFields.map(f => f.key === 'cliente_ecosystem' ? { ...f, optionColors: { ...(f.optionColors || {}), [client]: c } } : f); setCustomFields(updated); localStorage.setItem('custom_fields_list', JSON.stringify(updated)); setInlineColorPickerFor(null); }} style={{ width: 20, height: 20, borderRadius: '50%', background: c, border: currentColor === c ? '3px solid var(--text-on-surface)' : '2px solid transparent', cursor: 'pointer' }} />)}
                                          </div>
                                        </>)}
                                      </div>
                                      <span style={{ fontSize: '11px', color: 'var(--text-on-surface)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{client}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </div>
                  </div>
                ) : showCreateFieldPanel ? (
                  selectedFieldType === null ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', background: 'var(--surface-low)', border: '1px solid var(--outline)', borderRadius: 'var(--radius-sm)', padding: '4px 8px' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '14px', color: 'var(--text-muted)', marginRight: '6px' }}>search</span>
                        <input type="text" value={searchNewFieldQuery} onChange={(e) => setSearchNewFieldQuery(e.target.value)} placeholder="Pesquise campos novos..." style={{ background: 'transparent', border: 'none', outline: 'none', fontSize: '12px', color: 'var(--text-on-surface)', width: '100%' }} />
                      </div>
                      <div style={{ display: 'flex', borderBottom: '1px solid var(--outline-variant)', gap: '8px' }}>
                        <button onClick={() => setActiveTab('criar')} style={{ background: 'none', border: 'none', borderBottom: activeTab === 'criar' ? '2px solid var(--primary)' : '2px solid transparent', color: activeTab === 'criar' ? 'var(--text-on-surface)' : 'var(--text-muted)', fontSize: '11px', fontWeight: 600, padding: '6px 4px', cursor: 'pointer' }}>Criar novo</button>
                        <button onClick={() => setActiveTab('adicionar')} style={{ background: 'none', border: 'none', borderBottom: activeTab === 'adicionar' ? '2px solid var(--primary)' : '2px solid transparent', color: activeTab === 'adicionar' ? 'var(--text-on-surface)' : 'var(--text-muted)', fontSize: '11px', fontWeight: 600, padding: '6px 4px', cursor: 'pointer' }}>Adicionar existente</button>
                      </div>
                      {activeTab === 'criar' ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '250px', overflowY: 'auto', paddingRight: '2px' }}>
                          {AVAILABLE_FIELD_TYPES.filter(f => !searchNewFieldQuery || f.label.toLowerCase().includes(searchNewFieldQuery.toLowerCase())).map(field => (
                            <button key={field.type} onClick={() => setSelectedFieldType(field.type)} style={{ background: 'transparent', border: 'none', borderRadius: 'var(--radius-sm)', color: 'var(--text-on-surface)', padding: '6px 8px', fontSize: '12px', fontWeight: 500, textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }} onMouseOver={(e) => e.currentTarget.style.background = 'var(--surface-low)'} onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}>
                              <span className="material-symbols-outlined" style={{ fontSize: '15px', color: 'var(--primary)' }}>{field.icon}</span>
                              <span>{field.label}</span>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '250px', overflowY: 'auto', paddingRight: '2px' }}>
                          {customFields.filter(f => visibleCustomColumns[f.key] === false).map(f => (
                            <button key={f.key} onClick={() => { const u = { ...visibleCustomColumns, [f.key]: true }; setVisibleCustomColumns(u); localStorage.setItem('custom_fields_visibility', JSON.stringify(u)); }} style={{ background: 'transparent', border: 'none', borderRadius: 'var(--radius-sm)', color: 'var(--text-on-surface)', padding: '6px 8px', fontSize: '12px', fontWeight: 500, textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }} onMouseOver={(e) => e.currentTarget.style.background = 'var(--surface-low)'} onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}>
                              <span className="material-symbols-outlined" style={{ fontSize: '15px', color: 'var(--text-muted)' }}>{f.icon}</span>
                              <span>{f.label}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)' }}>Nome do campo</label>
                        <input type="text" value={editingField ? editFieldName : newFieldName} onChange={(e) => editingField ? setEditFieldName(e.target.value) : setNewFieldName(e.target.value)} placeholder="EX: Telefone Alternativo" style={{ background: 'var(--surface-low)', border: '1px solid var(--outline)', borderRadius: 'var(--radius-sm)', padding: '6px 10px', fontSize: '12px', color: 'var(--text-on-surface)', outline: 'none' }} />
                      </div>
                      <button onClick={() => setExpandMoreConfigs(!expandMoreConfigs)} style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: '10px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '4px 0', width: 'fit-content' }}>
                        {expandMoreConfigs ? 'Ocultar configurações avançadas' : 'Expandir configurações avançadas'}
                        <span className="material-symbols-outlined" style={{ fontSize: '12px', marginLeft: '2px' }}>{expandMoreConfigs ? 'expand_less' : 'expand_more'}</span>
                      </button>
                      {expandMoreConfigs && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', borderTop: '1px solid var(--outline)', paddingTop: '6px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <label style={{ fontSize: '9px', fontWeight: 700, color: 'var(--text-muted)' }}>Descrição do campo</label>
                            <input type="text" value={newFieldDescription} onChange={(e) => setNewFieldDescription(e.target.value)} placeholder="Para que serve este campo?" style={{ background: 'var(--surface-low)', border: '1px solid var(--outline)', borderRadius: 'var(--radius-sm)', padding: '4px 6px', fontSize: '11px', color: 'var(--text-on-surface)', outline: 'none' }} />
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <label style={{ fontSize: '9px', fontWeight: 700, color: 'var(--text-muted)' }}>Valor padrão (Opcional)</label>
                            <input type="text" value={newFieldDefaultValue} onChange={(e) => setNewFieldDefaultValue(e.target.value)} placeholder="Preencher automaticamente com..." style={{ background: 'var(--surface-low)', border: '1px solid var(--outline)', borderRadius: 'var(--radius-sm)', padding: '4px 6px', fontSize: '11px', color: 'var(--text-on-surface)', outline: 'none' }} />
                          </div>
                        </div>
                      )}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px', borderTop: '1px solid var(--outline)', paddingTop: '8px' }}>
                        {editingField && (<button onClick={() => handleDeleteCustomField(editingField.key)} style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}>Excluir</button>)}
                        <div style={{ display: 'flex', gap: '6px', marginLeft: 'auto' }}>
                          <button onClick={() => { if (editingField) { setEditingField(null); setEditFieldName(''); setSelectedFieldType(null); setNewFieldDescription(''); setNewFieldDefaultValue(''); setNewFieldIsRequired(false); setNewFieldIsPinned(false); } else { setSelectedFieldType(null); } }} style={{ background: 'transparent', border: '1px solid var(--outline)', borderRadius: 'var(--radius-sm)', color: 'var(--text-on-surface)', padding: '5px 12px', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}>Cancelar</button>
                          <button onClick={editingField ? handleSaveEditField : handleCreateCustomField} disabled={editingField ? !editFieldName.trim() : !newFieldName.trim()} style={{ background: (editingField ? editFieldName.trim() : newFieldName.trim()) ? 'var(--primary)' : 'rgba(123, 104, 238, 0.4)', border: 'none', borderRadius: 'var(--radius-sm)', color: '#ffffff', padding: '5px 12px', fontSize: '11px', fontWeight: 600, cursor: (editingField ? editFieldName.trim() : newFieldName.trim()) ? 'pointer' : 'not-allowed', transition: 'background 0.2s' }}>{editingField ? 'Salvar' : 'Criar'}</button>
                        </div>
                      </div>
                    </div>
                  )
                ) : (
                  /* LISTA PADRÃO DE TOGGLES DE COLUNAS (SEM ENGRENAGENS!) */
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', background: 'var(--surface-low)', border: '1px solid var(--outline)', borderRadius: 'var(--radius-sm)', padding: '4px 8px' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '14px', color: 'var(--text-muted)', marginRight: '6px' }}>search</span>
                      <input type="text" value={searchColumnQuery} onChange={(e) => setSearchColumnQuery(e.target.value)} placeholder="Pesquise campos..." style={{ background: 'transparent', border: 'none', outline: 'none', fontSize: '12px', color: 'var(--text-on-surface)', width: '100%' }} />
                    </div>
                    <div>
                      <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>Mostrados ou Ocultados</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '200px', overflowY: 'auto' }}>
                        {filteredColumnsList.map(col => {
                          const isShown = visibleColumns[col.key];
                          const label = nativeColumnNames[col.key] || col.label;
                          return (
                            <div key={col.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 6px', borderRadius: 'var(--radius-sm)' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-on-surface)', fontSize: '12px' }}>
                                <span className="material-symbols-outlined" style={{ fontSize: '14px', color: 'var(--text-muted)' }}>{col.icon}</span>
                                <span>{label}</span>
                              </div>
                              <div onClick={() => toggleColumn(col.key)} style={{ width: '26px', height: '14px', background: isShown ? 'var(--primary)' : 'var(--outline-variant)', borderRadius: '7px', position: 'relative', cursor: 'pointer', transition: 'background 0.2s' }}>
                                <div style={{ width: '10px', height: '10px', background: '#ffffff', borderRadius: '50%', position: 'absolute', top: '2px', left: isShown ? '14px' : '2px', transition: 'left 0.2s' }} />
                              </div>
                            </div>
                          );
                        })}
                        {customFields.filter(f => !searchColumnQuery || f.label.toLowerCase().includes(searchColumnQuery.toLowerCase())).map(field => {
                          const isShown = visibleCustomColumns[field.key] !== false;
                          return (
                            <div key={field.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 6px', borderRadius: 'var(--radius-sm)' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-on-surface)', fontSize: '12px', minWidth: 0 }}>
                                <span className="material-symbols-outlined" style={{ fontSize: '14px', color: 'var(--text-muted)', flexShrink: 0 }}>{field.icon}</span>
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{field.label}</span>
                              </div>
                              <div onClick={() => { const updated = { ...visibleCustomColumns, [field.key]: !isShown }; setVisibleCustomColumns(updated); localStorage.setItem('custom_fields_visibility', JSON.stringify(updated)); }} style={{ width: '26px', height: '14px', background: isShown ? 'var(--primary)' : 'var(--outline-variant)', borderRadius: '7px', position: 'relative', cursor: 'pointer', transition: 'background 0.2s' }}>
                                <div style={{ width: '10px', height: '10px', background: '#ffffff', borderRadius: '50%', position: 'absolute', top: '2px', left: isShown ? '14px' : '2px', transition: 'left 0.2s' }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Botão + minimalista de criar raiz - Apenas o ícone + puro! (Gestor apenas) */}
          {!isReadOnly && (
            <button
              onClick={() => handleTriggerAddTask(null)}
              title="Criar Tarefa Raiz"
              style={{
                background: 'transparent',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-muted)',
                padding: '4px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '24px',
                width: '24px'
              }}
              onMouseOver={(e) => e.currentTarget.style.color = 'var(--primary)'}
              onMouseOut={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>add</span>
            </button>
          )}
        </div>
      </div>

      {/* Grid de Dados da Tabela */}
      <div style={{ overflow: 'visible', paddingLeft: '36px', paddingRight: '36px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', tableLayout: 'fixed' }}>
          <thead>
            <tr style={{
              background: 'transparent',
              borderBottom: '1px solid var(--outline-variant)',
              height: '30px'
            }}>
              <th onClick={() => handleSortCol('taskName')} style={{ width: columnWidths.taskName, position: 'relative', padding: '0 8px 0 16px', fontSize: '10px', fontWeight: 600, color: sortCol === 'taskName' ? 'var(--primary)' : 'var(--text-muted)', cursor: 'pointer', userSelect: 'none' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                  Nome da Tarefa / Etapa
                  {sortCol === 'taskName' && <span className="material-symbols-outlined" style={{ fontSize: '11px' }}>{sortDir === 'asc' ? 'arrow_upward' : 'arrow_downward'}</span>}
                </span>
                <div
                  onMouseDown={(e) => { e.stopPropagation(); handleResizeStart(e, 'taskName'); }}
                  style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '4px', cursor: 'col-resize', zIndex: 10, background: 'transparent', transition: 'background 0.2s' }}
                  onMouseOver={(e) => e.currentTarget.style.background = 'rgba(123, 104, 238, 0.2)'}
                  onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                />
              </th>

              {getOrderedColumns().map(key => {
                const sortableNativeCols: Record<string, string | undefined> = {
                  progress: 'progress',
                  status: 'status', startDate: 'startDate', endDate: 'endDate',
                  financialValue: 'financialValue', priority: 'priority',
                };

                const nativeVisMap: Record<string, boolean | undefined> = {
                  progress: visibleColumns.progress, status: visibleColumns.status,
                  startDate: visibleColumns.startDate, endDate: visibleColumns.endDate,
                  financialValue: visibleColumns.financialValue, priority: visibleColumns.priority,
                };

                if (key in nativeVisMap && nativeVisMap[key]) {
                  const sortKey = sortableNativeCols[key];
                  const colWidth = (columnWidths as any)[key] || 100;
                  const isSort = sortCol === sortKey;
                  return (
                    <th
                      key={key}
                      draggable
                      onDragStart={(e) => handleColumnDragStart(e, key)}
                      onDragOver={handleColumnDragOver}
                      onDrop={(e) => handleColumnDrop(e, key)}
                      onClick={() => sortKey && handleSortCol(sortKey)}
                      style={{ width: colWidth, position: 'relative', padding: '0 8px', fontSize: '10px', fontWeight: 600, color: isSort ? 'var(--primary)' : 'var(--text-muted)', textAlign: 'left', cursor: sortKey ? 'pointer' : 'grab', userSelect: 'none' }}
                    >
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                        {(nativeColumnNames as any)[key]}
                        {isSort && <span className="material-symbols-outlined" style={{ fontSize: '11px' }}>{sortDir === 'asc' ? 'arrow_upward' : 'arrow_downward'}</span>}
                      </span>
                      <div
                        onMouseDown={(e) => { e.stopPropagation(); handleResizeStart(e, key); }}
                        style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '4px', cursor: 'col-resize', zIndex: 10, background: 'transparent', transition: 'background 0.2s' }}
                        onMouseOver={(e) => e.currentTarget.style.background = 'rgba(123, 104, 238, 0.2)'}
                        onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                      />
                    </th>
                  );
                }

                const field = customFields.find(f => f.key === key);
                if (field) {
                  const isShown = visibleCustomColumns[field.key] !== false;
                  if (!isShown) return null;
                  const colWidth = columnWidths[field.key] || 120;
                  const sortKey = field.key === 'cliente_ecosystem' ? 'cliente_ecosystem' : field.key;
                  const isSort = sortCol === sortKey;
                  return (
                    <th
                      key={field.key}
                      draggable
                      onDragStart={(e) => handleColumnDragStart(e, field.key)}
                      onDragOver={handleColumnDragOver}
                      onDrop={(e) => handleColumnDrop(e, field.key)}
                      onClick={() => handleSortCol(sortKey)}
                      style={{ width: colWidth, maxWidth: colWidth, position: 'relative', padding: '0 8px', fontSize: '10px', fontWeight: 600, color: isSort ? 'var(--primary)' : 'var(--text-muted)', cursor: 'pointer', userSelect: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', boxSizing: 'border-box' }}
                    >
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                        {field.label}
                        {isSort && <span className="material-symbols-outlined" style={{ fontSize: '11px' }}>{sortDir === 'asc' ? 'arrow_upward' : 'arrow_downward'}</span>}
                      </span>
                      <div
                        onMouseDown={(e) => { e.stopPropagation(); handleResizeStart(e, field.key); }}
                        style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '4px', cursor: 'col-resize', zIndex: 10, background: 'transparent', transition: 'background 0.2s' }}
                        onMouseOver={(e) => e.currentTarget.style.background = 'rgba(123, 104, 238, 0.2)'}
                        onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                      />
                    </th>
                  );
                }

                return null;
              })}

              <th ref={headerPlusRef} style={{ width: '40px', padding: '0 8px', textAlign: 'center', position: 'relative' }}>
                <button 
                  onClick={() => setShowHeaderPlusDropdown(!showHeaderPlusDropdown)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '4px'
                  }}
                  title="Adicionar/Gerenciar Campos"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                    add_circle
                  </span>
                </button>

                {/* DROPDOWN DE COLUNAS/CAMPOS DIRECTO DO HEADER `+` */}
                {showHeaderPlusDropdown && (
                  <div style={{
                    position: 'absolute',
                    top: 'calc(100% + 4px)',
                    right: 0,
                    background: 'var(--surface)',
                    border: '1px solid var(--outline-variant)',
                    borderRadius: 'var(--radius-md)',
                    boxShadow: 'var(--shadow-lg)',
                    padding: '12px',
                    width: '270px',
                    zIndex: 9999,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    textAlign: 'left'
                  }}>
                    {/* CABEÇALHO DO DROPDOWN */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--outline)', paddingBottom: '6px' }}>
                      {showManageFieldsPanel ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <button
                            onClick={() => { setShowManageFieldsPanel(false); setRenamingFieldKey(null); }}
                            title="Voltar para campos ativos"
                            style={{
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              color: 'var(--text-muted)',
                              padding: '2px',
                              borderRadius: '4px'
                            }}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>arrow_back</span>
                          </button>
                          <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-on-surface)' }}>Gerenciar Campos</span>
                        </div>
                      ) : showCreateFieldPanel ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {selectedFieldType !== null ? (
                            <>
                              <button
                                onClick={() => setSelectedFieldType(null)}
                                title="Voltar para lista de tipos"
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  color: 'var(--text-muted)',
                                  padding: '2px',
                                  borderRadius: '4px'
                                }}
                              >
                                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>arrow_back</span>
                              </button>
                              <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-on-surface)', textTransform: 'capitalize' }}>
                                {AVAILABLE_FIELD_TYPES.find(f => f.type === selectedFieldType)?.label}
                              </span>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => setShowCreateFieldPanel(false)}
                                title="Voltar para campos ativos"
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  color: 'var(--text-muted)',
                                  padding: '2px',
                                  borderRadius: '4px'
                                }}
                              >
                                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>arrow_back</span>
                              </button>
                              <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-on-surface)' }}>Campos</span>
                            </>
                          )}
                        </div>
                      ) : (
                        <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-on-surface)' }}>Campos</span>
                      )}

                      {!showCreateFieldPanel && !showManageFieldsPanel && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <button
                            onClick={() => setShowCreateFieldPanel(true)}
                            title="Criar Novo Campo"
                            style={{
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              color: 'var(--primary)',
                              padding: '2px',
                              borderRadius: '4px'
                            }}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>add</span>
                          </button>
                          <button
                            onClick={() => setShowManageFieldsPanel(true)}
                            title="Organizar/Renomear Campos"
                            style={{
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              color: 'var(--text-muted)',
                              padding: '2px',
                              borderRadius: '4px'
                            }}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>settings</span>
                          </button>
                        </div>
                      )}
                    </div>

                    {/* CONTEÚDO DO DROPDOWN REAPROVEITADO DO CLICKUP-STYLE */}
                    {showManageFieldsPanel ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '250px', overflowY: 'auto' }}>
                        <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', padding: '4px 6px' }}>Colunas Padrão</div>
                        {columnsList.map(col => {
                          const isRenaming = renamingFieldKey === col.key;
                          return (
                            <div key={col.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 6px', background: 'var(--surface-low)', borderRadius: 'var(--radius-sm)', minHeight: '28px' }}>
                              {isRenaming ? (
                                <input
                                  type="text"
                                  value={tempRenameValue}
                                  onChange={(e) => setTempRenameValue(e.target.value)}
                                  autoFocus
                                  style={{ background: 'var(--surface)', border: '1px solid var(--primary)', borderRadius: 'var(--radius-xs)', padding: '2px 4px', fontSize: '11px', color: 'var(--text-on-surface)', outline: 'none', width: '100%' }}
                                />
                              ) : (
                                <span style={{ fontSize: '11px', color: 'var(--text-on-surface)' }}>{nativeColumnNames[col.key]}</span>
                              )}
                              <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                                {isRenaming ? (
                                  <>
                                    <button onClick={() => { if (tempRenameValue.trim()) { const updated = { ...nativeColumnNames, [col.key]: tempRenameValue.trim() }; setNativeColumnNames(updated); localStorage.setItem(`col_label_${col.key}`, tempRenameValue.trim()); } setRenamingFieldKey(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#10b981', padding: '2px' }}><span className="material-symbols-outlined" style={{ fontSize: '14px' }}>check</span></button>
                                    <button onClick={() => setRenamingFieldKey(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', color: 'var(--text-muted)', padding: '2px' }}><span className="material-symbols-outlined" style={{ fontSize: '14px' }}>close</span></button>
                                  </>
                                ) : (
                                  <button onClick={() => { setRenamingFieldKey(col.key); setTempRenameValue(nativeColumnNames[col.key]); }} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', color: 'var(--text-muted)', padding: '2px' }} title="Renomear coluna"><span className="material-symbols-outlined" style={{ fontSize: '13px' }}>edit</span></button>
                                )}
                              </div>
                            </div>
                          );
                        })}

                        <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', padding: '4px 6px', marginTop: '6px' }}>Campos Personalizados</div>
                        {customFields.map(field => {
                          const isRenaming = renamingFieldKey === field.key;
                          return (
                            <React.Fragment key={field.key}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 6px', background: 'var(--surface-low)', borderRadius: 'var(--radius-sm)', minHeight: '28px' }}>
                              {isRenaming ? (
                                <input
                                  type="text"
                                  value={tempRenameValue}
                                  onChange={(e) => setTempRenameValue(e.target.value)}
                                  autoFocus
                                  style={{ background: 'var(--surface)', border: '1px solid var(--primary)', borderRadius: 'var(--radius-xs)', padding: '2px 4px', fontSize: '11px', color: 'var(--text-on-surface)', outline: 'none', width: '100%' }}
                                />
                              ) : (
                                <span style={{ fontSize: '11px', color: 'var(--text-on-surface)' }}>{field.label}</span>
                              )}
                              <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                                {isRenaming ? (
                                  <>
                                    <button onClick={() => { if (tempRenameValue.trim() && tempRenameValue.trim() !== field.label) { const updatedFields = customFields.map(f => f.key === field.key ? { ...f, label: tempRenameValue.trim() } : f); setCustomFields(updatedFields); localStorage.setItem('custom_fields_list', JSON.stringify(updatedFields)); } setRenamingFieldKey(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#10b981', padding: '2px' }}><span className="material-symbols-outlined" style={{ fontSize: '14px' }}>check</span></button>
                                    <button onClick={() => setRenamingFieldKey(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', color: 'var(--text-muted)', padding: '2px' }}><span className="material-symbols-outlined" style={{ fontSize: '14px' }}>close</span></button>
                                  </>
                                ) : (
                                  <>
                                    {!field.isSystemDefault && (
                                      <>
                                        <button onClick={() => { setRenamingFieldKey(field.key); setTempRenameValue(field.label); }} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', color: 'var(--text-muted)', padding: '2px' }} title="Renomear campo"><span className="material-symbols-outlined" style={{ fontSize: '13px' }}>edit</span></button>
                                        <button onClick={() => handleDeleteCustomField(field.key)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#ef4444', padding: '2px' }} title="Excluir campo"><span className="material-symbols-outlined" style={{ fontSize: '13px' }}>delete</span></button>
                                      </>
                                    )}
                                  </>
                                )}
                              </div>
                              </div>
                              {field.key === 'cliente_ecosystem' && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingLeft: 8, marginTop: -4 }}>
                                  {[...new Set(tasks.map(t => t.client_name).filter(Boolean))].map(client => {
                                    const currentColor = field.optionColors?.[client] || '#6366f1';
                                    return (
                                      <label key={client} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, padding: '4px 6px', background: 'var(--surface)', borderRadius: 4, userSelect: 'none' as const }}>
                                        <div style={{ width: 14, height: 14, borderRadius: 4, background: currentColor, border: '1px solid var(--outline)', flexShrink: 0 }} />
                                        <span style={{ fontSize: '11px', color: 'var(--text-on-surface)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{client}</span>
                                        <input type="color" value={currentColor} onChange={(e) => { const updated = customFields.map(f => f.key === 'cliente_ecosystem' ? { ...f, optionColors: { ...(f.optionColors || {}), [client]: e.target.value } } : f); setCustomFields(updated); localStorage.setItem('custom_fields_list', JSON.stringify(updated)); }} style={{ width: 0, height: 0, opacity: 0, position: 'absolute', pointerEvents: 'none' as const }} />
                                      </label>
                                    );
                                  })}
                                </div>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </div>
                    ) : showCreateFieldPanel ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {selectedFieldType === null ? (
                          <>
                            <div style={{ display: 'flex', alignItems: 'center', background: 'var(--surface-low)', border: '1px solid var(--outline)', borderRadius: 'var(--radius-sm)', padding: '4px 8px' }}>
                              <span className="material-symbols-outlined" style={{ fontSize: '14px', color: 'var(--text-muted)', marginRight: '6px' }}>search</span>
                              <input type="text" value={searchNewFieldQuery} onChange={(e) => setSearchNewFieldQuery(e.target.value)} placeholder="Pesquisar tipos de campos..." style={{ background: 'transparent', border: 'none', fontSize: '11px', color: 'var(--text-on-surface)', outline: 'none', width: '100%' }} />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', maxHeight: '180px', overflowY: 'auto', marginTop: '4px' }}>
                              {AVAILABLE_FIELD_TYPES.filter(t => t.label.toLowerCase().includes(searchNewFieldQuery.toLowerCase())).map(field => (
                                <button key={field.type} onClick={() => setSelectedFieldType(field.type)} style={{ background: 'transparent', border: 'none', borderRadius: 'var(--radius-sm)', color: 'var(--text-on-surface)', padding: '6px 8px', fontSize: '12px', fontWeight: 500, textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }} onMouseOver={(e) => e.currentTarget.style.background = 'var(--surface-low)'} onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}>
                                  <span className="material-symbols-outlined" style={{ color: field.color, fontSize: '16px' }}>{field.icon}</span>
                                  <span>{field.label}</span>
                                </button>
                              ))}
                            </div>
                          </>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <label style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)' }}>Nome do Campo</label>
                              <input type="text" value={editingField ? editFieldName : newFieldName} onChange={(e) => editingField ? setEditFieldName(e.target.value) : setNewFieldName(e.target.value)} placeholder="EX: Telefone Alternativo" style={{ background: 'var(--surface-low)', border: '1px solid var(--outline)', borderRadius: 'var(--radius-sm)', padding: '6px 10px', fontSize: '12px', color: 'var(--text-on-surface)', outline: 'none' }} />
                            </div>
                            <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', marginTop: '6px' }}>
                              <button onClick={() => { setSelectedFieldType(null); }} style={{ background: 'transparent', border: '1px solid var(--outline)', borderRadius: 'var(--radius-sm)', color: 'var(--text-on-surface)', padding: '5px 12px', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}>Voltar</button>
                              <button onClick={handleCreateCustomField} disabled={!newFieldName.trim()} style={{ background: newFieldName.trim() ? 'var(--primary)' : 'rgba(123, 104, 238, 0.4)', border: 'none', borderRadius: 'var(--radius-sm)', color: '#ffffff', padding: '5px 12px', fontSize: '11px', fontWeight: 600, cursor: newFieldName.trim() ? 'pointer' : 'not-allowed' }}>Criar</button>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {/* BUSCA DE COLUNAS */}
                        <div style={{ display: 'flex', alignItems: 'center', background: 'var(--surface-low)', border: '1px solid var(--outline)', borderRadius: 'var(--radius-sm)', padding: '4px 8px' }}>
                          <span className="material-symbols-outlined" style={{ fontSize: '14px', color: 'var(--text-muted)', marginRight: '6px' }}>search</span>
                          <input type="text" value={searchColumnQuery} onChange={(e) => setSearchColumnQuery(e.target.value)} placeholder="Mostrar/ocultar colunas..." style={{ background: 'transparent', border: 'none', fontSize: '11px', color: 'var(--text-on-surface)', outline: 'none', width: '100%' }} />
                        </div>

                        {/* LISTA DE COLUNAS HABILITADAS / DESABILITADAS COM CHECKBOX */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', maxHeight: '200px', overflowY: 'auto' }}>
                          {/* Colunas Padrão */}
                          {columnsList.filter(col => col.label.toLowerCase().includes(searchColumnQuery.toLowerCase())).map(col => {
                            const isShown = visibleColumns[col.key];
                            return (
                              <button
                                key={col.key}
                                onClick={() => {
                                  const updated = { ...visibleColumns, [col.key]: !isShown };
                                  setVisibleColumns(updated);
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
                                  justifyContent: 'space-between'
                                }}
                                onMouseOver={(e) => e.currentTarget.style.background = 'var(--surface-low)'}
                                onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span className="material-symbols-outlined" style={{ fontSize: '15px', color: 'var(--text-muted)' }}>{col.icon}</span>
                                  <span>{nativeColumnNames[col.key]}</span>
                                </div>
                                <span className="material-symbols-outlined" style={{ fontSize: '16px', color: isShown ? 'var(--primary)' : 'var(--text-muted)' }}>
                                  {isShown ? 'check_box' : 'check_box_outline_blank'}
                                </span>
                              </button>
                            );
                          })}

                          {/* Campos Personalizados */}
                          {customFields.filter(f => f.label.toLowerCase().includes(searchColumnQuery.toLowerCase())).map(field => {
                            const isShown = visibleCustomColumns[field.key] !== false;
                            return (
                              <button
                                key={field.key}
                                onClick={() => {
                                  const updated = { ...visibleCustomColumns, [field.key]: !isShown };
                                  setVisibleCustomColumns(updated);
                                  localStorage.setItem('custom_fields_visibility', JSON.stringify(updated));
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
                                  justifyContent: 'space-between'
                                }}
                                onMouseOver={(e) => e.currentTarget.style.background = 'var(--surface-low)'}
                                onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span className="material-symbols-outlined" style={{ fontSize: '15px', color: 'var(--text-muted)' }}>{field.icon}</span>
                                  <span>{field.label}</span>
                                </div>
                                <span className="material-symbols-outlined" style={{ fontSize: '16px', color: isShown ? 'var(--primary)' : 'var(--text-muted)' }}>
                                  {isShown ? 'check_box' : 'check_box_outline_blank'}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </th>
              {/* Coluna vazia para absorver a largura restante da tela (Mantém as colunas de dados com sua largura fixa) */}
              <th style={{ width: 'auto' }} />
            </tr>
          </thead>

          <tbody>

            {visibleTasks.length > 0 ? (
              visibleTasks.map((task, index) => {
                const hasChildren = tasks.some(t => t.parent_id === task.id);
                const isExpanded = !!expandedTasks[task.id];
                const progress = getTaskProgress(task);
                const nextTask = visibleTasks[index + 1];

                // Mostra o QuickAdd de subtarefa após o ÚLTIMO descendente visível do pai,
                // não imediatamente após o próprio pai (evita aparecer acima dos filhos existentes)
                const isLastVisibleDescendant =
                  quickAddParentId !== null &&
                  quickAddParentId !== undefined &&
                  (task.path_route?.includes(quickAddParentId as string)) &&
                  (!nextTask || !(nextTask.path_route?.includes(quickAddParentId as string)));

                return (
                  <React.Fragment key={task.id}>
                    <TaskRow
                      task={task}
                      hasChildren={hasChildren}
                      isExpanded={isExpanded}
                      progress={progress}
                      subtasksCount={tasks.filter(t => t.parent_id === task.id).length}
                      visibleColumns={visibleColumns}
                      customStatuses={customStatuses}
                      onUpdateTaskStatus={onUpdateTaskStatus || (async () => { })}
                      onToggleExpand={handleToggleExpand}
                      onAddTask={handleTriggerAddTask}
                      onEditTask={onEditTask}
                      onDeleteTask={onDeleteTask}
                      isReadOnly={isReadOnly}
                      isFlatMode={subtaskVisibilityMode === 'separar'}
                      customFields={customFields.map(f => f.key === 'cliente_ecosystem' ? { ...f, options: [...new Set(tasks.map(t => t.client_name).filter(Boolean))] } : f)}
                      visibleCustomColumns={visibleCustomColumns}
                      allTasks={tasks}
                      columnWidths={columnWidths}
                      columnOrder={getOrderedColumns()}
                      onUpdateTaskField={onUpdateTaskField}
                      isSelected={selectedTaskIds.includes(task.id)}
                      onToggleSelect={handleToggleSelect}
                      onDragStart={(id) => setDraggedTaskId(id)}
                      onDragOver={(id, relX) => { setDragOverTaskId(id); setDragOverRelativeX(relX); }}
                      onDrop={handleDropTask}
                      onDragEnd={() => { setDraggedTaskId(null); setDragOverTaskId(null); setDragOverRelativeX(0); }}
                      draggedTaskId={draggedTaskId}
                      activeThreeDotsTaskId={activeThreeDotsTaskId}
                      setActiveThreeDotsTaskId={setActiveThreeDotsTaskId}
                      onFilterByTag={setSelectedTagFilter}
                      onShareClient={onShareClient}
                    />

                    {/* Indicador visual de drop (linha ClickUp-style) */}
                    {dragOverTaskId === task.id && draggedTaskId && draggedTaskId !== task.id && (() => {
                      const subtaskThreshold = (task.level || 0) * 22 + 80;
                      const isSubtask = dragOverRelativeX > subtaskThreshold;
                      const dropLevel = isSubtask ? (task.level || 0) + 1 : (task.level || 0);
                      const indentPx = dropLevel * 22 + 36;
                      const color = isSubtask ? '#22c55e' : 'var(--primary)';
                      return (
                        <tr key="drop-indicator" style={{ height: 0, pointerEvents: 'none' }}>
                          <td colSpan={activeColsCount + 2} style={{ padding: 0, height: 0, position: 'relative', overflow: 'visible' }}>
                            <div style={{ position: 'absolute', left: indentPx, right: 4, height: 2, background: color, top: -1, zIndex: 200, borderRadius: 1, transition: 'left 0.12s ease' }}>
                              <div style={{ position: 'absolute', left: -4, top: -3, width: 8, height: 8, borderRadius: '50%', background: color }} />
                            </div>
                          </td>
                        </tr>
                      );
                    })()}

                    {/* QuickAdd de subtarefa: aparece depois de todos os filhos existentes do pai */}
                    {isLastVisibleDescendant && (
                      <QuickAddRow
                        level={(tasks.find(t => t.id === quickAddParentId)?.level ?? 0) + 1}
                        activeColsCount={activeColsCount + 2}
                        onSave={(desc) => handleSaveQuickAdd(desc, quickAddParentId as string)}
                        onCancel={() => setQuickAddParentId(undefined)}
                      />
                    )}
                  </React.Fragment>
                );
              })
            ) : (
              quickAddParentId === undefined && (
                <tr>
                  <td
                    colSpan={activeColsCount + 2}
                    style={{
                      padding: '36px 16px',
                      textAlign: 'center',
                      color: 'var(--text-muted)',
                      fontSize: '13px'
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '36px', color: 'var(--outline-variant)', marginBottom: '8px', display: 'block' }}>
                      assignment_late
                    </span>
                    Nenhuma tarefa corresponde aos filtros aplicados.
                  </td>
                </tr>
              )
            )}

            {/* Quick Add no final da lista — aparece abaixo de todas as tarefas */}
            {quickAddParentId === null && (
              <QuickAddRow
                level={0}
                activeColsCount={activeColsCount + 2}
                onSave={(desc) => handleSaveQuickAdd(desc, null)}
                onCancel={() => setQuickAddParentId(undefined)}
              />
            )}
          </tbody>
        </table>
      </div>

      {/* Botão de Adicionar Tarefa na parte inferior ClickUp-Style */}
      {!isReadOnly && (
        <div style={{ padding: '8px 12px', display: 'flex', alignItems: 'center' }}>
          <button
            onClick={() => handleTriggerAddTask(null)}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              fontSize: '13px',
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
              padding: '6px 8px',
              borderRadius: 'var(--radius-sm)',
              transition: 'background 0.2s, color 0.2s'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
              e.currentTarget.style.color = 'var(--text-on-surface)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = 'var(--text-muted)';
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>add</span>
            Adicionar Tarefa
          </button>
        </div>
      )}

    </div>
  );
};
