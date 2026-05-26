import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { SideNavBar } from '../components/SideNavBar';
import { TaskModal, type ImplSplitData } from '../components/TaskModal';
import { supabaseService } from '../supabaseClient';
import type { Task } from '../types';

type ViewMode = 'list' | 'card';
type PayStatus = 'pendente' | 'recebido' | 'na';
type ImplSplit = ImplSplitData;

const PROJ_ARCHIVED_KEY = 'archived_projects';
const IMPL_SPLIT_KEY = 'project_impl_split';

const calcMonths = (startDateStr: string): number => {
  if (!startDateStr) return 0;
  const start = new Date(startDateStr + 'T00:00:00');
  const now = new Date();
  if (now < start) return 0;
  let months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
  if (now.getDate() >= start.getDate()) months++;
  return Math.max(0, months);
};

const calcNextDue = (startDateStr: string): string => {
  if (!startDateStr) return '';
  const start = new Date(startDateStr + 'T00:00:00');
  const months = calcMonths(startDateStr);
  const next = new Date(start);
  next.setMonth(next.getMonth() + months + 1);
  return next.toLocaleDateString('pt-BR');
};

const loadProjArchived = (): Set<string> => {
  try { return new Set(JSON.parse(localStorage.getItem(PROJ_ARCHIVED_KEY) || '[]')); } catch { return new Set(); }
};
const saveProjArchived = (s: Set<string>) =>
  localStorage.setItem(PROJ_ARCHIVED_KEY, JSON.stringify([...s]));

const loadImplSplit = (): Record<string, ImplSplit> => {
  try { return JSON.parse(localStorage.getItem(IMPL_SPLIT_KEY) || '{}'); } catch { return {}; }
};
const saveImplSplit = (data: Record<string, ImplSplit>) =>
  localStorage.setItem(IMPL_SPLIT_KEY, JSON.stringify(data));

const fmtBRL = (v: string | number) => {
  const n = typeof v === 'string' ? parseFloat(v) || 0 : v;
  return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
};

const parseBRL = (s: string): string => {
  const n = parseFloat(s.replace(/\./g, '').replace(',', '.'));
  return isNaN(n) || n <= 0 ? '' : n.toString();
};

// Campo de valor monetário — pill "↵ salvar" só aparece quando o valor mudou
const MoneyField: React.FC<{ value: string; onChange: (v: string) => void }> = ({ value, onChange }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [original, setOriginal] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const hasChanged = draft !== original;

  const startEdit = () => {
    const n = parseFloat(value) || 0;
    const initial = n > 0 ? fmtBRL(n) : '';
    setDraft(initial);
    setOriginal(initial);
    setEditing(true);
  };

  const doSave = () => { onChange(parseBRL(draft)); setEditing(false); };
  const doCancel = () => setEditing(false);

  useEffect(() => { if (editing) inputRef.current?.select(); }, [editing]);

  if (!editing) {
    const hasValue = !!value && parseFloat(value) > 0;
    return (
      <span onClick={startEdit} title="Clique para editar"
        style={{ fontSize: '12px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', borderBottom: '1px dashed var(--outline-variant)', paddingBottom: '1px', color: hasValue ? 'var(--text-on-surface)' : 'var(--text-muted)' }}>
        {hasValue ? fmtBRL(value) : '—'}
      </span>
    );
  }

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      {hasChanged && (
        <div
          onMouseDown={e => { e.preventDefault(); doSave(); }}
          style={{ position: 'absolute', bottom: 'calc(100% + 4px)', right: 0, display: 'inline-flex', alignItems: 'center', gap: '3px', background: '#10b981', color: '#fff', borderRadius: '99px', padding: '2px 9px', fontSize: '10px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', zIndex: 30, boxShadow: '0 2px 8px rgba(16,185,129,0.4)', userSelect: 'none' }}>
          ↵ salvar
        </div>
      )}
      <input
        ref={inputRef}
        type="text"
        autoFocus
        value={draft}
        onFocus={e => e.currentTarget.select()}
        onChange={e => setDraft(e.target.value)}
        onBlur={doSave}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); doSave(); } if (e.key === 'Escape') { e.preventDefault(); doCancel(); } }}
        style={{ width: '110px', background: 'var(--surface-low)', border: `1px solid ${hasChanged ? 'var(--primary)' : 'var(--outline)'}`, borderRadius: 'var(--radius-sm)', padding: '3px 8px', fontSize: '12px', fontWeight: 700, color: 'var(--text-on-surface)', outline: 'none', textAlign: 'right', transition: 'border-color 0.15s' }}
      />
    </div>
  );
};

// Converte ISO (yyyy-mm-dd) para [dd, mm, aaaa]
const isoToSegs = (iso: string): [string, string, string] => {
  if (!iso) return ['', '', ''];
  const [y, m, d] = iso.split('-');
  return [d || '', m || '', y || ''];
};

