import React, { useState, useEffect } from 'react';
import { SideNavBar } from '../components/SideNavBar';
import { ClientProfileModal, type ClientProfile } from '../components/ClientProfileModal';
import { supabaseService } from '../supabaseClient';
import type { Task } from '../types';

type ViewMode = 'list' | 'card';

const ARCHIVED_KEY = 'archived_clients';
const IMPL_SPLIT_KEY = 'project_impl_split';
const CLIENT_PROFILES_KEY = 'client_profiles';

const loadProfiles = (): Record<string, ClientProfile> => {
  try { return JSON.parse(localStorage.getItem(CLIENT_PROFILES_KEY) || '{}'); } catch { return {}; }
};
const saveProfiles = (p: Record<string, ClientProfile>) =>
  localStorage.setItem(CLIENT_PROFILES_KEY, JSON.stringify(p));

const loadArchived = (): Set<string> => {
  try { return new Set(JSON.parse(localStorage.getItem(ARCHIVED_KEY) || '[]')); } catch { return new Set(); }
};
const saveArchived = (s: Set<string>) =>
  localStorage.setItem(ARCHIVED_KEY, JSON.stringify([...s]));

const calcMonths = (startDateStr: string): number => {
  if (!startDateStr) return 0;
  const start = new Date(startDateStr + 'T00:00:00');
  const now = new Date();
  if (now < start) return 0;
  let months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
  if (now.getDate() >= start.getDate()) months++;
  return Math.max(0, months);
};

