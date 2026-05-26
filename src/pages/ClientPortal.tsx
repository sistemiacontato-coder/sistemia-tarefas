import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabaseService } from '../supabaseClient';
import type { Task } from '../types';
import { TaskTable } from '../components/TaskTable';

export const ClientPortal: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const [clientName, setClientName] = useState<string | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [validating, setValidating] = useState(true);
  const [isValid, setIsValid] = useState(false);

  // Estados de segurança e autenticação do Portal
  const [settings, setSettings] = useState<{
    accessType: 'public' | 'password' | 'email';
    password?: string;
    allowedEmails?: string[];
  } | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [inputPassword, setInputPassword] = useState('');
  const [inputEmail, setInputEmail] = useState('');
  const [authError, setAuthError] = useState('');

  const [isDarkMode, setIsDarkMode] = useState(false);

  // Força o Tema Claro como padrão ao abrir o portal do cliente
  useEffect(() => {
    document.body.classList.add('light-theme');
    setIsDarkMode(false);

    return () => {
      document.body.classList.remove('light-theme');
    };
  }, []);

  const toggleTheme = () => {
    if (isDarkMode) {
      document.body.classList.add('light-theme');
      setIsDarkMode(false);
    } else {
      document.body.classList.remove('light-theme');
      setIsDarkMode(true);
    }
  };

  useEffect(() => {
    const validateAndFetch = async () => {
      if (!token) {
        setValidating(false);
        return;
      }
      
      setValidating(true);
      try {
        const client = await supabaseService.validateShareToken(token);
        if (client) {
          setClientName(client);
          setIsValid(true);
          
          // Carrega as configurações de segurança do portal do localStorage baseadas no nome do cliente
          const stored = localStorage.getItem(`client_share_settings_${client}`);
          let parsedSettings = { accessType: 'public' as const };
          if (stored) {
            try {
              parsedSettings = JSON.parse(stored);
            } catch (e) {}
          }
          setSettings(parsedSettings);
          
          if (parsedSettings.accessType === 'public') {
            setIsAuthenticated(true);
            const data = await supabaseService.fetchTasksTree(client);
            setTasks(data);
          } else {
            setIsAuthenticated(false);
          }
        } else {
          setIsValid(false);
        }
      } catch (err) {
        console.error('Erro ao validar token:', err);
        setIsValid(false);
      } finally {
        setValidating(false);
      }
    };

    validateAndFetch();
  }, [token]);

  const handleVerifyPassword = async () => {
    if (!settings || !clientName) return;
    setAuthError('');
    if (inputPassword === settings.password) {
      setValidating(true);
      try {
        const data = await supabaseService.fetchTasksTree(clientName);
        setTasks(data);
        setIsAuthenticated(true);
      } catch (err) {
        setAuthError('Erro ao buscar dados do cronograma.');
      } finally {
        setValidating(false);
      }
    } else {
      setAuthError('Senha incorreta. Por favor, tente novamente.');
    }
  };

  const handleVerifyEmail = async () => {
    if (!settings || !clientName) return;
    setAuthError('');
    const emailLower = inputEmail.trim().toLowerCase();
    const isAllowed = settings.allowedEmails?.some(e => e.trim().toLowerCase() === emailLower);
    
    if (isAllowed) {
      setValidating(true);
      try {
        const data = await supabaseService.fetchTasksTree(clientName);
        setTasks(data);
        setIsAuthenticated(true);
      } catch (err) {
        setAuthError('Erro ao buscar dados do cronograma.');
      } finally {
        setValidating(false);
      }
    } else {
      setAuthError('Este e-mail não possui permissão para acessar este portal.');
    }
  };

  if (validating) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: '16px' }}>
        <span className="material-symbols-outlined" style={{ fontSize: '48px', color: 'var(--primary)', animation: 'spin 1.5s linear infinite' }}>
          sync
        </span>
        <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>Validando credenciais públicas...</p>
        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!isValid || !clientName) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--background)', padding: '16px' }}>
        <div className="glass-card" style={{
          padding: '40px',
          maxWidth: '480px',
          width: '100%',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '16px'
        }}>
          <div style={{ background: 'rgba(186, 26, 26, 0.1)', padding: '12px', borderRadius: 'var(--radius-full)', color: 'var(--error)' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '40px', display: 'block' }}>lock_person</span>
          </div>
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-on-surface)' }}>Acesso Não Autorizado</h2>
          <p style={{ fontSize: '14px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
            O link de compartilhamento fornecido é inválido, expirou ou foi revogado pelo administrador do projeto.
          </p>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Entre em contato com o gestor do seu projeto para solicitar um novo link de acompanhamento.
          </p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated && settings) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: 'var(--background)',
        padding: '16px',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        position: 'relative'
      }}>
        {/* Botão de Alternância de Tema Flutuante na Tela de Bloqueio */}
        <div style={{ position: 'absolute', top: '24px', right: '24px' }}>
          <button
            onClick={toggleTheme}
            title={isDarkMode ? "Mudar para Modo Claro" : "Mudar para Modo Escuro"}
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--outline)',
              borderRadius: '50%',
              width: '40px',
              height: '40px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: 'var(--text-on-surface)',
              transition: 'background 0.2s, transform 0.2s',
              outline: 'none',
              boxShadow: 'var(--shadow-sm)'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = 'var(--surface-hover)';
              e.currentTarget.style.transform = 'scale(1.05)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = 'var(--surface)';
              e.currentTarget.style.transform = 'scale(1)';
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '20px', color: isDarkMode ? '#f59e0b' : 'var(--primary)' }}>
              {isDarkMode ? 'light_mode' : 'dark_mode'}
            </span>
          </button>
        </div>

        <div className="glass-card" style={{
          padding: '32px',
          maxWidth: '420px',
          width: '100%',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '20px',
          boxShadow: 'var(--shadow-lg)'
        }}>
          {settings.accessType === 'password' ? (
            <>
              <div style={{ background: 'rgba(95, 85, 236, 0.1)', padding: '16px', borderRadius: 'var(--radius-full)', color: '#5f55ec' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '40px', display: 'block' }}>lock</span>
              </div>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-on-surface)' }}>Portal Protegido por Senha</h3>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Este cronograma é privado. Insira a senha fornecida pelo administrador do projeto para acessar.
                </p>
              </div>

              <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '8px', textAlign: 'left' }}>
                <input
                  type="password"
                  value={inputPassword}
                  onChange={(e) => setInputPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleVerifyPassword()}
                  placeholder="Senha de acesso"
                  style={{
                    background: 'var(--surface-low)',
                    border: '1px solid var(--outline)',
                    borderRadius: 'var(--radius-md)',
                    padding: '10px 14px',
                    fontSize: '14px',
                    color: 'var(--text-on-surface)',
                    outline: 'none',
                    textAlign: 'center'
                  }}
                  autoFocus
                />
                {authError && (
                  <p style={{ fontSize: '12px', color: 'var(--error)', fontWeight: 600, textAlign: 'center', marginTop: '2px' }}>
                    {authError}
                  </p>
                )}
              </div>

              <button
                onClick={handleVerifyPassword}
                style={{
                  background: '#5f55ec',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  padding: '10px 16px',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  width: '100%',
                  boxShadow: '0 4px 12px rgba(95, 85, 236, 0.3)',
                  transition: 'background 0.2s'
                }}
                onMouseOver={(e) => e.currentTarget.style.background = '#4f45dc'}
                onMouseOut={(e) => e.currentTarget.style.background = '#5f55ec'}
              >
                Acessar Portal
              </button>
            </>
          ) : (
            <>
              <div style={{ background: 'rgba(0, 150, 136, 0.1)', padding: '16px', borderRadius: 'var(--radius-full)', color: '#009688' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '40px', display: 'block' }}>mark_email_read</span>
              </div>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-on-surface)' }}>Portal Restrito por E-mail</h3>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Apenas e-mails autorizados podem visualizar este cronograma. Digite seu e-mail abaixo.
                </p>
              </div>

              <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '8px', textAlign: 'left' }}>
                <input
                  type="email"
                  value={inputEmail}
                  onChange={(e) => setInputEmail(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleVerifyEmail()}
                  placeholder="seu-email@empresa.com"
                  style={{
                    background: 'var(--surface-low)',
                    border: '1px solid var(--outline)',
                    borderRadius: 'var(--radius-md)',
                    padding: '10px 14px',
                    fontSize: '14px',
                    color: 'var(--text-on-surface)',
                    outline: 'none',
                    textAlign: 'center'
                  }}
                  autoFocus
                />
                {authError && (
                  <p style={{ fontSize: '12px', color: 'var(--error)', fontWeight: 600, textAlign: 'center', marginTop: '2px' }}>
                    {authError}
                  </p>
                )}
              </div>

              <button
                onClick={handleVerifyEmail}
                style={{
                  background: '#009688',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  padding: '10px 16px',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  width: '100%',
                  boxShadow: '0 4px 12px rgba(0, 150, 136, 0.3)',
                  transition: 'background 0.2s'
                }}
                onMouseOver={(e) => e.currentTarget.style.background = '#00796b'}
                onMouseOut={(e) => e.currentTarget.style.background = '#009688'}
              >
                Validar e Entrar
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  // --- Lógica de Cálculos do Projeto ---
  const leafTasks = tasks.filter(t => !tasks.some(child => child.parent_id === t.id));
  const totalTasks = leafTasks.length;
  const completedTasks = leafTasks.filter(t => t.status === 'Concluído').length;
  const activeTasks = leafTasks.filter(t => t.status === 'Em Execução').length;
  
  // Percentual físico de progresso
  const progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  
  // Circunferência para animação SVG do progresso radial
  const radius = 24;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - (progressPercent / 100) * circumference;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--background)', display: 'flex', flexDirection: 'column' }}>
      
      {/* Header Section (Brand & Identity) */}
      <header style={{
        width: '100%',
        height: '80px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 32px',
        background: 'var(--surface)',
        borderBottom: '1px solid var(--outline)',
        position: 'sticky',
        top: 0,
        zIndex: 50
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span className="material-symbols-outlined" style={{ color: 'var(--primary)', fontSize: '32px' }}>task_alt</span>
          <span style={{ fontSize: '20px', fontWeight: 800, color: 'var(--primary)' }}>SistemIA Tarefas</span>
        </div>

        {/* Botão de Alternância de Tema Claro / Escuro no Header do Portal */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <button
            onClick={toggleTheme}
            title={isDarkMode ? "Mudar para Modo Claro" : "Mudar para Modo Escuro"}
            style={{
              background: 'var(--surface-low)',
              border: '1px solid var(--outline)',
              borderRadius: '50%',
              width: '40px',
              height: '40px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: 'var(--text-on-surface)',
              transition: 'background 0.2s, transform 0.2s',
              outline: 'none',
              boxShadow: 'var(--shadow-sm)'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = 'var(--surface-hover)';
              e.currentTarget.style.transform = 'scale(1.05)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = 'var(--surface-low)';
              e.currentTarget.style.transform = 'scale(1)';
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '20px', color: isDarkMode ? '#f59e0b' : 'var(--primary)' }}>
              {isDarkMode ? 'light_mode' : 'dark_mode'}
            </span>
          </button>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Acompanhamento do Cliente</span>
            <span style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-on-surface)' }}>{clientName}</span>
          </div>
        </div>
      </header>

      {/* Main Content Body */}
      <main style={{
        flex: 1,
        maxWidth: '1024px',
        width: '100%',
        margin: '0 auto',
        padding: '16px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px'
      }}>
        
        {/* Bento Grid Summary Section */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '16px'
        }}>
          
          {/* Card 1: SVG Progress Radial (Bento) */}
          <div className="glass-card" style={{
            padding: '12px 18px',
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            gap: '16px',
            minHeight: '80px',
            boxSizing: 'border-box'
          }}>
            <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg style={{ width: '60px', height: '60px' }}>
                <circle 
                  style={{ color: 'var(--surface-low)', stroke: 'currentColor' }} 
                  cx="30" cy="30" fill="transparent" r={radius} strokeWidth="5"
                />
                <circle 
                  style={{ 
                    color: 'var(--primary)', 
                    stroke: 'currentColor',
                    transition: 'stroke-dashoffset 0.5s ease-in-out',
                    transform: 'rotate(-90deg)',
                    transformOrigin: '50% 50%'
                  }} 
                  cx="30" cy="30" fill="transparent" r={radius} strokeLinecap="round" strokeWidth="5"
                  strokeDasharray={`${circumference} ${circumference}`}
                  strokeDashoffset={strokeDashoffset}
                />
              </svg>
              <span style={{ position: 'absolute', fontSize: '13px', fontWeight: 800, color: 'var(--primary)' }}>
                {progressPercent}%
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
                Progresso Geral
              </p>
              <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-on-surface)', marginTop: '2px', margin: 0 }}>
                Conclusão do Cronograma
              </p>
            </div>
          </div>

          {/* Card 2: Total de Tarefas */}
          <div className="glass-card" style={{
            padding: '12px 18px',
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            gap: '16px',
            minHeight: '80px',
            boxSizing: 'border-box'
          }}>
            <div style={{
              background: 'var(--surface-low)',
              borderRadius: '10px',
              width: '44px',
              height: '44px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <span className="material-symbols-outlined" style={{ color: 'var(--primary)', fontSize: '24px' }}>
                assignment
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
              <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
                Etapas de Trabalho
              </p>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '2px' }}>
                <h3 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-on-surface)', margin: 0 }}>
                  {totalTasks}
                </h3>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>total de etapas</span>
              </div>
              <div style={{ width: '100%', background: 'var(--surface-low)', height: '4px', borderRadius: 'var(--radius-full)', overflow: 'hidden', marginTop: '6px' }}>
                <div style={{ width: `${progressPercent}%`, background: 'var(--primary)', height: '100%' }}></div>
              </div>
            </div>
          </div>

          {/* Card 3: Status Em Execução */}
          <div className="glass-card" style={{
            padding: '12px 18px',
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            gap: '16px',
            minHeight: '80px',
            boxSizing: 'border-box'
          }}>
            <div style={{
              background: 'rgba(146, 71, 0, 0.08)',
              borderRadius: '10px',
              width: '44px',
              height: '44px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <span className="material-symbols-outlined" style={{ color: '#924700', fontSize: '24px' }}>
                pending_actions
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
                Etapas Ativas Hoje
              </p>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '2px' }}>
                <h3 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-on-surface)', margin: 0 }}>
                  {activeTasks}
                </h3>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>em andamento</span>
              </div>
            </div>
          </div>

        </div>

        {/* Read-only Task Tree View */}
        <div style={{ marginTop: '0px' }}>
          <TaskTable
            tasks={tasks}
            onAddTask={() => {}}
            onEditTask={() => {}}
            onDeleteTask={() => {}}
            isReadOnly={true}
          />
        </div>

        {/* Contact & Footer Section (SistemIA premium inspired layout) */}
        <div style={{
          display: 'flex',
          flexDirection: 'row',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'var(--surface-low)',
          border: '1px solid var(--outline)',
          color: 'var(--text-on-surface)',
          padding: '32px',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-md)',
          position: 'relative',
          overflow: 'hidden',
          gap: '20px',
          marginTop: '16px'
        }}>
          {/* Decorative background logo */}
          <div style={{
            position: 'absolute',
            right: '-40px',
            top: '-20px',
            opacity: 0.03,
            pointerEvents: 'none',
            color: 'var(--text-on-surface)'
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: '220px' }}>forum</span>
          </div>

          <div style={{ flex: 1, zIndex: 1, textAlign: 'left', width: '100%' }}>
            <h3 style={{ fontSize: '20px', fontWeight: 800, marginBottom: '6px', color: 'var(--text-on-surface)' }}>
              Tem dúvidas sobre o andamento físico do seu cronograma?
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', maxWidth: '580px', lineHeight: 1.5 }}>
              Nosso gerente de conta e líderes técnicos estão prontos para fornecer esclarecimentos sobre qualquer subtarefa ou data de entrega.
            </p>
          </div>

          <a 
            href={`mailto:suporte@sistemia.com?subject=Acompanhamento%20de%20Projeto%20-%20${encodeURIComponent(clientName)}`}
            style={{
              zIndex: 1,
              background: 'var(--primary)',
              color: '#ffffff',
              textDecoration: 'none',
              fontSize: '13px',
              fontWeight: 700,
              padding: '12px 24px',
              borderRadius: 'var(--radius-md)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: 'var(--shadow-sm)',
              transition: 'background 0.2s, transform 0.15s',
              whiteSpace: 'nowrap'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = 'var(--primary-hover)';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = 'var(--primary)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>chat</span>
            Contatar Gerente de Projeto
          </a>
        </div>

        {/* Footer info text */}
        <footer style={{ textAlign: 'center', padding: '16px 0', fontSize: '11px', color: 'var(--text-muted)' }}>
          Este é um documento de acompanhamento dinâmico oficial gerado eletronicamente por <strong>SistemIA Tarefas</strong>.
        </footer>

      </main>

    </div>
  );
};
