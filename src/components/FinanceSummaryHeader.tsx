import React from 'react';
import type { Task } from '../types';

interface FinanceSummaryHeaderProps {
  tasks: Task[];
  clientName: string;
  onGenerateShareLink: () => void;
}

export const FinanceSummaryHeader: React.FC<FinanceSummaryHeaderProps> = ({
  tasks,
  clientName,
  onGenerateShareLink,
}) => {
  // 1. Valor Total do Contrato: Soma do contract_value de tarefas NÍVEL 1 (raízes)
  // Isso previne somas duplicadas caso as tarefas filhas também tenham valores especificados.
  // No PRD especificamos a soma de contract_value do projeto.
  const rootTasks = tasks.filter(t => t.parent_id === null);
  const totalContractValue = rootTasks.reduce((sum, t) => sum + t.contract_value, 0);

  // 2. Valor Executado: Soma do contract_value de tarefas raízes concluídas
  // Ou soma de subtarefas folhas concluídas? 
  // Para manter consistência com o total (que soma as raízes), vamos calcular com base nas raízes Concluídas.
  // No PRD, diz: "Soma do contract_value apenas de tarefas que estejam no status Concluído."
  // Se as tarefas filhas também tiverem contract_value individual, somamos apenas as concluídas gerais.
  // Vamos somar todas as tarefas folha concluídas para ter precisão de micro-entregas executadas!
  const leafTasks = tasks.filter(t => !tasks.some(child => child.parent_id === t.id));
  
  const totalLeafValue = leafTasks.reduce((sum, t) => sum + t.contract_value, 0);
  const executedLeafValue = leafTasks
    .filter(t => t.status === 'Concluído')
    .reduce((sum, t) => sum + t.contract_value, 0);

  // Se a soma das folhas for 0, usamos a soma das raízes como fallback para manter consistência
  const finalTotalValue = totalLeafValue > 0 ? totalLeafValue : totalContractValue;
  const finalExecutedValue = totalLeafValue > 0 
    ? executedLeafValue 
    : rootTasks.filter(t => t.status === 'Concluído').reduce((sum, t) => sum + t.contract_value, 0);

  const pendingValue = Math.max(0, finalTotalValue - finalExecutedValue);
  
  // Percentual financeiro
  const financialProgress = finalTotalValue > 0 
    ? Math.round((finalExecutedValue / finalTotalValue) * 100) 
    : 0;

  // Percentual físico (média de conclusão das tarefas folha)
  const totalLeaves = leafTasks.length;
  const completedLeaves = leafTasks.filter(t => t.status === 'Concluído').length;
  const physicalProgress = totalLeaves > 0 
    ? Math.round((completedLeaves / totalLeaves) * 100) 
    : 0;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', marginBottom: '32px' }}>
      
      {/* Top Header Card */}
      <div style={{
        background: 'var(--surface)',
        padding: '24px',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--outline)',
        boxShadow: 'var(--shadow-sm)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-on-surface)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="material-symbols-outlined" style={{ color: 'var(--primary)' }}>folder</span>
            Projeto: Modernização de CRM
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', marginTop: '4px', fontSize: '14px' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>business</span>
            Cliente: {clientName}
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: '12px' }}>
          <button 
            onClick={onGenerateShareLink}
            style={{
              background: 'var(--primary)',
              color: '#ffffff',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              padding: '10px 16px',
              fontWeight: 600,
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
              boxShadow: '0 2px 4px rgba(0, 88, 190, 0.2)',
              transition: 'background 0.2s'
            }}
            onMouseOver={(e) => e.currentTarget.style.background = 'var(--primary-hover)'}
            onMouseOut={(e) => e.currentTarget.style.background = 'var(--primary)'}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>share</span>
            Gerar Link do Cliente
          </button>
        </div>
      </div>

      {/* Bento Grid Summary Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '16px'
      }}>
        
        {/* Card 1: Progresso Físico Geral */}
        <div style={{
          background: 'var(--surface)',
          padding: '20px',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--outline)',
          boxShadow: 'var(--shadow-sm)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          minHeight: '120px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Progresso Físico</p>
              <h3 style={{ fontSize: '28px', fontWeight: 700, marginTop: '4px', color: 'var(--text-on-surface)' }}>{physicalProgress}%</h3>
            </div>
            <div style={{ background: 'var(--primary-light)', padding: '6px', borderRadius: 'var(--radius-md)' }}>
              <span className="material-symbols-outlined" style={{ color: 'var(--primary)', display: 'block' }}>trending_up</span>
            </div>
          </div>
          <div style={{ width: '100%', background: 'var(--surface-low)', height: '6px', borderRadius: 'var(--radius-full)', overflow: 'hidden', marginTop: '12px' }}>
            <div style={{ width: `${physicalProgress}%`, background: 'var(--primary)', height: '100%', borderRadius: 'var(--radius-full)', transition: 'width 0.5s ease-out' }}></div>
          </div>
        </div>

        {/* Card 2: Valor Executado (Faturado) */}
        <div style={{
          background: 'var(--surface)',
          padding: '20px',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--outline)',
          boxShadow: 'var(--shadow-sm)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          minHeight: '120px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Valor Executado (Faturado)</p>
              <h3 style={{ fontSize: '28px', fontWeight: 700, marginTop: '4px', color: 'var(--text-on-surface)' }}>{formatCurrency(finalExecutedValue)}</h3>
            </div>
            <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '6px', borderRadius: 'var(--radius-md)' }}>
              <span className="material-symbols-outlined" style={{ color: '#10b981', display: 'block' }}>payments</span>
            </div>
          </div>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>
            {financialProgress}% do orçamento total executado
          </p>
        </div>

        {/* Card 3: Valor Total do Contrato */}
        <div style={{
          background: 'var(--surface)',
          padding: '20px',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--outline)',
          boxShadow: 'var(--shadow-sm)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          minHeight: '120px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Valor Total do Contrato</p>
              <h3 style={{ fontSize: '28px', fontWeight: 700, marginTop: '4px', color: 'var(--text-on-surface)' }}>{formatCurrency(finalTotalValue)}</h3>
            </div>
            <div style={{ background: 'var(--surface-low)', padding: '6px', borderRadius: 'var(--radius-md)', border: '1px solid var(--outline)' }}>
              <span className="material-symbols-outlined" style={{ color: 'var(--text-muted-dark)', display: 'block' }}>monetization_on</span>
            </div>
          </div>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>
            A faturar: <strong style={{ color: 'var(--text-on-surface)' }}>{formatCurrency(pendingValue)}</strong>
          </p>
        </div>

      </div>
    </div>
  );
};
