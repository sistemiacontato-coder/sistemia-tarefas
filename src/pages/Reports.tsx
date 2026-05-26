import React, { useState, useEffect } from 'react';
import { SideNavBar } from '../components/SideNavBar';
import { supabaseService } from '../supabaseClient';
import type { Task } from '../types';

const IMPL_SPLIT_KEY = 'project_impl_split';

const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

const calcMonthsBetween = (startDateStr: string, periodStart: Date, periodEnd: Date): number => {
  if (!startDateStr) return 0;
  const mensalStart = new Date(startDateStr + 'T00:00:00');
  const now = new Date(); now.setHours(0,0,0,0);
  const effectiveEnd   = periodEnd   < now ? periodEnd   : now;
  const effectiveStart = mensalStart > periodStart ? mensalStart : periodStart;
  if (effectiveStart > effectiveEnd) return 0;
  let months = (effectiveEnd.getFullYear() - effectiveStart.getFullYear()) * 12
    + (effectiveEnd.getMonth() - effectiveStart.getMonth());
  if (effectiveEnd.getDate() >= effectiveStart.getDate()) months++;
  return Math.max(0, months);
};

const getDescendants = (taskId: string, allTasks: Task[]): Task[] => {
  const children = allTasks.filter(t => t.parent_id === taskId);
  return [...children, ...children.flatMap(c => getDescendants(c.id, allTasks))];
};

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);

const fmtDate = (d: string) => {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
};

