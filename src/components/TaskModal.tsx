import React, { useState, useEffect } from 'react';
import type { Task, TaskStatus } from '../types';

type PayStatus = 'pendente' | 'recebido' | 'na';

export interface ImplSplitData {
  entradaValue: string; entradaStatus: PayStatus; entradaDate: string;
  entregaValue: string; entregaStatus: PayStatus; entregaDate: string;
  mensalValue: string; mensalStartDate: string;
}

const emptyImplSplit = (): ImplSplitData => ({
  entradaValue: '', entradaStatus: 'pendente', entradaDate: '',
  entregaValue: '', entregaStatus: 'pendente', entregaDate: '',
  mensalValue: '', mensalStartDate: '',
});

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
  taskToEdit?: Task | null;
  parentId?: string | null;
  clientName: string;
  availableClients?: string[];
  implSplitInitial?: ImplSplitData;
}

const cycleStatus = (s: PayStatus): PayStatus => {
  const c: PayStatus[] = ['pendente', 'recebido', 'na'];
  return c[(c.indexOf(s) + 1) % c.length];
};

const statusCfg = (s: PayStatus) =>
  s === 'recebido' ? { bg: 'rgba(16,185,129,0.12)',  bd: 'rgba(16,185,129,0.3)',   color: '#10b981',          label: 'Recebido' }
: s === 'na'       ? { bg: 'rgba(107,114,128,0.10)', bd: 'rgba(107,114,128,0.25)', color: 'var(--text-muted)', label: 'Isento'   }
:                    { bg: 'rgba(245,158,11,0.12)',  bd: 'rgba(245,158,11,0.3)',   color: '#f59e0b',          label: 'Pendente' };

const inputStyle: React.CSSProperties = {
  padding: '9px 12px', borderRadius: 'var(--radius-md)',
  border: '1px solid var(--outline-variant)', fontSize: '13px',
  background: 'var(--surface)', color: 'var(--text-on-surface)', outline: 'none', width: '100%',
};

const labelStyle: React.CSSProperties = {
  fontSize: '12px', fontWeight: 600, color: 'var(--text-muted-dark)',
};