// Campo de data: inputs somente-leitura gerenciados via onKeyDown (imperativo, sem disputa de render)
const DateField: React.FC<{ value: string; onChange: (iso: string) => void; style?: React.CSSProperties }> = ({ value, onChange, style }) => {
  const dayRef  = useRef<HTMLInputElement>(null);
  const monRef  = useRef<HTMLInputElement>(null);
  const yearRef = useRef<HTMLInputElement>(null);
  const cbRef   = useRef(onChange);
  cbRef.current = onChange;

  useEffect(() => {
    const [d, m, y] = isoToSegs(value);
    if (dayRef.current)  dayRef.current.value  = d;
    if (monRef.current)  monRef.current.value  = m;
    if (yearRef.current) yearRef.current.value = y;
  }, [value]);

  const tryCommit = () => {
    const d = dayRef.current?.value  || '';
    const m = monRef.current?.value  || '';
    const y = yearRef.current?.value || '';
    if (d.length === 2 && m.length === 2 && y.length === 4) {
      const iso = `${y}-${m}-${d}`;
      if (!isNaN(new Date(iso + 'T00:00:00').getTime())) cbRef.current(iso);
    }
  };

  const pad2 = (ref: React.RefObject<HTMLInputElement | null>) => {
    if (ref.current && ref.current.value.length === 1)
      ref.current.value = ref.current.value.padStart(2, '0');
  };

  const makeKD = (
    ref: React.RefObject<HTMLInputElement | null>,
    maxLen: 2 | 4,
    next?: React.RefObject<HTMLInputElement | null>,
    prev?: React.RefObject<HTMLInputElement | null>
  ) => (e: React.KeyboardEvent<HTMLInputElement>) => {
    const inp = e.currentTarget;

    if (/^\d$/.test(e.key)) {
      e.preventDefault();
      const allSel = inp.selectionStart === 0 && inp.selectionEnd === inp.value.length;
      inp.value = (allSel || inp.value.length >= maxLen)
        ? e.key
        : (inp.value + e.key).slice(0, maxLen);
      tryCommit();
      if (inp.value.length === maxLen && next)
        setTimeout(() => { next.current?.focus(); next.current?.select(); }, 0);

    } else if (e.key === 'Tab' && !e.shiftKey && next) {
      e.preventDefault();
      if (maxLen === 2) pad2(ref);
      tryCommit();
      next.current?.focus(); next.current?.select();

    } else if (e.key === 'Tab' && e.shiftKey && prev) {
      e.preventDefault();
      prev.current?.focus(); prev.current?.select();

    } else if (e.key === 'Backspace') {
      e.preventDefault();
      if (inp.value === '' && prev) { prev.current?.focus(); prev.current?.select(); }
      else inp.value = inp.value.slice(0, -1);

    } else if (e.key === 'ArrowRight' && next) {
      e.preventDefault(); next.current?.focus(); next.current?.select();
    } else if (e.key === 'ArrowLeft' && prev) {
      e.preventDefault(); prev.current?.focus(); prev.current?.select();
    }
  };

  const segStyle: React.CSSProperties = {
    background: 'transparent', border: 'none', outline: 'none',
    fontSize: '11px', color: 'var(--text-on-surface)',
    textAlign: 'center', padding: 0, fontFamily: 'inherit', cursor: 'text',
  };

  const [initD, initM, initY] = isoToSegs(value);

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0px', background: 'var(--surface-low)', border: '1px solid var(--outline)', borderRadius: 'var(--radius-sm)', padding: '2px 6px', ...style }}>
      <input ref={dayRef} readOnly type="text" inputMode="numeric" placeholder="dd" defaultValue={initD}
        onKeyDown={makeKD(dayRef, 2, monRef)}
        onClick={e => (e.target as HTMLInputElement).select()}
        onFocus={e => e.target.select()}
        onBlur={() => { pad2(dayRef); tryCommit(); }}
        style={{ ...segStyle, width: '18px' }} />
      <span style={{ color: 'var(--text-muted)', fontSize: '10px', userSelect: 'none', padding: '0 1px' }}>/</span>
      <input ref={monRef} readOnly type="text" inputMode="numeric" placeholder="mm" defaultValue={initM}
        onKeyDown={makeKD(monRef, 2, yearRef, dayRef)}
        onClick={e => (e.target as HTMLInputElement).select()}
        onFocus={e => e.target.select()}
        onBlur={() => { pad2(monRef); tryCommit(); }}
        style={{ ...segStyle, width: '18px' }} />
      <span style={{ color: 'var(--text-muted)', fontSize: '10px', userSelect: 'none', padding: '0 1px' }}>/</span>
      <input ref={yearRef} readOnly type="text" inputMode="numeric" placeholder="aaaa" defaultValue={initY}
        onKeyDown={makeKD(yearRef, 4, undefined, monRef)}
        onClick={e => (e.target as HTMLInputElement).select()}
        onFocus={e => e.target.select()}
        onBlur={() => { tryCommit(); }}
        style={{ ...segStyle, width: '30px' }} />
      <div style={{ position: 'relative', width: '14px', height: '14px', marginLeft: '4px', flexShrink: 0 }}>
        <span className="material-symbols-outlined" style={{ fontSize: '13px', color: 'var(--text-muted)', position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', pointerEvents: 'none' }}>calendar_month</span>
        <input type="date" value={value || ''} onChange={e => onChange(e.target.value)}
          style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%', padding: 0 }} />
      </div>
    </div>
  );
};

export const Projects: React.FC = () => {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [showArchived, setShowArchived] = useState(false);
  const [archivedProjects, setArchivedProjects] = useState<Set<string>>(loadProjArchived);
  const [expandedProject, setExpandedProject] = useState<string | null>(null);
  const [implSplit, setImplSplit] = useState<Record<string, ImplSplit>>(loadImplSplit);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [deletingTaskId, setDeletingTaskId] = useState<string | null>(null);
  const [creatingProject, setCreatingProject] = useState(false);
  const [duplicatingTask, setDuplicatingTask] = useState<Task | null>(null);

  const rootTasks = tasks.filter(t => t.parent_id === null);

  const toggleArchive = (taskId: string) => {
    setArchivedProjects(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else { next.add(taskId); setExpandedProject(null); }
      saveProjArchived(next);
      return next;
    });
  };

  const refreshTasks = async () => {
    const uniqueNames = await supabaseService.fetchUniqueClients();
    const allResults = await Promise.all(uniqueNames.map(n => supabaseService.fetchTasksTree(n)));
    setTasks(allResults.flat());
  };

  const saveImplSplitForId = (id: string, split: ImplSplit) => {
    setImplSplit(prev => {
      const next = { ...prev, [id]: split };
      saveImplSplit(next);
      return next;
    });
  };

  const handleEditSubmit = async (data: any) => {
    if (!editingTask) return;
    try {
      await supabaseService.updateTask(editingTask.id, data);
      if (data.implSplit) saveImplSplitForId(editingTask.id, data.implSplit);
      await refreshTasks();
    } catch (e) { console.error(e); }
    setEditingTask(null);
  };

  const handleCreateProject = async (data: any) => {
    try {
      const created = await supabaseService.createTask({ ...data, parent_id: null });
      if (created?.id && data.implSplit) saveImplSplitForId(created.id, data.implSplit);
      await refreshTasks();
    } catch (e) { console.error(e); }
    setCreatingProject(false);
  };

  const handleDuplicateSubmit = async (data: any) => {
    try {
      const created = await supabaseService.createTask({ ...data, parent_id: null });
      if (created?.id && data.implSplit) saveImplSplitForId(created.id, data.implSplit);
      await refreshTasks();
    } catch (e) { console.error(e); }
    setDuplicatingTask(null);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingTaskId) return;
    try { await supabaseService.deleteTask(deletingTaskId); setTasks(prev => prev.filter(t => t.id !== deletingTaskId)); } catch (e) { console.error(e); }
    setDeletingTaskId(null);
  };

  const getImplSplit = (taskId: string): ImplSplit =>
    implSplit[taskId] || { entradaValue: '', entradaStatus: 'pendente', entradaDate: '', entregaValue: '', entregaStatus: 'pendente', entregaDate: '', mensalValue: '', mensalStartDate: '' };

  const updateImplSplit = (taskId: string, patch: Partial<ImplSplit>) => {
    setImplSplit(prev => {
      const next = { ...prev, [taskId]: { ...getImplSplit(taskId), ...patch } };
      saveImplSplit(next);
      return next;
    });
  };

  const togglePayStatus = (taskId: string, field: 'entradaStatus' | 'entregaStatus') => {
    const current = getImplSplit(taskId)[field];
    const cycle: PayStatus[] = ['pendente', 'recebido', 'na'];
    const newStatus = cycle[(cycle.indexOf(current) + 1) % cycle.length];
    const dateField = field === 'entradaStatus' ? 'entradaDate' : 'entregaDate';
    const today = new Date().toISOString().split('T')[0];
    const patch: Partial<ImplSplit> = { [field]: newStatus };
    if (newStatus === 'recebido' && !getImplSplit(taskId)[dateField]) {
      patch[dateField] = today;
    }
    if (field === 'entregaStatus' && newStatus === 'recebido' && !getImplSplit(taskId).mensalStartDate) {
      patch.mensalStartDate = today;
    }
    updateImplSplit(taskId, patch);
  };

  useEffect(() => {
    const fetchAllTasks = async () => {
      setLoading(true);
      try {
        const uniqueNames = await supabaseService.fetchUniqueClients();
        const allResults = await Promise.all(uniqueNames.map(n => supabaseService.fetchTasksTree(n)));
        const allTasks = allResults.flat();
        setTasks(allTasks);

        // Pré-preenche split 50/50 para root tasks que ainda não têm configuração
        const existing = loadImplSplit();
        const newSplit: Record<string, ImplSplit> = {};
        allTasks.filter(t => t.parent_id === null).forEach(task => {
          if (!existing[task.id] && task.contract_value > 0) {
            const half = (task.contract_value / 2).toFixed(2);
            newSplit[task.id] = { entradaValue: half, entradaStatus: 'pendente', entradaDate: '', entregaValue: half, entregaStatus: 'pendente', entregaDate: '', mensalValue: '', mensalStartDate: '' };
          }
        });
        if (Object.keys(newSplit).length > 0) {
          setImplSplit(prev => {
            const next = { ...newSplit, ...prev };
            saveImplSplit(next);
            return next;
          });
        }
      } catch (err) {
        console.error('Erro ao buscar tarefas:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchAllTasks();
  }, []);

  const getProjectStatsForTask = (taskId: string) => {
    const subtreeIds = new Set<string>([taskId]);
    let changed = true;
    while (changed) {
      changed = false;
      tasks.forEach(t => {
        if (t.parent_id && subtreeIds.has(t.parent_id) && !subtreeIds.has(t.id)) {
          subtreeIds.add(t.id);
          changed = true;
        }
      });
    }
    const projectTasks = tasks.filter(t => subtreeIds.has(t.id));
    const leafTasks = projectTasks.filter(t => !tasks.some(c => c.parent_id === t.id));
    const total = leafTasks.length;
    const completed = leafTasks.filter(t => t.status === 'Concluído').length;
    const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
    const budget = tasks.find(t => t.id === taskId)?.contract_value || 0;
    return { progress, budget, totalTasks: projectTasks.length, completedTasks: completed };
  };

  const fmt = (v: number) => fmtBRL(v);

  const ProgressBar = ({ progress }: { progress: number }) => (
    <div style={{ width: '100%', background: 'var(--surface-low)', height: '5px', borderRadius: '99px', overflow: 'hidden' }}>
      <div style={{ width: `${progress}%`, background: progress === 100 ? '#10b981' : 'var(--primary)', height: '100%', borderRadius: '99px', transition: 'width 0.4s ease' }} />
    </div>
  );

  const StatusBadge = ({ status, onClick }: { status: PayStatus; onClick: () => void }) => {
    const cfg = status === 'recebido'
      ? { bg: 'rgba(16,185,129,0.12)',  border: 'rgba(16,185,129,0.3)',  color: '#10b981', label: 'Recebido' }
      : status === 'na'
      ? { bg: 'rgba(107,114,128,0.10)', border: 'rgba(107,114,128,0.25)', color: 'var(--text-muted)', label: 'Isento' }
      : { bg: 'rgba(245,158,11,0.12)',  border: 'rgba(245,158,11,0.3)',  color: '#f59e0b', label: 'Pendente' };
    return (
    <button onClick={onClick} title="Clique para alternar (Pendente → Recebido → Isento)"
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '4px',
        background: cfg.bg, border: `1px solid ${cfg.border}`,
        borderRadius: '99px', padding: '2px 9px', cursor: 'pointer',
        fontSize: '11px', fontWeight: 700, whiteSpace: 'nowrap',
        color: cfg.color, transition: 'all 0.15s'
      }}>
      <span style={{ fontSize: '7px' }}>●</span>
      {cfg.label}
    </button>
  );
  };

  const PaymentPanel = ({ task }: { task: Task }) => {
    const split = getImplSplit(task.id);
    const implTotal = (parseFloat(split.entradaValue) || 0) + (parseFloat(split.entregaValue) || 0);
    const stats = getProjectStatsForTask(task.id);
    const isArchived = archivedProjects.has(task.id);

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>

        {/* 3 colunas compactas */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>

          {/* Progresso */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--outline)', borderRadius: 'var(--radius-md)', padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: '4px', justifyContent: 'center' }}>
            <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Progresso</span>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              <strong style={{ color: 'var(--text-on-surface)' }}>{stats.completedTasks}</strong>/{stats.totalTasks} subtarefas concluídas
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
              <div style={{ flex: 1 }}><ProgressBar progress={stats.progress} /></div>
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted-dark)' }}>{stats.progress}%</span>
            </div>
          </div>

          {/* Implantação */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--outline)', borderRadius: 'var(--radius-md)', padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Implantação</span>
              <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted-dark)' }}>{fmt(implTotal)}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px', paddingTop: '2px' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', minWidth: '44px' }}>Entrada</span>
              <MoneyField value={split.entradaValue} onChange={v => updateImplSplit(task.id, { entradaValue: v })} />
              <StatusBadge status={split.entradaStatus} onClick={() => togglePayStatus(task.id, 'entradaStatus')} />
            </div>
            {split.entradaStatus === 'recebido' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', paddingLeft: '44px' }}>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Data recebimento:</span>
                <input type="date" value={split.entradaDate} onChange={e => updateImplSplit(task.id, { entradaDate: e.target.value })}
                  style={{ fontSize: '11px', border: '1px solid var(--outline-variant)', borderRadius: 'var(--radius-sm)', padding: '2px 6px', background: 'var(--surface)', color: 'var(--text-on-surface)', outline: 'none' }} />
              </div>
            )}
            <div style={{ borderTop: '1px solid var(--outline)' }} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', minWidth: '44px' }}>Entrega</span>
              <MoneyField value={split.entregaValue} onChange={v => updateImplSplit(task.id, { entregaValue: v })} />
              <StatusBadge status={split.entregaStatus} onClick={() => togglePayStatus(task.id, 'entregaStatus')} />
            </div>
            {split.entregaStatus === 'recebido' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', paddingLeft: '44px' }}>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Data recebimento:</span>
                <input type="date" value={split.entregaDate} onChange={e => updateImplSplit(task.id, { entregaDate: e.target.value })}
                  style={{ fontSize: '11px', border: '1px solid var(--outline-variant)', borderRadius: 'var(--radius-sm)', padding: '2px 6px', background: 'var(--surface)', color: 'var(--text-on-surface)', outline: 'none' }} />
              </div>
            )}
          </div>

          {/* Mensalidade */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--outline)', borderRadius: 'var(--radius-md)', padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Mensalidade</span>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px', paddingTop: '2px' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', minWidth: '44px' }}>Valor/mês</span>
              <MoneyField value={split.mensalValue} onChange={v => updateImplSplit(task.id, { mensalValue: v })} />
            </div>
            <div style={{ borderTop: '1px solid var(--outline)' }} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', minWidth: '44px' }}>Início</span>
              <DateField value={split.mensalStartDate} onChange={v => updateImplSplit(task.id, { mensalStartDate: v })} />
            </div>
            {split.mensalStartDate && (parseFloat(split.mensalValue) || 0) > 0 && (() => {
              const months = calcMonths(split.mensalStartDate);
              const fee = parseFloat(split.mensalValue) || 0;
              return (
                <div style={{ borderTop: '1px solid var(--outline)', paddingTop: '4px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted-dark)' }}>
                    {months} {months === 1 ? 'mês' : 'meses'} · <strong style={{ color: '#10b981' }}>{fmt(months * fee)}</strong>
                  </span>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Próx.: {calcNextDue(split.mensalStartDate)}</div>
                </div>
              );
            })()}
          </div>
        </div>

        {/* Rodapé */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--outline)', paddingTop: '8px' }}>
          <button onClick={() => navigate(`/?client=${encodeURIComponent(task.client_name)}`)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: 'var(--primary-light)', border: '1px solid rgba(123,104,238,0.2)', borderRadius: 'var(--radius-md)', padding: '5px 12px', fontSize: '12px', fontWeight: 600, color: 'var(--primary)', cursor: 'pointer' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>task_alt</span>
            Ver Árvore de Tarefas
          </button>
          <button onClick={() => toggleArchive(task.id)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: isArchived ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.08)', border: `1px solid ${isArchived ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.2)'}`, borderRadius: 'var(--radius-md)', padding: '5px 12px', fontSize: '12px', fontWeight: 700, color: isArchived ? '#10b981' : '#ef4444', cursor: 'pointer' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>{isArchived ? 'unarchive' : 'archive'}</span>
            {isArchived ? 'Desarquivar' : 'Arquivar projeto'}
          </button>
        </div>
      </div>
    );
  };

  const RowMenu = ({ task }: { task: Task }) => {
    const isOpen = menuOpenId === task.id;
    const isArch = archivedProjects.has(task.id);
    const itemStyle: React.CSSProperties = {
      display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '8px 14px',
      background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '13px',
      fontWeight: 500, color: 'var(--text-on-surface)', textAlign: 'left', whiteSpace: 'nowrap',
    };
    return (
      <div style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
        <button onClick={() => setMenuOpenId(isOpen ? null : task.id)}
          style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', color: 'var(--text-muted)' }}
          onMouseOver={e => e.currentTarget.style.background = 'var(--surface-hover)'}
          onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>more_vert</span>
        </button>
        {isOpen && (
          <>
            <div style={{ position: 'fixed', inset: 0, zIndex: 49 }} onClick={() => setMenuOpenId(null)} />
            <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 4px)', zIndex: 50, background: 'var(--surface-high)', border: '1px solid var(--outline-variant)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-lg)', minWidth: '160px', overflow: 'hidden', padding: '4px 0' }}>
              <button style={itemStyle} onMouseOver={e => e.currentTarget.style.background = 'var(--surface-hover)'} onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                onClick={() => { setEditingTask(task); setMenuOpenId(null); }}>
                <span className="material-symbols-outlined" style={{ fontSize: '16px', color: 'var(--primary)' }}>edit</span>
                Editar
              </button>
              <button style={itemStyle} onMouseOver={e => e.currentTarget.style.background = 'var(--surface-hover)'} onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                onClick={() => { setDuplicatingTask(task); setMenuOpenId(null); }}>
                <span className="material-symbols-outlined" style={{ fontSize: '16px', color: 'var(--text-muted)' }}>content_copy</span>
                Duplicar
              </button>
              <button style={itemStyle} onMouseOver={e => e.currentTarget.style.background = 'var(--surface-hover)'} onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                onClick={() => { toggleArchive(task.id); setMenuOpenId(null); }}>
                <span className="material-symbols-outlined" style={{ fontSize: '16px', color: 'var(--text-muted)' }}>{isArch ? 'unarchive' : 'archive'}</span>
                {isArch ? 'Desarquivar' : 'Arquivar'}
              </button>
              <div style={{ borderTop: '1px solid var(--outline)', margin: '4px 0' }} />
              <button style={{ ...itemStyle, color: '#ef4444' }} onMouseOver={e => e.currentTarget.style.background = 'rgba(239,68,68,0.08)'} onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                onClick={() => { setDeletingTaskId(task.id); setMenuOpenId(null); }}>
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>delete</span>
                Excluir
              </button>
            </div>
          </>
        )}
      </div>
    );
  };

  const visibleList = rootTasks.filter(t => showArchived ? archivedProjects.has(t.id) : !archivedProjects.has(t.id));
  const archivedCount = rootTasks.filter(t => archivedProjects.has(t.id)).length;

  return (
    <div className="layout-container">
      <SideNavBar activePage="projects" />

      <main className="main-content" style={{ display: 'flex', flexDirection: 'column' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', borderBottom: '1px solid var(--outline)', paddingBottom: '16px' }}>
          <div>
            <h2 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-on-surface)' }}>
              {showArchived ? 'Projetos Arquivados' : 'Projetos Ativos'}
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Cronograma, pagamentos e evolução física de todos os contratos</p>
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button onClick={() => setCreatingProject(true)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'var(--primary)', border: 'none', borderRadius: 'var(--radius-md)', padding: '8px 14px', fontSize: '13px', fontWeight: 700, color: '#fff', cursor: 'pointer' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>add</span>
              Novo Projeto
            </button>
            {(archivedCount > 0 || showArchived) && (
              <button onClick={() => setShowArchived(v => !v)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: showArchived ? 'var(--surface-high)' : 'var(--surface-low)', border: '1px solid var(--outline)', borderRadius: 'var(--radius-md)', padding: '5px 12px', fontSize: '12px', fontWeight: 600, color: showArchived ? 'var(--text-on-surface)' : 'var(--text-muted)', cursor: 'pointer' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>{showArchived ? 'folder_open' : 'archive'}</span>
                {showArchived ? 'Ver ativos' : `Arquivados (${archivedCount})`}
              </button>
            )}
            <div style={{ display: 'flex', gap: '2px', background: 'var(--surface-low)', border: '1px solid var(--outline)', borderRadius: 'var(--radius-md)', padding: '3px' }}>
              {(['list', 'card'] as ViewMode[]).map(mode => (
                <button key={mode} onClick={() => { setViewMode(mode); setExpandedProject(null); }}
                  title={mode === 'list' ? 'Modo lista' : 'Modo cards'}
                  style={{ background: viewMode === mode ? 'var(--surface-high)' : 'transparent', border: viewMode === mode ? '1px solid var(--outline-variant)' : '1px solid transparent', borderRadius: 'var(--radius-sm)', color: viewMode === mode ? 'var(--text-on-surface)' : 'var(--text-muted)', width: '30px', height: '26px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s ease' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>{mode === 'list' ? 'view_list' : 'grid_view'}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {loading ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '300px', flexDirection: 'column', gap: '12px' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '48px', color: 'var(--primary)', animation: 'spin 1.5s linear infinite' }}>sync</span>
            <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>Consolidando dados dos projetos...</p>
            <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
          </div>

        ) : visibleList.length === 0 ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', minHeight: '200px', color: 'var(--text-muted)' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '48px' }}>inbox</span>
            <p style={{ fontSize: '14px' }}>{showArchived ? 'Nenhum projeto arquivado.' : 'Nenhum projeto ativo.'}</p>
          </div>

        ) : viewMode === 'list' ? (

          /* ── MODO LISTA COM EXPANSÃO ── */
          <div style={{ border: '1px solid var(--outline)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '32px 1fr 130px 120px 150px 170px 36px', padding: '8px 16px', background: 'var(--surface-low)', borderBottom: '1px solid var(--outline)' }}>
              {['', 'Projeto', 'Cliente', 'Tarefas', 'Orçamento', 'Evolução Física', ''].map((col, i) => (
                <span key={i} style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{col}</span>
              ))}
            </div>

            {visibleList.map((task, idx) => {
              const stats = getProjectStatsForTask(task.id);
              const isExpanded = expandedProject === task.id;
              const isArchived = archivedProjects.has(task.id);
              const isLast = idx === visibleList.length - 1;
              return (
                <React.Fragment key={task.id}>
                  <div
                    onClick={() => setExpandedProject(isExpanded ? null : task.id)}
                    style={{ display: 'grid', gridTemplateColumns: '32px 1fr 130px 120px 150px 170px 36px', padding: '13px 16px', alignItems: 'center', borderBottom: (isExpanded || !isLast) ? '1px solid var(--outline)' : 'none', background: isExpanded ? 'var(--surface-hover)' : 'var(--surface)', cursor: 'pointer', transition: 'background 0.12s', userSelect: 'none', opacity: isArchived ? 0.65 : 1 }}
                    onMouseOver={e => { if (!isExpanded) e.currentTarget.style.background = 'var(--surface-hover)'; }}
                    onMouseOut={e => { if (!isExpanded) e.currentTarget.style.background = 'var(--surface)'; }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--text-muted)', transition: 'transform 0.2s', transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>
                      chevron_right
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '18px', color: isArchived ? 'var(--text-muted)' : 'var(--primary)', flexShrink: 0 }}>
                        {isArchived ? 'archive' : 'folder_shared'}
                      </span>
                      <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-on-surface)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {task.description}
                      </span>
                    </div>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {task.client_name}
                    </span>
                    <div style={{ fontSize: '13px', color: 'var(--text-muted-dark)' }}>
                      <strong style={{ color: 'var(--text-on-surface)' }}>{stats.completedTasks}</strong>
                      <span style={{ color: 'var(--text-muted)' }}> / {stats.totalTasks}</span>
                    </div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--primary)' }}>{fmt(stats.budget)}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ flex: 1 }}><ProgressBar progress={stats.progress} /></div>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted-dark)', minWidth: '32px', textAlign: 'right' }}>{stats.progress}%</span>
                    </div>
                    <RowMenu task={task} />
                  </div>

                  {isExpanded && (
                    <div style={{ padding: '24px', background: 'var(--surface-low)', borderBottom: !isLast ? '1px solid var(--outline)' : 'none', animation: 'fadeInUp 0.18s ease' }}>
                      <PaymentPanel task={task} />
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>

        ) : (

          /* ── MODO CARD ── */
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '24px' }}>
            {visibleList.map(task => {
              const stats = getProjectStatsForTask(task.id);
              const split = getImplSplit(task.id);
              const implTotal = (parseFloat(split.entradaValue) || 0) + (parseFloat(split.entregaValue) || 0);
              const isArchived = archivedProjects.has(task.id);
              return (
                <div key={task.id} className="glass-card"
                  style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', position: 'relative', opacity: isArchived ? 0.75 : 1, transition: 'transform 0.15s, box-shadow 0.15s' }}
                  onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = 'var(--shadow-md)'; }}
                  onMouseOut={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <span style={{ background: 'var(--primary-light)', color: 'var(--primary)', fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: 'var(--radius-sm)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        {task.client_name}
                      </span>
                      <h3 style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text-on-surface)', marginTop: '8px' }}>{task.description}</h3>
                    </div>
                    <RowMenu task={task} />
                  </div>

                  <div style={{ borderTop: '1px solid var(--outline)', paddingTop: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted-dark)', marginBottom: '6px' }}>
                      <span>EVOLUÇÃO FÍSICA</span><span>{stats.progress}%</span>
                    </div>
                    <ProgressBar progress={stats.progress} />
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '5px' }}>{stats.completedTasks} de {stats.totalTasks} tarefas concluídas</p>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>IMPLANTAÇÃO</p>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--primary)' }}>Total: {fmt(implTotal)}</span>
                    </div>
                    <div style={{ background: 'var(--surface)', border: '1px solid var(--outline)', borderRadius: 'var(--radius-md)', padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', minWidth: '52px' }}>Entrada</span>
                        <MoneyField value={split.entradaValue} onChange={v => updateImplSplit(task.id, { entradaValue: v })} />
                        <StatusBadge status={split.entradaStatus} onClick={() => togglePayStatus(task.id, 'entradaStatus')} />
                      </div>
                      <div style={{ borderTop: '1px solid var(--outline)' }} />
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', minWidth: '52px' }}>Entrega</span>
                        <MoneyField value={split.entregaValue} onChange={v => updateImplSplit(task.id, { entregaValue: v })} />
                        <StatusBadge status={split.entregaStatus} onClick={() => togglePayStatus(task.id, 'entregaStatus')} />
                      </div>
                    </div>
                  </div>

                  {/* Mensalidade no card */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>MENSALIDADE</p>
                    <div style={{ background: 'var(--surface)', border: '1px solid var(--outline)', borderRadius: 'var(--radius-md)', padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Valor/mês</span>
                        <MoneyField value={split.mensalValue} onChange={v => updateImplSplit(task.id, { mensalValue: v })} />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Início</span>
                        <DateField value={split.mensalStartDate} onChange={v => updateImplSplit(task.id, { mensalStartDate: v })} style={{ width: '110px' }} />
                      </div>
                      {split.mensalStartDate && (parseFloat(split.mensalValue) || 0) > 0 && (() => {
                        const months = calcMonths(split.mensalStartDate);
                        const fee = parseFloat(split.mensalValue) || 0;
                        return (
                          <p style={{ fontSize: '12px', color: 'var(--text-muted-dark)', borderTop: '1px solid var(--outline)', paddingTop: '6px' }}>
                            {months} {months === 1 ? 'mês' : 'meses'} · <strong style={{ color: '#10b981' }}>{fmt(months * fee)}</strong> acumulado
                          </p>
                        );
                      })()}
                    </div>
                  </div>

                  <button onClick={() => navigate(`/?client=${encodeURIComponent(task.client_name)}`)}
                    style={{ width: '100%', background: 'var(--surface)', border: '1px solid var(--outline)', borderRadius: 'var(--radius-md)', padding: '10px', fontSize: '13px', fontWeight: 600, color: 'var(--primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'background 0.2s, border-color 0.2s' }}
                    onMouseOver={e => { e.currentTarget.style.background = 'var(--primary-light)'; e.currentTarget.style.borderColor = 'rgba(123,104,238,0.25)'; }}
                    onMouseOut={e => { e.currentTarget.style.background = 'var(--surface)'; e.currentTarget.style.borderColor = 'var(--outline)'; }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>task_alt</span>
                    Ver Árvore de Tarefas
                  </button>
                </div>
              );
            })}
          </div>
        )}

      </main>

      {/* Modal de duplicação */}
      {duplicatingTask && (
        <TaskModal
          isOpen={true}
          onClose={() => setDuplicatingTask(null)}
          onSubmit={handleDuplicateSubmit}
          taskToEdit={{ ...duplicatingTask, description: `Cópia de ${duplicatingTask.description}` }}
          clientName={duplicatingTask.client_name}
          implSplitInitial={getImplSplit(duplicatingTask.id)}
        />
      )}

      {/* Modal de novo projeto */}
      {creatingProject && (
        <TaskModal
          isOpen={true}
          onClose={() => setCreatingProject(false)}
          onSubmit={handleCreateProject}
          clientName=""
          availableClients={[...new Set(rootTasks.map(t => t.client_name))]}
        />
      )}

      {/* Modal de edição */}
      {editingTask && (
        <TaskModal
          isOpen={true}
          onClose={() => setEditingTask(null)}
          onSubmit={handleEditSubmit}
          taskToEdit={editingTask}
          clientName={editingTask.client_name}
          implSplitInitial={getImplSplit(editingTask.id)}
        />
      )}

      {/* Confirmação de exclusão */}
      {deletingTaskId && (
        <div onClick={() => setDeletingTaskId(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface)', border: '1px solid var(--outline)', borderRadius: 'var(--radius-lg)', padding: '28px', maxWidth: '400px', width: '100%', boxShadow: 'var(--shadow-lg)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '24px', color: '#ef4444' }}>warning</span>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-on-surface)' }}>Excluir projeto</h3>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '24px', lineHeight: 1.6 }}>
              Tem certeza que deseja excluir <strong>{tasks.find(t => t.id === deletingTaskId)?.description ?? 'este projeto'}</strong>? Todas as tarefas filhas também serão removidas. Esta ação não pode ser desfeita.
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => setDeletingTaskId(null)}
                style={{ padding: '8px 20px', background: 'var(--surface-low)', border: '1px solid var(--outline)', borderRadius: 'var(--radius-md)', fontSize: '13px', fontWeight: 600, color: 'var(--text-muted-dark)', cursor: 'pointer' }}>
                Cancelar
              </button>
              <button onClick={handleDeleteConfirm}
                style={{ padding: '8px 20px', background: '#ef4444', border: 'none', borderRadius: 'var(--radius-md)', fontSize: '13px', fontWeight: 700, color: '#fff', cursor: 'pointer' }}>
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