export const Clients: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedClientId, setCopiedClientId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [expandedClient, setExpandedClient] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [archivedClients, setArchivedClients] = useState<Set<string>>(loadArchived);
  const [clientMenuOpen, setClientMenuOpen] = useState<string | null>(null);
  const [editingClientProfile, setEditingClientProfile] = useState<{ id: string; name: string } | null>(null);
  const [deletingClient, setDeletingClient] = useState<{ id: string; name: string } | null>(null);
  const [creatingClient, setCreatingClient] = useState(false);
  const [profiles, setProfiles] = useState<Record<string, ClientProfile>>(loadProfiles);

  const [clients, setClients] = useState<{
    id: string; name: string; shareToken: string;
  }[]>([]);

  // Configurações de compartilhamento
  const [shareSettings, setShareSettings] = useState<Record<string, {
    accessType: 'public' | 'password' | 'email';
    password?: string;
    allowedEmails?: string[];
  }>>({});

  useEffect(() => {
    const loaded: typeof shareSettings = {};
    clients.forEach(c => {
      const stored = localStorage.getItem(`client_share_settings_${c.name}`);
      try { loaded[c.name] = stored ? JSON.parse(stored) : { accessType: 'public' }; }
      catch { loaded[c.name] = { accessType: 'public' }; }
    });
    setShareSettings(loaded);
  }, [clients]);

  const handleUpdateShareSetting = (name: string, updates: Partial<{
    accessType: 'public' | 'password' | 'email'; password: string; allowedEmails: string[];
  }>) => {
    setShareSettings(prev => {
      const updated = { ...(prev[name] || { accessType: 'public' }), ...updates };
      localStorage.setItem(`client_share_settings_${name}`, JSON.stringify(updated));
      return { ...prev, [name]: updated };
    });
  };

  const [draftPasswords, setDraftPasswords] = useState<Record<string, string>>({});
  const [draftEmails, setDraftEmails] = useState<Record<string, string>>({});
  const [savedFeedback, setSavedFeedback] = useState<Record<string, boolean>>({});

  const getDraftPassword = (n: string) =>
    draftPasswords[n] !== undefined ? draftPasswords[n] : (shareSettings[n]?.password || '');
  const getDraftEmails = (n: string) =>
    draftEmails[n] !== undefined ? draftEmails[n] : (shareSettings[n]?.allowedEmails?.join(', ') || '');

  // Arquivamento
  const toggleArchive = (name: string) => {
    setArchivedClients(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else { next.add(name); setExpandedClient(null); }
      saveArchived(next);
      return next;
    });
  };

  useEffect(() => {
    const fetchAllData = async () => {
      setLoading(true);
      try {
        const uniqueNames = await supabaseService.fetchUniqueClients();
        const results = await Promise.all(uniqueNames.map(async name => {
          const [taskTree, token] = await Promise.all([
            supabaseService.fetchTasksTree(name),
            supabaseService.getShareToken(name),
          ]);
          return { name, taskTree, token };
        }));

        setTasks(results.flatMap(r => r.taskTree));
        setClients(results.map(r => ({ id: r.name, name: r.name, shareToken: r.token })));
      } catch (err) {
        console.error('Erro ao buscar dados:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchAllData();
  }, []);

  const handleGenerateNewToken = async (clientId: string, name: string) => {
    try {
      const token = await supabaseService.regenerateShareToken(name);
      setClients(prev => prev.map(c => c.id === clientId ? { ...c, shareToken: token } : c));
      alert(`Novo token gerado com sucesso para ${name}!`);
    } catch { alert('Falha ao regerar token.'); }
  };

  const getFullShareUrl = (token: string) => `${window.location.origin}/share/${token}`;
  const handleCopyLink = (clientId: string, token: string) => {
    navigator.clipboard.writeText(getFullShareUrl(token));
    setCopiedClientId(clientId);
    setTimeout(() => setCopiedClientId(null), 2000);
  };

  const fmt = (v: number) =>
    new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);

  // Soma todos os projetos (root tasks) do cliente — lê dados do localStorage de Projects
  const getClientFinancialSummary = (clientName: string) => {
    const clientRootTasks = tasks.filter(t => t.client_name === clientName && t.parent_id === null);
    let implRecebido = 0, implPendente = 0, mensalAcumulado = 0;
    const projects: { id: string; name: string; implRecebido: number; implPendente: number; mensal: number; mensalMeses: number }[] = [];
    try {
      const implData: Record<string, {
        entradaValue: string; entradaStatus: string;
        entregaValue: string; entregaStatus: string;
        mensalValue: string; mensalStartDate: string;
      }> = JSON.parse(localStorage.getItem(IMPL_SPLIT_KEY) || '{}');

      clientRootTasks.forEach(t => {
        const split = implData[t.id];
        let pImplRec = 0, pImplPend = 0, pMensal = 0, pMeses = 0;
        if (split) {
          const entradaVal = parseFloat(split.entradaValue) || 0;
          const entregaVal = parseFloat(split.entregaValue) || 0;
          if (split.entradaStatus === 'recebido') pImplRec += entradaVal; else if (split.entradaStatus !== 'na') pImplPend += entradaVal;
          if (split.entregaStatus === 'recebido') pImplRec += entregaVal; else if (split.entregaStatus !== 'na') pImplPend += entregaVal;
          if (split.mensalStartDate && (parseFloat(split.mensalValue) || 0) > 0) {
            pMeses = calcMonths(split.mensalStartDate);
            pMensal = pMeses * (parseFloat(split.mensalValue) || 0);
          }
        } else {
          pImplPend = t.contract_value;
        }
        implRecebido += pImplRec;
        implPendente += pImplPend;
        mensalAcumulado += pMensal;
        projects.push({ id: t.id, name: t.description, implRecebido: pImplRec, implPendente: pImplPend, mensal: pMensal, mensalMeses: pMeses });
      });
    } catch { /* ignore */ }
    return { implRecebido, implPendente, mensalAcumulado, projectCount: clientRootTasks.length, projects };
  };

  // Painel de detalhes (usado em ambos os modos)
  const ClientDetailPanel = ({ client }: { client: typeof clients[0] }) => {
    const isCopied = copiedClientId === client.id;
    const isArchived = archivedClients.has(client.name);
    const fin = getClientFinancialSummary(client.name);
    const profile = profiles[client.name];

    const profileField = (icon: string, label: string, value?: string) =>
      value ? (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
          <span className="material-symbols-outlined" style={{ fontSize: '15px', color: 'var(--primary)', marginTop: '1px', flexShrink: 0 }}>{icon}</span>
          <div>
            <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
            <div style={{ fontSize: '13px', color: 'var(--text-on-surface)', marginTop: '1px' }}>{value}</div>
          </div>
        </div>
      ) : null;

    const fullAddress = profile ? [profile.street && `${profile.street}${profile.number ? ', ' + profile.number : ''}${profile.complement ? ' – ' + profile.complement : ''}`, profile.neighborhood, profile.city && profile.state ? `${profile.city} – ${profile.state}` : (profile.city || profile.state), profile.cep].filter(Boolean).join('\n') : '';

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

        {/* Perfil da empresa */}
        {profile && (profile.cnpj || profile.email || profile.phone || profile.contact || fullAddress) && (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--outline)', borderRadius: 'var(--radius-lg)', padding: '16px' }}>
            <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>Dados da empresa</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
              {profileField('badge', 'CNPJ', profile.cnpj)}
              {profileField('person', 'Responsável', profile.contact)}
              {profileField('email', 'E-mail', profile.email)}
              {profileField('phone', 'Telefone', profile.phone)}
              {fullAddress && profileField('location_on', 'Endereço', fullAddress.replace(/\n/g, ', '))}
              {profile.notes && profileField('notes', 'Obs.', profile.notes)}
            </div>
          </div>
        )}
        {/* Financeiro: Implantação + Mensalidade lado a lado */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>

          {/* Implantação — soma de todos os projetos do cliente */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--outline)', borderRadius: 'var(--radius-lg)', padding: '16px' }}>
            <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>IMPLANTAÇÃO</p>
            <p style={{ fontSize: '24px', fontWeight: 800, color: '#10b981', marginBottom: '12px' }}>
              {fmt(fin.implRecebido)}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>Recebido</span>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#10b981' }}>{fmt(fin.implRecebido)}</span>
              </div>
              <div style={{ borderTop: '1px solid var(--outline)' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>Pendente</span>
                <span style={{ fontSize: '13px', fontWeight: 700, color: fin.implPendente > 0 ? '#f59e0b' : 'var(--text-muted)' }}>{fmt(fin.implPendente)}</span>
              </div>
            </div>
            {fin.projectCount > 1 && (
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}>{fin.projectCount} projetos somados</p>
            )}
          </div>

          {/* Mensalidades Acumuladas */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--outline)', borderRadius: 'var(--radius-lg)', padding: '16px' }}>
            <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>MENSALIDADES ACUMULADAS</p>
            {fin.mensalAcumulado > 0 ? (
              <>
                <p style={{ fontSize: '24px', fontWeight: 800, color: '#10b981', marginBottom: '8px' }}>
                  {fmt(fin.mensalAcumulado)}
                </p>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Total somado de {fin.projectCount} projeto{fin.projectCount !== 1 ? 's' : ''} até hoje
                </p>
              </>
            ) : (
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                Nenhuma mensalidade configurada nos projetos.
              </p>
            )}
          </div>
        </div>

        {/* Detalhamento por Projeto */}
        {fin.projects.length > 0 && (
          <div style={{ borderTop: '1px solid var(--outline)', paddingTop: '16px' }}>
            <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>Detalhamento por Projeto</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {/* Cabeçalho */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 110px 110px 110px', gap: '8px', padding: '4px 10px' }}>
                {['Projeto', 'Impl. Recebida', 'Mensalidades', 'Total'].map((h, i) => (
                  <span key={i} style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textAlign: i > 0 ? 'right' : 'left' }}>{h}</span>
                ))}
              </div>
              {fin.projects.map(p => {
                const total = p.implRecebido + p.mensal;
                return (
                  <div key={p.id} style={{ display: 'grid', gridTemplateColumns: '1fr 110px 110px 110px', gap: '8px', padding: '8px 10px', background: 'var(--surface)', border: '1px solid var(--outline)', borderRadius: 'var(--radius-md)', alignItems: 'center' }}>
                    <div>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-on-surface)' }}>{p.name || '—'}</span>
                      {p.implPendente > 0 && (
                        <div style={{ fontSize: '11px', color: '#f59e0b', marginTop: '1px' }}>{fmt(p.implPendente)} impl. pendente</div>
                      )}
                    </div>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: p.implRecebido > 0 ? '#10b981' : 'var(--text-muted)', textAlign: 'right' }}>
                      {p.implRecebido > 0 ? fmt(p.implRecebido) : '—'}
                    </span>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: p.mensal > 0 ? 'var(--primary)' : 'var(--text-muted)', textAlign: 'right' }}>
                      {p.mensal > 0 ? `${fmt(p.mensal)}` : '—'}
                      {p.mensalMeses > 0 && <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 400, display: 'block' }}>{p.mensalMeses} {p.mensalMeses === 1 ? 'mês' : 'meses'}</span>}
                    </span>
                    <span style={{ fontSize: '13px', fontWeight: 800, color: total > 0 ? 'var(--text-on-surface)' : 'var(--text-muted)', textAlign: 'right' }}>
                      {total > 0 ? fmt(total) : '—'}
                    </span>
                  </div>
                );
              })}
              {/* Linha de total geral */}
              {fin.projects.length > 1 && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 110px 110px 110px', gap: '8px', padding: '8px 10px', borderTop: '2px solid var(--outline-variant)', marginTop: '2px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>Total geral</span>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#10b981', textAlign: 'right' }}>{fmt(fin.implRecebido)}</span>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--primary)', textAlign: 'right' }}>{fmt(fin.mensalAcumulado)}</span>
                  <span style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-on-surface)', textAlign: 'right' }}>{fmt(fin.implRecebido + fin.mensalAcumulado)}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Link de compartilhamento */}
        <div style={{ borderTop: '1px solid var(--outline)', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#10b981', flexShrink: 0 }} />
            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>PORTAL SEGURO DO CLIENTE</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
            <div style={{ background: 'var(--background)', border: '1px solid var(--outline)', borderRadius: 'var(--radius-md)', padding: '8px 14px', fontSize: '12px', fontFamily: 'monospace', color: 'var(--text-on-surface)', flex: 1, minWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {getFullShareUrl(client.shareToken)}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => handleCopyLink(client.id, client.shareToken)}
                style={{ background: isCopied ? '#10b981' : 'var(--primary)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', padding: '8px 14px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', height: '36px' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>{isCopied ? 'done' : 'content_copy'}</span>
                {isCopied ? 'Copiado!' : 'Copiar'}
              </button>
              <button onClick={() => handleGenerateNewToken(client.id, client.name)}
                style={{ background: 'var(--surface)', border: '1px solid var(--outline)', color: 'var(--text-muted-dark)', borderRadius: 'var(--radius-md)', padding: '8px 14px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', height: '36px' }}
                onMouseOver={e => e.currentTarget.style.background = 'var(--surface-low)'}
                onMouseOut={e => e.currentTarget.style.background = 'var(--surface)'}>
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>sync</span>
                Regerar
              </button>
            </div>
          </div>

          {/* Controle de acesso */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(255,255,255,0.4)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', border: '1px solid rgba(0,0,0,0.07)', borderRadius: '10px', padding: '7px 14px', flexWrap: 'wrap' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '16px', color: shareSettings[client.name]?.accessType === 'public' ? '#10b981' : 'var(--primary)' }}>
              {shareSettings[client.name]?.accessType === 'public' ? 'visibility' : shareSettings[client.name]?.accessType === 'password' ? 'lock' : 'mail_lock'}
            </span>
            <select value={shareSettings[client.name]?.accessType || 'public'} onChange={e => handleUpdateShareSetting(client.name, { accessType: e.target.value as 'public' | 'password' | 'email' })}
              style={{ padding: '3px 8px', borderRadius: '7px', border: '1px solid rgba(0,0,0,0.08)', background: '#fff', color: 'var(--text-on-surface)', fontSize: '12px', fontWeight: 600, outline: 'none', cursor: 'pointer', height: '26px' }}>
              <option value="public">🔓 Público</option>
              <option value="password">🔑 Por Senha</option>
              <option value="email">📧 Por E-mails</option>
            </select>
            {shareSettings[client.name]?.accessType === 'password' && (
              <>
                <input type="text" placeholder="Senha do portal" value={getDraftPassword(client.name)} onChange={e => setDraftPasswords(p => ({ ...p, [client.name]: e.target.value }))}
                  style={{ width: '150px', background: '#fff', border: '1px solid rgba(0,0,0,0.08)', borderRadius: '7px', padding: '3px 8px', fontSize: '12px', color: 'var(--text-on-surface)', outline: 'none', height: '26px' }} />
                {getDraftPassword(client.name) !== (shareSettings[client.name]?.password || '') && (
                  <button onClick={() => { handleUpdateShareSetting(client.name, { password: getDraftPassword(client.name) }); setSavedFeedback(p => ({ ...p, [client.name]: true })); setTimeout(() => setSavedFeedback(p => ({ ...p, [client.name]: false })), 2000); }}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: savedFeedback[client.name] ? '#10b981' : 'var(--primary)', color: '#fff', border: 'none', borderRadius: '7px', padding: '0 12px', height: '26px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>
                    {savedFeedback[client.name] ? 'Salvo!' : 'Salvar'}
                  </button>
                )}
              </>
            )}
            {shareSettings[client.name]?.accessType === 'email' && (
              <>
                <input type="text" placeholder="E-mails separados por vírgula" value={getDraftEmails(client.name)} onChange={e => setDraftEmails(p => ({ ...p, [client.name]: e.target.value }))}
                  style={{ width: '220px', background: '#fff', border: '1px solid rgba(0,0,0,0.08)', borderRadius: '7px', padding: '3px 8px', fontSize: '12px', color: 'var(--text-on-surface)', outline: 'none', height: '26px' }} />
                {getDraftEmails(client.name) !== (shareSettings[client.name]?.allowedEmails?.join(', ') || '') && (
                  <button onClick={() => { handleUpdateShareSetting(client.name, { allowedEmails: getDraftEmails(client.name).split(',').map(e => e.trim()).filter(Boolean) }); setSavedFeedback(p => ({ ...p, [client.name]: true })); setTimeout(() => setSavedFeedback(p => ({ ...p, [client.name]: false })), 2000); }}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: savedFeedback[client.name] ? '#10b981' : 'var(--primary)', color: '#fff', border: 'none', borderRadius: '7px', padding: '0 12px', height: '26px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>
                    {savedFeedback[client.name] ? 'Salvo!' : 'Salvar'}
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Arquivar */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--outline)', paddingTop: '14px' }}>
          <button onClick={() => toggleArchive(client.name)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: isArchived ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.08)', border: `1px solid ${isArchived ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.2)'}`, borderRadius: 'var(--radius-md)', padding: '7px 14px', fontSize: '12px', fontWeight: 700, color: isArchived ? '#10b981' : '#ef4444', cursor: 'pointer' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>{isArchived ? 'unarchive' : 'archive'}</span>
            {isArchived ? 'Desarquivar cliente' : 'Arquivar cliente'}
          </button>
        </div>
      </div>
    );
  };

  const refreshClients = async () => {
    const names = await supabaseService.fetchUniqueClients();
    const tokens = await Promise.all(names.map(n => supabaseService.getShareToken(n)));
    setClients(names.map((name, i) => ({ id: name, name, shareToken: tokens[i] })));
    const allResults = await Promise.all(names.map(n => supabaseService.fetchTasksTree(n)));
    setTasks(allResults.flat());
  };

  const handleSaveProfile = async (profile: ClientProfile) => {
    const oldName = editingClientProfile?.name;
    // Rename tasks if name changed
    if (oldName && oldName !== profile.name) {
      try { await supabaseService.renameClient(oldName, profile.name); } catch (e) { console.error(e); }
    }
    // Save profile (keyed by current name)
    const updated = { ...loadProfiles() };
    if (oldName && oldName !== profile.name) delete updated[oldName];
    updated[profile.name] = profile;
    saveProfiles(updated);
    setProfiles(updated);
    await refreshClients();
    setEditingClientProfile(null);
  };

  const handleCreateClientProfile = async (profile: ClientProfile) => {
    // Save profile to localStorage
    const updated = { ...loadProfiles(), [profile.name]: profile };
    saveProfiles(updated);
    setProfiles(updated);
    // Create a placeholder root task so the client appears in the tasks system
    try {
      const today = new Date().toISOString().split('T')[0];
      await supabaseService.createTask({ description: 'Projeto inicial', client_name: profile.name, contract_value: 0, status: 'A Fazer', start_date: today, end_date: today, parent_id: null });
      await refreshClients();
    } catch (e) { console.error(e); }
    setCreatingClient(false);
  };

  const handleDeleteClient = async () => {
    if (!deletingClient) return;
    try { await supabaseService.deleteClientTasks(deletingClient.name); } catch (e) { console.error(e); }
    const updated = { ...loadProfiles() };
    delete updated[deletingClient.name];
    saveProfiles(updated);
    setProfiles(updated);
    await refreshClients();
    setDeletingClient(null);
  };

  const ClientRowMenu = ({ client }: { client: { id: string; name: string; shareToken: string } }) => {
    const isOpen = clientMenuOpen === client.id;
    const isArch = archivedClients.has(client.name);
    const itemStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '8px 14px', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 500, color: 'var(--text-on-surface)', textAlign: 'left', whiteSpace: 'nowrap' };
    return (
      <div style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
        <button onClick={() => setClientMenuOpen(isOpen ? null : client.id)}
          style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', color: 'var(--text-muted)' }}
          onMouseOver={e => e.currentTarget.style.background = 'var(--surface-hover)'}
          onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>more_vert</span>
        </button>
        {isOpen && (
          <>
            <div style={{ position: 'fixed', inset: 0, zIndex: 49 }} onClick={() => setClientMenuOpen(null)} />
            <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 4px)', zIndex: 50, background: 'var(--surface-high)', border: '1px solid var(--outline-variant)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-lg)', minWidth: '160px', overflow: 'hidden', padding: '4px 0' }}>
              <button style={itemStyle} onMouseOver={e => e.currentTarget.style.background = 'var(--surface-hover)'} onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                onClick={() => { setEditingClientProfile(client); setClientMenuOpen(null); }}>
                <span className="material-symbols-outlined" style={{ fontSize: '16px', color: 'var(--primary)' }}>edit</span>
                Editar cadastro
              </button>
              <button style={itemStyle} onMouseOver={e => e.currentTarget.style.background = 'var(--surface-hover)'} onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                onClick={() => { toggleArchive(client.name); setClientMenuOpen(null); }}>
                <span className="material-symbols-outlined" style={{ fontSize: '16px', color: 'var(--text-muted)' }}>{isArch ? 'unarchive' : 'archive'}</span>
                {isArch ? 'Desarquivar' : 'Arquivar'}
              </button>
              <div style={{ borderTop: '1px solid var(--outline)', margin: '4px 0' }} />
              <button style={{ ...itemStyle, color: '#ef4444' }} onMouseOver={e => e.currentTarget.style.background = 'rgba(239,68,68,0.08)'} onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                onClick={() => { setDeletingClient(client); setClientMenuOpen(null); }}>
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>delete</span>
                Excluir
              </button>
            </div>
          </>
        )}
      </div>
    );
  };

  const activeClients = clients.filter(c => !archivedClients.has(c.name));
  const archivedList = clients.filter(c => archivedClients.has(c.name));
  const visibleClients = showArchived ? archivedList : activeClients;

  return (
    <div className="layout-container">
      <SideNavBar activePage="clients" />

      <main className="main-content" style={{ display: 'flex', flexDirection: 'column' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', borderBottom: '1px solid var(--outline)', paddingBottom: '16px' }}>
          <div>
            <h2 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-on-surface)' }}>Gestão de Clientes</h2>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Faturamentos, mensalidades e links de acompanhamento</p>
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button onClick={() => setCreatingClient(true)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'var(--primary)', border: 'none', borderRadius: 'var(--radius-md)', padding: '8px 14px', fontSize: '13px', fontWeight: 700, color: '#fff', cursor: 'pointer' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>add</span>
              Novo Cliente
            </button>
            {(archivedList.length > 0 || showArchived) && (
              <button onClick={() => setShowArchived(v => !v)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: showArchived ? 'var(--surface-high)' : 'var(--surface-low)', border: '1px solid var(--outline)', borderRadius: 'var(--radius-md)', padding: '5px 12px', fontSize: '12px', fontWeight: 600, color: showArchived ? 'var(--text-on-surface)' : 'var(--text-muted)', cursor: 'pointer' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>{showArchived ? 'folder_open' : 'archive'}</span>
                {showArchived ? 'Ver ativos' : `Arquivados (${archivedList.length})`}
              </button>
            )}
            <div style={{ display: 'flex', gap: '2px', background: 'var(--surface-low)', border: '1px solid var(--outline)', borderRadius: 'var(--radius-md)', padding: '3px' }}>
              {(['list', 'card'] as ViewMode[]).map(mode => (
                <button key={mode} onClick={() => { setViewMode(mode); setExpandedClient(null); }} title={mode === 'list' ? 'Modo lista' : 'Modo cards'}
                  style={{ background: viewMode === mode ? 'var(--surface-high)' : 'transparent', border: viewMode === mode ? '1px solid var(--outline-variant)' : '1px solid transparent', borderRadius: 'var(--radius-sm)', color: viewMode === mode ? 'var(--text-on-surface)' : 'var(--text-muted)', width: '30px', height: '26px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>{mode === 'list' ? 'view_list' : 'grid_view'}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {loading ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '300px', flexDirection: 'column', gap: '12px' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '48px', color: 'var(--primary)', animation: 'spin 1.5s linear infinite' }}>sync</span>
            <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>Carregando dados dos clientes...</p>
            <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
          </div>

        ) : visibleClients.length === 0 ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', minHeight: '200px', color: 'var(--text-muted)' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '48px' }}>inbox</span>
            <p style={{ fontSize: '14px' }}>{showArchived ? 'Nenhum cliente arquivado.' : 'Nenhum cliente ativo.'}</p>
          </div>

        ) : viewMode === 'list' ? (

          /* ── MODO LISTA COM EXPANSÃO ── */
          <div style={{ border: '1px solid var(--outline)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '32px 1fr 180px 36px', padding: '8px 16px', background: 'var(--surface-low)', borderBottom: '1px solid var(--outline)' }}>
              {['', 'Cliente', 'Total Recebido', ''].map((col, i) => (
                <span key={i} style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{col}</span>
              ))}
            </div>

            {visibleClients.map((client, idx) => {
              const fin = getClientFinancialSummary(client.name);
              const isExpanded = expandedClient === client.id;
              const isArchived = archivedClients.has(client.name);
              const isLast = idx === visibleClients.length - 1;
              return (
                <React.Fragment key={client.id}>
                  <div onClick={() => setExpandedClient(isExpanded ? null : client.id)}
                    style={{ display: 'grid', gridTemplateColumns: '32px 1fr 180px 36px', padding: '13px 16px', alignItems: 'center', borderBottom: (isExpanded || !isLast) ? '1px solid var(--outline)' : 'none', background: isExpanded ? 'var(--surface-hover)' : 'var(--surface)', cursor: 'pointer', transition: 'background 0.12s', userSelect: 'none', opacity: isArchived ? 0.65 : 1 }}
                    onMouseOver={e => { if (!isExpanded) e.currentTarget.style.background = 'var(--surface-hover)'; }}
                    onMouseOut={e => { if (!isExpanded) e.currentTarget.style.background = 'var(--surface)'; }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--text-muted)', transition: 'transform 0.2s', transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>chevron_right</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '18px', color: isArchived ? 'var(--text-muted)' : 'var(--primary)' }}>{isArchived ? 'archive' : 'business'}</span>
                      <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-on-surface)' }}>{client.name}</span>
                      {isArchived && <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', background: 'var(--surface-low)', border: '1px solid var(--outline)', borderRadius: '4px', padding: '1px 6px', textTransform: 'uppercase' }}>Arquivado</span>}
                    </div>
                    <div>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: (fin.implRecebido + fin.mensalAcumulado) > 0 ? '#10b981' : 'var(--text-muted)' }}>
                        {(fin.implRecebido + fin.mensalAcumulado) > 0 ? fmt(fin.implRecebido + fin.mensalAcumulado) : '—'}
                      </span>
                      {fin.implPendente > 0 && (
                        <div style={{ fontSize: '11px', color: '#f59e0b', marginTop: '2px' }}>{fmt(fin.implPendente)} pendente</div>
                      )}
                    </div>
                    <ClientRowMenu client={client} />
                  </div>

                  {isExpanded && (
                    <div style={{ padding: '24px', background: 'var(--surface-low)', borderBottom: !isLast ? '1px solid var(--outline)' : 'none', animation: 'fadeInUp 0.18s ease' }}>
                      <ClientDetailPanel client={client} />
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>

        ) : (

          /* ── MODO CARD ── */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {visibleClients.map(client => (
              <div key={client.id} className="glass-card"
                style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', border: '1px solid var(--outline)', opacity: archivedClients.has(client.name) ? 0.65 : 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '20px', color: archivedClients.has(client.name) ? 'var(--text-muted)' : 'var(--primary)' }}>
                    {archivedClients.has(client.name) ? 'archive' : 'business'}
                  </span>
                  <h3 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-on-surface)' }}>{client.name}</h3>
                  {archivedClients.has(client.name) && <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', background: 'var(--surface-low)', border: '1px solid var(--outline)', borderRadius: '4px', padding: '2px 7px', textTransform: 'uppercase' }}>Arquivado</span>}
                </div>
                <ClientDetailPanel client={client} />
              </div>
            ))}
          </div>
        )}

      </main>

      {/* Novo cliente — cadastro completo */}
      <ClientProfileModal
        isOpen={creatingClient}
        onClose={() => setCreatingClient(false)}
        onSubmit={handleCreateClientProfile}
      />

      {/* Editar cadastro do cliente */}
      <ClientProfileModal
        isOpen={!!editingClientProfile}
        onClose={() => setEditingClientProfile(null)}
        onSubmit={handleSaveProfile}
        initial={editingClientProfile ? (profiles[editingClientProfile.name] || { name: editingClientProfile.name }) : undefined}
        isEdit
      />

      {/* Excluir cliente */}
      {deletingClient && (
        <div onClick={() => setDeletingClient(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface)', border: '1px solid var(--outline)', borderRadius: 'var(--radius-lg)', padding: '28px', maxWidth: '400px', width: '100%', boxShadow: 'var(--shadow-lg)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '24px', color: '#ef4444' }}>warning</span>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-on-surface)' }}>Excluir cliente</h3>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '24px', lineHeight: 1.6 }}>
              Tem certeza que deseja excluir <strong>{deletingClient.name}</strong>? Todos os projetos e tarefas deste cliente serão removidos permanentemente.
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => setDeletingClient(null)} style={{ padding: '8px 20px', background: 'var(--surface-low)', border: '1px solid var(--outline)', borderRadius: 'var(--radius-md)', fontSize: '13px', fontWeight: 600, color: 'var(--text-muted-dark)', cursor: 'pointer' }}>Cancelar</button>
              <button onClick={handleDeleteClient} style={{ padding: '8px 20px', background: '#ef4444', border: 'none', borderRadius: 'var(--radius-md)', fontSize: '13px', fontWeight: 700, color: '#fff', cursor: 'pointer' }}>Excluir</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