export const TaskModal: React.FC<TaskModalProps> = ({
  isOpen, onClose, onSubmit,
  taskToEdit = null, parentId = null,
  clientName, availableClients = [],
  implSplitInitial,
}) => {
  const [description,    setDescription]    = useState('');
  const [status,         setStatus]         = useState<TaskStatus>('A Fazer');
  const [startDate,      setStartDate]      = useState('');
  const [endDate,        setEndDate]        = useState('');
  const [selectedClient, setSelectedClient] = useState('');
  const [error,          setError]          = useState('');

  // impl_split
  const [implSplit, setImplSplit] = useState<ImplSplitData>(emptyImplSplit);

  const isRootProject = !parentId && (!taskToEdit || taskToEdit.parent_id === null);

  useEffect(() => {
    if (!isOpen) return;
    const today    = new Date().toISOString().split('T')[0];
    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    if (taskToEdit) {
      setDescription(taskToEdit.description);
      setStatus(taskToEdit.status);
      setStartDate(taskToEdit.start_date);
      setEndDate(taskToEdit.end_date);
      setSelectedClient(taskToEdit.client_name);
      setImplSplit(implSplitInitial ?? emptyImplSplit());
    } else {
      setDescription('');
      setStatus('A Fazer');
      setStartDate(today);
      setEndDate(nextWeek);
      setSelectedClient((clientName === 'todos_clientes' || clientName === '') ? '' : clientName);
      setImplSplit(emptyImplSplit());
    }
    setError('');
  }, [isOpen, taskToEdit, clientName, implSplitInitial]);

  if (!isOpen) return null;

  const setImpl = (patch: Partial<ImplSplitData>) =>
    setImplSplit(prev => ({ ...prev, ...patch }));

  const toggleStatus = (field: 'entradaStatus' | 'entregaStatus') => {
    const next = cycleStatus(implSplit[field]);
    const dateField = field === 'entradaStatus' ? 'entradaDate' : 'entregaDate';
    const today = new Date().toISOString().split('T')[0];
    const patch: Partial<ImplSplitData> = { [field]: next };
    if (next === 'recebido' && !implSplit[dateField]) patch[dateField] = today;
    if (field === 'entregaStatus' && next === 'recebido' && !implSplit.mensalStartDate)
      patch.mensalStartDate = today;
    setImpl(patch);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) { setError('Informe o nome do projeto.'); return; }
    if (new Date(endDate) < new Date(startDate)) { setError('A data de fim não pode ser anterior à data de início.'); return; }

    onSubmit({
      description,
      contract_value: 0,
      status,
      start_date: startDate,
      end_date: endDate,
      client_name: selectedClient,
      parent_id: taskToEdit ? taskToEdit.parent_id : parentId,
      ...(isRootProject ? { implSplit } : {}),
    });
  };

  const StatusBadge = ({ field }: { field: 'entradaStatus' | 'entregaStatus' }) => {
    const cfg = statusCfg(implSplit[field]);
    return (
      <button type="button" onClick={() => toggleStatus(field)}
        title="Clique para alternar (Pendente → Recebido → Isento)"
        style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: cfg.bg, border: `1px solid ${cfg.bd}`, borderRadius: '99px', padding: '4px 10px', cursor: 'pointer', fontSize: '11px', fontWeight: 700, whiteSpace: 'nowrap', color: cfg.color, flexShrink: 0 }}>
        <span style={{ fontSize: '7px' }}>●</span>{cfg.label}
      </button>
    );
  };

  const sectionTitle = (icon: string, label: string) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
      <span className="material-symbols-outlined" style={{ fontSize: '14px', color: 'var(--text-muted)' }}>{icon}</span>
      <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
    </div>
  );

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(11,28,48,0.4)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '16px' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface)', borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: '580px', maxHeight: '90vh', boxShadow: 'var(--shadow-lg)', border: '1px solid var(--outline)', display: 'flex', flexDirection: 'column' }}>

        {/* Header */}
        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--outline)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--background)', borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0', flexShrink: 0 }}>
          <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-on-surface)' }}>
            {taskToEdit ? 'Editar Projeto' : (parentId ? 'Adicionar Subtarefa' : 'Novo Projeto')}
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto' }}>

          {error && (
            <div style={{ background: '#ffdad6', color: '#ba1a1a', padding: '10px 14px', borderRadius: 'var(--radius-md)', fontSize: '13px', fontWeight: 600 }}>
              {error}
            </div>
          )}

          {/* ── Dados Gerais ── */}
          {sectionTitle('info', 'Dados gerais')}

          {(clientName === 'todos_clientes' || clientName === '') && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              <label style={labelStyle}>Cliente <span style={{ color: '#ba1a1a' }}>*</span></label>
              <input list="client-list" value={selectedClient} onChange={e => setSelectedClient(e.target.value)}
                placeholder="Selecione ou digite o nome do cliente" required
                style={inputStyle}
                onFocus={e => e.target.style.borderColor = 'var(--primary)'}
                onBlur={e => e.target.style.borderColor = 'var(--outline-variant)'} />
              <datalist id="client-list">{availableClients.map(c => <option key={c} value={c} />)}</datalist>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <label style={labelStyle}>Nome do Projeto <span style={{ color: '#ba1a1a' }}>*</span></label>
            <input type="text" value={description} onChange={e => setDescription(e.target.value)}
              placeholder="Ex: Implantação de sistema" required style={inputStyle}
              onFocus={e => { e.target.style.borderColor = 'var(--primary)'; try { e.target.select(); } catch {} }}
              onBlur={e => e.target.style.borderColor = 'var(--outline-variant)'} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              <label style={labelStyle}>Status</label>
              <select value={status} onChange={e => setStatus(e.target.value as TaskStatus)} style={inputStyle}>
                <option value="A Fazer">A Fazer</option>
                <option value="Em Execução">Em Execução</option>
                <option value="Pendente">Pendente</option>
                <option value="Concluído">Concluído</option>
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              <label style={labelStyle}>Data de Início <span style={{ color: '#ba1a1a' }}>*</span></label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} required style={inputStyle} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              <label style={labelStyle}>Previsão de Entrega <span style={{ color: '#ba1a1a' }}>*</span></label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} required style={inputStyle} />
            </div>
          </div>

          {/* ── Financeiro (só para projetos raiz) ── */}
          {isRootProject && (
            <>
              <div style={{ borderTop: '1px solid var(--outline)', paddingTop: '16px' }}>
                {sectionTitle('payments', 'Implantação')}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>

                  {/* Entrada */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', minWidth: '52px' }}>Entrada</span>
                    <input type="number" step="0.01" min="0" value={implSplit.entradaValue}
                      onChange={e => setImpl({ entradaValue: e.target.value })}
                      placeholder="0,00"
                      style={{ ...inputStyle, width: '130px', flex: 'none' }}
                      onFocus={e => { e.target.style.borderColor = 'var(--primary)'; try { e.target.select(); } catch {} }}
                      onBlur={e => e.target.style.borderColor = 'var(--outline-variant)'} />
                    <StatusBadge field="entradaStatus" />
                    {implSplit.entradaStatus === 'recebido' && (
                      <input type="date" value={implSplit.entradaDate} onChange={e => setImpl({ entradaDate: e.target.value })}
                        style={{ ...inputStyle, width: 'auto', flex: 1 }}
                        onFocus={e => e.target.style.borderColor = 'var(--primary)'}
                        onBlur={e => e.target.style.borderColor = 'var(--outline-variant)'} />
                    )}
                  </div>

                  {/* Entrega */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', minWidth: '52px' }}>Entrega</span>
                    <input type="number" step="0.01" min="0" value={implSplit.entregaValue}
                      onChange={e => setImpl({ entregaValue: e.target.value })}
                      placeholder="0,00"
                      style={{ ...inputStyle, width: '130px', flex: 'none' }}
                      onFocus={e => { e.target.style.borderColor = 'var(--primary)'; try { e.target.select(); } catch {} }}
                      onBlur={e => e.target.style.borderColor = 'var(--outline-variant)'} />
                    <StatusBadge field="entregaStatus" />
                    {implSplit.entregaStatus === 'recebido' && (
                      <input type="date" value={implSplit.entregaDate} onChange={e => setImpl({ entregaDate: e.target.value })}
                        style={{ ...inputStyle, width: 'auto', flex: 1 }}
                        onFocus={e => e.target.style.borderColor = 'var(--primary)'}
                        onBlur={e => e.target.style.borderColor = 'var(--outline-variant)'} />
                    )}
                  </div>

                </div>
              </div>

              {/* Mensalidade */}
              <div style={{ borderTop: '1px solid var(--outline)', paddingTop: '16px' }}>
                {sectionTitle('autorenew', 'Mensalidade')}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    <label style={labelStyle}>Valor / mês (R$)</label>
                    <input type="number" step="0.01" min="0" value={implSplit.mensalValue}
                      onChange={e => setImpl({ mensalValue: e.target.value })}
                      placeholder="0,00" style={inputStyle}
                      onFocus={e => { e.target.style.borderColor = 'var(--primary)'; try { e.target.select(); } catch {} }}
                      onBlur={e => e.target.style.borderColor = 'var(--outline-variant)'} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    <label style={labelStyle}>Data de início</label>
                    <input type="date" value={implSplit.mensalStartDate} onChange={e => setImpl({ mensalStartDate: e.target.value })}
                      style={inputStyle}
                      onFocus={e => e.target.style.borderColor = 'var(--primary)'}
                      onBlur={e => e.target.style.borderColor = 'var(--outline-variant)'} />
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Footer */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '4px', borderTop: '1px solid var(--outline)', paddingTop: '16px' }}>
            <button type="button" onClick={onClose}
              style={{ background: 'none', border: '1px solid var(--outline)', borderRadius: 'var(--radius-md)', padding: '10px 18px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', color: 'var(--text-muted-dark)' }}
              onMouseOver={e => e.currentTarget.style.background = 'var(--background)'}
              onMouseOut={e => e.currentTarget.style.background = 'none'}>
              Cancelar
            </button>
            <button type="submit"
              style={{ background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', padding: '10px 18px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}
              onMouseOver={e => e.currentTarget.style.background = 'var(--primary-hover)'}
              onMouseOut={e => e.currentTarget.style.background = 'var(--primary)'}>
              {taskToEdit ? 'Salvar Alterações' : 'Criar Projeto'}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};