export const Reports: React.FC = () => {
  const [tasks, setTasks]               = useState<Task[]>([]);
  const [clientNames, setClientNames]   = useState<string[]>([]);
  const [loading, setLoading]           = useState(true);
  const [expandedClient, setExpandedClient] = useState<string | null>(null);
  const [hoveredCard, setHoveredCard]   = useState<'geral' | 'received' | 'mrr' | 'pending' | null>(null);

  // ── Filtros ──
  type FilterType = 'all' | 'month' | 'year' | 'custom';
  const [filterType,  setFilterType]  = useState<FilterType>('all');
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth() + 1);
  const [filterYear,  setFilterYear]  = useState(new Date().getFullYear());
  const [customStart, setCustomStart] = useState('');
  const [customEnd,   setCustomEnd]   = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const uniqueNames = await supabaseService.fetchUniqueClients();
        const allResults  = await Promise.all(uniqueNames.map(n => supabaseService.fetchTasksTree(n)));
        setClientNames(uniqueNames);
        setTasks(allResults.flat());
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const today = new Date(); today.setHours(0,0,0,0);

  // Anos disponíveis (das datas das tarefas + ano atual)
  const availableYears = [...new Set([
    ...tasks.map(t => new Date(t.start_date).getFullYear()),
    today.getFullYear(),
  ])].sort((a, b) => b - a);

  // Limites do período selecionado
  const getPeriodBounds = (): { start: Date | null; end: Date | null } => {
    if (filterType === 'month') {
      return {
        start: new Date(filterYear, filterMonth - 1, 1),
        end:   new Date(filterYear, filterMonth, 0),
      };
    }
    if (filterType === 'year') {
      return {
        start: new Date(filterYear, 0, 1),
        end:   new Date(filterYear, 11, 31),
      };
    }
    if (filterType === 'custom' && customStart && customEnd) {
      return {
        start: new Date(customStart + 'T00:00:00'),
        end:   new Date(customEnd   + 'T00:00:00'),
      };
    }
    return { start: null, end: null };
  };

  const { start: periodStart, end: periodEnd } = getPeriodBounds();

  // Tarefas filtradas pelo período (overlap com o intervalo selecionado)
  const filteredTasks = (periodStart && periodEnd)
    ? tasks.filter(t => {
        const ts = new Date(t.start_date + 'T00:00:00');
        const te = new Date(t.end_date   + 'T00:00:00');
        return ts <= periodEnd && te >= periodStart;
      })
    : tasks;

  const periodLabel = (() => {
    if (filterType === 'month')  return `${MONTHS[filterMonth - 1]} ${filterYear}`;
    if (filterType === 'year')   return `Ano ${filterYear}`;
    if (filterType === 'custom' && customStart && customEnd)
      return `${fmtDate(customStart)} – ${fmtDate(customEnd)}`;
    return null;
  })();

  // ── Distribuição de Status ──
  const getStatusDistribution = () => {
    const counts = {
      done:    filteredTasks.filter(t => t.status === 'Concluído').length,
      doing:   filteredTasks.filter(t => t.status === 'Em Execução').length,
      pending: filteredTasks.filter(t => t.status === 'Pendente').length,
      todo:    filteredTasks.filter(t => t.status === 'A Fazer').length,
    };
    const total = counts.done + counts.doing + counts.pending + counts.todo || 1;
    return {
      total,
      data: [
        { name: 'Concluído',   count: counts.done,    color: '#10b981',           percent: Math.round((counts.done    / total) * 100) },
        { name: 'Em Execução', count: counts.doing,   color: 'var(--primary)',    percent: Math.round((counts.doing   / total) * 100) },
        { name: 'Pendente',    count: counts.pending, color: '#f59e0b',           percent: Math.round((counts.pending / total) * 100) },
        { name: 'A Fazer',     count: counts.todo,    color: 'var(--text-muted)', percent: Math.round((counts.todo    / total) * 100) },
      ],
    };
  };

  // ── Performance por Cliente ──
  const getClientPerformance = (clientName: string) => {
    const clientTasks = filteredTasks.filter(t => t.client_name === clientName);
    const rootTasks   = clientTasks.filter(t => t.parent_id === null);
    const leafTasks   = clientTasks.filter(t => !filteredTasks.some(c => c.parent_id === t.id));

    const total     = leafTasks.length;
    const completed = leafTasks.filter(t => t.status === 'Concluído').length;
    const physicalProgress = total > 0 ? Math.round((completed / total) * 100) : 0;

    let implRecebido = 0, implPendente = 0, mensalAcumulado = 0, implTotal = 0, mrr = 0;

    type ProjectStat = {
      id: string; name: string; endDate: string;
      implRecebido: number; implPendente: number;
      mensalAcumulado: number; mrr: number;
      physicalProgress: number; isOverdue: boolean;
    };
    const projects: ProjectStat[] = [];

    try {
      const implData: Record<string, {
        entradaValue: string; entradaStatus: string; entradaDate?: string;
        entregaValue: string; entregaStatus: string; entregaDate?: string;
        mensalValue: string; mensalStartDate: string;
      }> = JSON.parse(localStorage.getItem(IMPL_SPLIT_KEY) || '{}');

      // Verifica se uma data de pagamento está dentro do período ativo
      const inPeriod = (payDate: string | undefined, fallbackDate: string): boolean => {
        if (!periodStart || !periodEnd) return true; // sem filtro: sempre inclui
        const d = new Date((payDate || fallbackDate) + 'T00:00:00');
        return d >= periodStart && d <= periodEnd;
      };

      rootTasks.forEach(t => {
        const split = implData[t.id];
        let pRec = 0, pPend = 0, pMensal = 0, pMrr = 0, pTotal = 0;

        if (split) {
          const ev = parseFloat(split.entradaValue) || 0;
          const dv = parseFloat(split.entregaValue) || 0;
          pTotal = ev + dv;

          // Entrada: recebido E dentro do período → recebido; na → ignorar; pendente → pendente
          if (split.entradaStatus === 'recebido' && inPeriod(split.entradaDate, t.start_date)) {
            pRec += ev;
          } else if (split.entradaStatus === 'pendente') {
            pPend += ev;
          }

          // Entrega: recebido E dentro do período → recebido; na → ignorar; pendente → pendente
          if (split.entregaStatus === 'recebido' && inPeriod(split.entregaDate, t.end_date)) {
            pRec += dv;
          } else if (split.entregaStatus === 'pendente') {
            pPend += dv;
          }

          if (split.mensalStartDate && (parseFloat(split.mensalValue) || 0) > 0) {
            pMrr = parseFloat(split.mensalValue) || 0;
            const months = (periodStart && periodEnd)
              ? calcMonthsBetween(split.mensalStartDate, periodStart, periodEnd)
              : calcMonthsBetween(split.mensalStartDate, new Date('2000-01-01'), today);
            pMensal = months * pMrr;
          }
        } else {
          const cv = t.contract_value ?? 0;
          pTotal = cv; pPend = cv;
        }

        implRecebido    += pRec;
        implPendente    += pPend;
        mensalAcumulado += pMensal;
        implTotal       += pTotal;
        mrr             += pMrr;

        const desc   = getDescendants(t.id, clientTasks);
        const leaves = desc.length > 0
          ? desc.filter(d => !clientTasks.some(c => c.parent_id === d.id))
          : [t];
        const pPhys = leaves.length > 0
          ? Math.round(leaves.filter(l => l.status === 'Concluído').length / leaves.length * 100)
          : 0;

        const endDate   = new Date(t.end_date + 'T00:00:00');
        const isOverdue = endDate < today && t.status !== 'Concluído';

        projects.push({
          id: t.id, name: t.description, endDate: t.end_date,
          implRecebido: pRec, implPendente: pPend,
          mensalAcumulado: pMensal, mrr: pMrr,
          physicalProgress: pPhys, isOverdue,
        });
      });
    } catch { /* ignore */ }

    const budget   = implTotal;
    const executed = implRecebido + mensalAcumulado;
    const pending  = implPendente;
    const financialProgress = budget > 0 ? Math.round((executed / budget) * 100) : 0;
    const overdueCount = projects.filter(p => p.isOverdue).length;

    return { name: clientName, physicalProgress, financialProgress, budget, implRecebido, mensalAcumulado, executed, pending, mrr, projects, overdueCount };
  };

  const clientsStats = clientNames.map(name => getClientPerformance(name));
  const statusDist   = getStatusDistribution();

  const totalRevenue  = clientsStats.reduce((s, c) => s + c.budget, 0);
  const totalImplRec  = clientsStats.reduce((s, c) => s + c.implRecebido, 0);
  const totalMensal   = clientsStats.reduce((s, c) => s + c.mensalAcumulado, 0);
  const totalExecuted = totalImplRec + totalMensal;
  const totalPending  = clientsStats.reduce((s, c) => s + c.pending, 0);
  const totalMRR      = clientsStats.reduce((s, c) => s + c.mrr, 0);
  const totalGeral    = totalRevenue + totalMensal;

  const overdueProjects = filteredTasks
    .filter(t => t.parent_id === null)
    .filter(t => new Date(t.end_date + 'T00:00:00') < today && t.status !== 'Concluído')
    .sort((a, b) => a.end_date.localeCompare(b.end_date));

  // ── Estilos dos botões de filtro ──
  const filterBtn = (active: boolean) => ({
    padding: '6px 14px',
    fontSize: '12px',
    fontWeight: 700,
    borderRadius: 'var(--radius-md)',
    border: active ? 'none' : '1px solid var(--outline)',
    background: active ? 'var(--primary)' : 'var(--surface)',
    color: active ? '#fff' : 'var(--text-muted-dark)',
    cursor: 'pointer',
    transition: 'all 0.15s',
  } as React.CSSProperties);

  const inputStyle: React.CSSProperties = {
    padding: '6px 10px',
    fontSize: '12px',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--outline-variant)',
    background: 'var(--surface)',
    color: 'var(--text-on-surface)',
    outline: 'none',
  };

  return (
    <div className="layout-container">
      <SideNavBar activePage="reports" />

      <main className="main-content" style={{ display: 'flex', flexDirection: 'column' }}>

        {/* ── Header + Filtros na mesma linha ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap', marginBottom: '24px', borderBottom: '1px solid var(--outline)', paddingBottom: '16px' }}>
          <h2 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-on-surface)', whiteSpace: 'nowrap' }}>Relatórios e Métricas</h2>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Período</span>

            <button style={filterBtn(filterType === 'all')}    onClick={() => setFilterType('all')}>Todos</button>
            <button style={filterBtn(filterType === 'month')}  onClick={() => setFilterType('month')}>Mês</button>
            <button style={filterBtn(filterType === 'year')}   onClick={() => setFilterType('year')}>Ano</button>
            <button style={filterBtn(filterType === 'custom')} onClick={() => setFilterType('custom')}>Personalizado</button>

            {filterType === 'month' && (
              <>
                <select value={filterMonth} onChange={e => setFilterMonth(Number(e.target.value))} style={inputStyle}>
                  {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                </select>
                <select value={filterYear} onChange={e => setFilterYear(Number(e.target.value))} style={inputStyle}>
                  {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </>
            )}

            {filterType === 'year' && (
              <select value={filterYear} onChange={e => setFilterYear(Number(e.target.value))} style={inputStyle}>
                {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            )}

            {filterType === 'custom' && (
              <>
                <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} style={inputStyle} />
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>até</span>
                <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} style={inputStyle} />
              </>
            )}

            {periodLabel && (
              <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--primary)', background: 'var(--primary-light)', padding: '4px 10px', borderRadius: 'var(--radius-sm)' }}>
                {periodLabel}
              </span>
            )}
          </div>
        </div>

        {loading ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '300px', flexDirection: 'column', gap: '12px' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '48px', color: 'var(--primary)', animation: 'spin 1.5s linear infinite' }}>sync</span>
            <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>Processando estatísticas...</p>
            <style>{`@keyframes spin { 0%{transform:rotate(0deg)} 100%{transform:rotate(360deg)} }`}</style>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

            {/* ── Cards de Topo ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>

              {/* Total Geral */}
              <div className="glass-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '6px', position: 'relative', cursor: 'default' }}
                onMouseEnter={() => setHoveredCard('geral')} onMouseLeave={() => setHoveredCard(null)}>
                <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Geral</p>
                <h3 style={{ fontSize: '26px', fontWeight: 800, color: 'var(--text-on-surface)' }}>{fmt(totalGeral)}</h3>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Implantação + mensalidades acumuladas</p>
                {hoveredCard === 'geral' && (
                  <div style={{ position: 'absolute', top: 'calc(100% + 8px)', left: 0, right: 0, background: 'var(--surface)', border: '1px solid var(--outline)', borderRadius: 'var(--radius-md)', padding: '12px 14px', boxShadow: 'var(--shadow-lg)', zIndex: 200 }}>
                    <p style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Por cliente</p>
                    {clientsStats.filter(c => (c.budget + c.mensalAcumulado) > 0).map((c, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', padding: '4px 0', borderTop: i > 0 ? '1px solid var(--outline)' : 'none' }}>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-on-surface)', whiteSpace: 'nowrap' }}>{fmt(c.budget + c.mensalAcumulado)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Total Recebido */}
              <div className="glass-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '6px', position: 'relative', cursor: 'default' }}
                onMouseEnter={() => setHoveredCard('received')} onMouseLeave={() => setHoveredCard(null)}>
                <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Recebido</p>
                <h3 style={{ fontSize: '26px', fontWeight: 800, color: '#10b981' }}>{fmt(totalExecuted)}</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginTop: '2px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)' }}>
                    <span>Impl. recebida</span>
                    <span style={{ fontWeight: 700, color: 'var(--text-on-surface)' }}>{fmt(totalImplRec)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)' }}>
                    <span>Mensalidades acum.</span>
                    <span style={{ fontWeight: 700, color: 'var(--text-on-surface)' }}>{fmt(totalMensal)}</span>
                  </div>
                </div>
                {hoveredCard === 'received' && (
                  <div style={{ position: 'absolute', top: 'calc(100% + 8px)', left: 0, right: 0, background: 'var(--surface)', border: '1px solid var(--outline)', borderRadius: 'var(--radius-md)', padding: '12px 14px', boxShadow: 'var(--shadow-lg)', zIndex: 200 }}>
                    <p style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Por cliente</p>
                    {clientsStats.filter(c => c.executed > 0).map((c, i) => (
                      <div key={i} style={{ padding: '4px 0', borderTop: i > 0 ? '1px solid var(--outline)' : 'none' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                          <span style={{ fontSize: '12px', fontWeight: 700, color: '#10b981', whiteSpace: 'nowrap' }}>{fmt(c.executed)}</span>
                        </div>
                        {(c.implRecebido > 0 || c.mensalAcumulado > 0) && (
                          <div style={{ display: 'flex', gap: '10px', marginTop: '2px' }}>
                            {c.implRecebido    > 0 && <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Impl: {fmt(c.implRecebido)}</span>}
                            {c.mensalAcumulado > 0 && <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Mensal: {fmt(c.mensalAcumulado)}</span>}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Receita Mensal */}
              <div className="glass-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '6px', position: 'relative', cursor: 'default' }}
                onMouseEnter={() => setHoveredCard('mrr')} onMouseLeave={() => setHoveredCard(null)}>
                <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Receita Mensal</p>
                <h3 style={{ fontSize: '26px', fontWeight: 800, color: 'var(--primary)' }}>{fmt(totalMRR)}</h3>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Soma das mensalidades ativas por mês</p>
                {hoveredCard === 'mrr' && (
                  <div style={{ position: 'absolute', top: 'calc(100% + 8px)', left: 0, right: 0, background: 'var(--surface)', border: '1px solid var(--outline)', borderRadius: 'var(--radius-md)', padding: '12px 14px', boxShadow: 'var(--shadow-lg)', zIndex: 200 }}>
                    <p style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Mensalidades ativas</p>
                    {clientsStats.filter(c => c.mrr > 0).length === 0
                      ? <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Nenhuma mensalidade configurada.</p>
                      : clientsStats.filter(c => c.mrr > 0).map((c, i) => (
                          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', padding: '4px 0', borderTop: i > 0 ? '1px solid var(--outline)' : 'none' }}>
                            <span style={{ fontSize: '12px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--primary)', whiteSpace: 'nowrap' }}>{fmt(c.mrr)}/mês</span>
                          </div>
                        ))
                    }
                  </div>
                )}
              </div>

              {/* Total Pendente */}
              <div className="glass-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '6px', position: 'relative', cursor: 'default' }}
                onMouseEnter={() => setHoveredCard('pending')} onMouseLeave={() => setHoveredCard(null)}>
                <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Pendente</p>
                <h3 style={{ fontSize: '26px', fontWeight: 800, color: '#f59e0b' }}>{fmt(totalPending)}</h3>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Entrada e/ou entrega ainda não recebidas</p>
                {hoveredCard === 'pending' && (
                  <div style={{ position: 'absolute', top: 'calc(100% + 8px)', left: 0, right: 0, background: 'var(--surface)', border: '1px solid var(--outline)', borderRadius: 'var(--radius-md)', padding: '12px 14px', boxShadow: 'var(--shadow-lg)', zIndex: 200 }}>
                    <p style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Quem está pendente</p>
                    {clientsStats.filter(c => c.pending > 0).length === 0
                      ? <p style={{ fontSize: '12px', color: '#10b981', fontWeight: 600 }}>Nenhum pendente.</p>
                      : clientsStats.filter(c => c.pending > 0).map((c, i) => (
                          <div key={i} style={{ padding: '4px 0', borderTop: i > 0 ? '1px solid var(--outline)' : 'none' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
                              <span style={{ fontSize: '12px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                              <span style={{ fontSize: '12px', fontWeight: 700, color: '#f59e0b', whiteSpace: 'nowrap' }}>{fmt(c.pending)}</span>
                            </div>
                            {c.projects.filter(p => p.implPendente > 0).map((p, pi) => (
                              <div key={pi} style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', paddingLeft: '10px', marginTop: '2px' }}>
                                <span style={{ fontSize: '10px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>↳ {p.name}</span>
                                <span style={{ fontSize: '10px', fontWeight: 600, color: '#f59e0b', whiteSpace: 'nowrap' }}>{fmt(p.implPendente)}</span>
                              </div>
                            ))}
                          </div>
                        ))
                    }
                  </div>
                )}
              </div>

            </div>

            {/* ── Gráfico de Status + Evolução Física ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '24px' }}>

              <div className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-on-surface)' }}>Distribuição de Status</h3>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', flexWrap: 'wrap', gap: '16px' }}>
                  <div style={{ position: 'relative', width: '130px', height: '130px' }}>
                    <svg viewBox="0 0 36 36" style={{ width: '100%', height: '100%' }}>
                      <circle cx="18" cy="18" r="15.915" fill="none" stroke="var(--surface-low)" strokeWidth="4" />
                      <circle cx="18" cy="18" r="15.915" fill="none" stroke="var(--primary)" strokeWidth="4"
                        strokeDasharray={`${statusDist.data[1].percent} ${100 - statusDist.data[1].percent}`} strokeDashoffset="25" />
                      <circle cx="18" cy="18" r="15.915" fill="none" stroke="#10b981" strokeWidth="4"
                        strokeDasharray={`${statusDist.data[0].percent} ${100 - statusDist.data[0].percent}`}
                        strokeDashoffset={`${25 + statusDist.data[1].percent}`} />
                      <circle cx="18" cy="18" r="15.915" fill="none" stroke="#f59e0b" strokeWidth="4"
                        strokeDasharray={`${statusDist.data[2].percent} ${100 - statusDist.data[2].percent}`}
                        strokeDashoffset={`${25 + statusDist.data[1].percent + statusDist.data[0].percent}`} />
                    </svg>
                    <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', textAlign: 'center' }}>
                      <span style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-on-surface)' }}>{filteredTasks.length}</span>
                      <p style={{ fontSize: '9px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Itens</p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {statusDist.data.map((item, idx) => (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '12px', height: '12px', borderRadius: '4px', background: item.color }} />
                        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-on-surface)', minWidth: '100px' }}>{item.name}</span>
                        <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 600 }}>{item.count} ({item.percent}%)</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-on-surface)' }}>Evolução Física por Cliente</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto', maxHeight: '300px' }}>
                  {clientsStats.map((item, idx) => (
                    <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                        <span style={{ fontWeight: 700, color: 'var(--text-on-surface)' }}>{item.name}</span>
                        <span style={{ fontWeight: 800, color: item.physicalProgress === 100 ? '#10b981' : 'var(--primary)' }}>{item.physicalProgress}%</span>
                      </div>
                      <div style={{ width: '100%', background: 'var(--surface-low)', height: '8px', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                        <div style={{ width: `${item.physicalProgress}%`, background: item.physicalProgress === 100 ? '#10b981' : 'var(--primary)', height: '100%', borderRadius: 'var(--radius-full)' }} />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)' }}>
                        <span>Progresso físico</span>
                        <span>
                          MRR: {fmt(item.mrr)}/mês
                          {item.overdueCount > 0 && <span style={{ color: '#ef4444', fontWeight: 700 }}> · {item.overdueCount} em atraso</span>}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>

            {/* ── Projetos em Atraso ── */}
            {overdueProjects.length > 0 && (
              <div className="glass-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px', border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.04)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#ef4444' }}>warning</span>
                  <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#ef4444' }}>
                    {overdueProjects.length} projeto{overdueProjects.length > 1 ? 's' : ''} em atraso
                  </h3>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {overdueProjects.map(t => {
                    const daysLate = Math.floor((today.getTime() - new Date(t.end_date + 'T00:00:00').getTime()) / (1000 * 60 * 60 * 24));
                    return (
                      <div key={t.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--outline)' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-on-surface)' }}>{t.description}</span>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{t.client_name}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Prazo</div>
                            <div style={{ fontSize: '12px', fontWeight: 700, color: '#ef4444' }}>{fmtDate(t.end_date)}</div>
                          </div>
                          <span style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444', fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: 'var(--radius-sm)', whiteSpace: 'nowrap' }}>
                            {daysLate}d atraso
                          </span>
                          <span style={{
                            fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: 'var(--radius-sm)',
                            background: t.status === 'Em Execução' ? 'rgba(99,102,241,0.12)' : t.status === 'Pendente' ? 'rgba(245,158,11,0.12)' : 'rgba(107,114,128,0.12)',
                            color: t.status === 'Em Execução' ? 'var(--primary)' : t.status === 'Pendente' ? '#f59e0b' : 'var(--text-muted)',
                          }}>
                            {t.status}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── Tabela por Cliente ── */}
            <div className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', border: '1px solid var(--outline)' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-on-surface)' }}>Consolidado Financeiro por Cliente</h3>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--outline)', background: 'var(--background)' }}>
                      <th style={{ padding: '10px 16px', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Cliente / Projeto</th>
                      <th style={{ padding: '10px 16px', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', textAlign: 'right' }}>Impl. Total</th>
                      <th style={{ padding: '10px 16px', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', textAlign: 'right' }}>Impl. Recebida</th>
                      <th style={{ padding: '10px 16px', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', textAlign: 'right' }}>Mensalidades</th>
                      <th style={{ padding: '10px 16px', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', textAlign: 'right' }}>MRR/mês</th>
                      <th style={{ padding: '10px 16px', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', textAlign: 'right' }}>Impl. Pendente</th>
                      <th style={{ padding: '10px 16px', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', textAlign: 'center' }}>Físico</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clientsStats.map((client, idx) => (
                      <React.Fragment key={idx}>
                        <tr
                          onClick={() => setExpandedClient(expandedClient === client.name ? null : client.name)}
                          style={{ borderBottom: expandedClient === client.name ? 'none' : '1px solid var(--outline)', height: '52px', cursor: 'pointer', background: expandedClient === client.name ? 'var(--surface-low)' : 'transparent' }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-low)')}
                          onMouseLeave={e => (e.currentTarget.style.background = expandedClient === client.name ? 'var(--surface-low)' : 'transparent')}
                        >
                          <td style={{ padding: '8px 16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span className="material-symbols-outlined" style={{ fontSize: '16px', color: 'var(--text-muted)', transition: 'transform 0.2s', transform: expandedClient === client.name ? 'rotate(90deg)' : 'rotate(0deg)' }}>chevron_right</span>
                              <span style={{ fontWeight: 700, color: 'var(--text-on-surface)', fontSize: '14px' }}>{client.name}</span>
                              {client.overdueCount > 0 && (
                                <span style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444', fontSize: '10px', fontWeight: 700, padding: '2px 6px', borderRadius: 'var(--radius-sm)' }}>
                                  {client.overdueCount} atraso
                                </span>
                              )}
                            </div>
                          </td>
                          <td style={{ padding: '8px 16px', textAlign: 'right', fontWeight: 600, color: 'var(--text-on-surface)', fontSize: '13px' }}>{fmt(client.budget)}</td>
                          <td style={{ padding: '8px 16px', textAlign: 'right', fontWeight: 600, color: '#10b981', fontSize: '13px' }}>{fmt(client.implRecebido)}</td>
                          <td style={{ padding: '8px 16px', textAlign: 'right', fontWeight: 600, color: '#10b981', fontSize: '13px' }}>{fmt(client.mensalAcumulado)}</td>
                          <td style={{ padding: '8px 16px', textAlign: 'right', fontWeight: 600, color: 'var(--primary)', fontSize: '13px' }}>{client.mrr > 0 ? fmt(client.mrr) : '—'}</td>
                          <td style={{ padding: '8px 16px', textAlign: 'right', fontWeight: 600, color: client.pending > 0 ? '#f59e0b' : 'var(--text-muted)', fontSize: '13px' }}>{fmt(client.pending)}</td>
                          <td style={{ padding: '8px 16px', textAlign: 'center' }}>
                            <span style={{ background: client.physicalProgress === 100 ? 'rgba(16,185,129,0.1)' : 'var(--primary-light)', color: client.physicalProgress === 100 ? '#10b981' : 'var(--primary)', padding: '3px 8px', borderRadius: 'var(--radius-sm)', fontWeight: 700, fontSize: '12px' }}>
                              {client.physicalProgress}%
                            </span>
                          </td>
                        </tr>
                        {expandedClient === client.name && client.projects.map((p, pIdx) => (
                          <tr key={pIdx} style={{ borderBottom: pIdx === client.projects.length - 1 ? '2px solid var(--outline)' : '1px solid var(--outline)', background: 'var(--background)', height: '44px' }}>
                            <td style={{ padding: '6px 16px 6px 40px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span className="material-symbols-outlined" style={{ fontSize: '14px', color: 'var(--text-muted)' }}>subdirectory_arrow_right</span>
                                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-on-surface)' }}>{p.name}</span>
                                {p.isOverdue && <span style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444', fontSize: '10px', fontWeight: 700, padding: '2px 6px', borderRadius: 'var(--radius-sm)' }}>atraso</span>}
                                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>até {fmtDate(p.endDate)}</span>
                              </div>
                            </td>
                            <td style={{ padding: '6px 16px', textAlign: 'right', fontSize: '12px', color: 'var(--text-muted)' }}>{fmt(p.implRecebido + p.implPendente)}</td>
                            <td style={{ padding: '6px 16px', textAlign: 'right', fontSize: '12px', color: p.implRecebido > 0 ? '#10b981' : 'var(--text-muted)' }}>{p.implRecebido > 0 ? fmt(p.implRecebido) : '—'}</td>
                            <td style={{ padding: '6px 16px', textAlign: 'right', fontSize: '12px', color: p.mensalAcumulado > 0 ? '#10b981' : 'var(--text-muted)' }}>{p.mensalAcumulado > 0 ? fmt(p.mensalAcumulado) : '—'}</td>
                            <td style={{ padding: '6px 16px', textAlign: 'right', fontSize: '12px', color: p.mrr > 0 ? 'var(--primary)' : 'var(--text-muted)' }}>{p.mrr > 0 ? fmt(p.mrr) : '—'}</td>
                            <td style={{ padding: '6px 16px', textAlign: 'right', fontSize: '12px', color: p.implPendente > 0 ? '#f59e0b' : 'var(--text-muted)' }}>{p.implPendente > 0 ? fmt(p.implPendente) : '—'}</td>
                            <td style={{ padding: '6px 16px', textAlign: 'center' }}>
                              <span style={{ background: p.physicalProgress === 100 ? 'rgba(16,185,129,0.1)' : 'var(--primary-light)', color: p.physicalProgress === 100 ? '#10b981' : 'var(--primary)', padding: '2px 7px', borderRadius: 'var(--radius-sm)', fontWeight: 700, fontSize: '11px' }}>
                                {p.physicalProgress}%
                              </span>
                            </td>
                          </tr>
                        ))}
                      </React.Fragment>
                    ))}
                    <tr style={{ background: 'var(--surface-low)', height: '52px', fontWeight: 800 }}>
                      <td style={{ padding: '8px 16px', fontSize: '13px', color: 'var(--text-on-surface)' }}>TOTAL CONSOLIDADO</td>
                      <td style={{ padding: '8px 16px', textAlign: 'right', fontSize: '13px', color: 'var(--primary)' }}>{fmt(totalRevenue)}</td>
                      <td style={{ padding: '8px 16px', textAlign: 'right', fontSize: '13px', color: '#10b981' }}>{fmt(totalImplRec)}</td>
                      <td style={{ padding: '8px 16px', textAlign: 'right', fontSize: '13px', color: '#10b981' }}>{fmt(totalMensal)}</td>
                      <td style={{ padding: '8px 16px', textAlign: 'right', fontSize: '13px', color: 'var(--primary)' }}>{fmt(totalMRR)}</td>
                      <td style={{ padding: '8px 16px', textAlign: 'right', fontSize: '13px', color: '#f59e0b' }}>{fmt(totalPending)}</td>
                      <td style={{ padding: '8px 16px', textAlign: 'center' }}>
                        <span style={{ background: 'var(--primary)', color: '#ffffff', padding: '3px 8px', borderRadius: 'var(--radius-sm)', fontWeight: 700, fontSize: '12px' }}>
                          {clientsStats.length > 0 ? Math.round(clientsStats.reduce((s, c) => s + c.physicalProgress, 0) / clientsStats.length) : 0}%
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

      </main>
    </div>
  );
};
