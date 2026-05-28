import React, { useState, useEffect, useRef, useCallback } from 'react';
import { SideNavBar } from '../components/SideNavBar';

type Theme = 'dark' | 'light';
type ConnStatus = 'idle' | 'creating' | 'qr' | 'connected' | 'error';

const INSTANCE = 'sistemia-tarefas';
const SUPA_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPA_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

const supaHdr = {
  apikey: SUPA_KEY,
  Authorization: `Bearer ${SUPA_KEY}`,
  'Content-Type': 'application/json',
};

const applyTheme = (t: Theme) => {
  localStorage.setItem('theme', t);
  document.body.classList.toggle('light-theme', t === 'light');
};

interface NotifCfg {
  evolution_url: string;
  evolution_api_key: string;
  whatsapp_number: string;
  notify_expiring: boolean;
  expiring_days_before: number;
  notify_due_today: boolean;
  notify_overdue: boolean;
  connected: boolean;
}

const defaultCfg = (): NotifCfg => ({
  evolution_url: '',
  evolution_api_key: '',
  whatsapp_number: '',
  notify_expiring: false,
  expiring_days_before: 3,
  notify_due_today: true,
  notify_overdue: true,
  connected: false,
});

const SQL_SETUP = `-- Execute no Supabase → SQL Editor

CREATE TABLE IF NOT EXISTS sia_tarefas_notif_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  evolution_url TEXT DEFAULT '',
  evolution_instance TEXT DEFAULT 'sistemia-tarefas',
  evolution_api_key TEXT DEFAULT '',
  whatsapp_number TEXT DEFAULT '',
  notify_expiring BOOLEAN DEFAULT false,
  expiring_days_before INTEGER DEFAULT 3,
  notify_due_today BOOLEAN DEFAULT true,
  notify_overdue BOOLEAN DEFAULT true,
  connected BOOLEAN DEFAULT false,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO sia_tarefas_notif_settings (id)
VALUES (1) ON CONFLICT (id) DO NOTHING;

ALTER TABLE sia_tarefas_notif_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all" ON sia_tarefas_notif_settings
  FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS sia_tarefas_notif_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL,
  notif_type TEXT NOT NULL,
  date_key TEXT NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (task_id, notif_type, date_key)
);

ALTER TABLE sia_tarefas_notif_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all" ON sia_tarefas_notif_log
  FOR ALL USING (true) WITH CHECK (true);`;

// ── helpers ──────────────────────────────────────────────────────────────────

const evHdr = (key: string) => ({ 'Content-Type': 'application/json', apikey: key });

async function evCreateInstance(url: string, key: string) {
  const r = await fetch(`${url}/instance/create`, {
    method: 'POST',
    headers: evHdr(key),
    body: JSON.stringify({ instanceName: INSTANCE, qrcode: true, integration: 'WHATSAPP-BAILEYS' }),
  });
  return r;
}

async function evGetQr(url: string, key: string): Promise<string | null> {
  const r = await fetch(`${url}/instance/connect/${INSTANCE}`, { headers: evHdr(key) });
  if (!r.ok) return null;
  const d = await r.json();
  return d?.base64 ?? d?.qrcode?.base64 ?? null;
}

async function evState(url: string, key: string): Promise<string> {
  try {
    const r = await fetch(`${url}/instance/connectionState/${INSTANCE}`, { headers: evHdr(key) });
    if (!r.ok) return 'unknown';
    const d = await r.json();
    return d?.instance?.state ?? d?.state ?? 'unknown';
  } catch { return 'unknown'; }
}

async function evDisconnect(url: string, key: string) {
  await fetch(`${url}/instance/logout/${INSTANCE}`, { method: 'DELETE', headers: evHdr(key) });
}

// ── component ─────────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  padding: '9px 12px', borderRadius: 'var(--radius-md)',
  border: '1px solid var(--outline-variant)', fontSize: '13px',
  background: 'var(--surface-low)', color: 'var(--text-on-surface)',
  outline: 'none', width: '100%',
};
const labelStyle: React.CSSProperties = {
  fontSize: '12px', fontWeight: 600, color: 'var(--text-muted-dark)',
};

const sectionTitle = (icon: string, label: string) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
    <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--primary)' }}>{icon}</span>
    <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-on-surface)' }}>{label}</h3>
  </div>
);

interface CustomStatus { id: string; label: string; category: string; color: string; icon: string; }
interface CustomField { key: string; label: string; optionColors?: Record<string, string>; bgColor?: string; }

export const Settings: React.FC = () => {
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem('theme') as Theme) || 'dark'
  );

  // ── Personalização ──
  const [customStatuses, setCustomStatuses] = useState<CustomStatus[]>(() => {
    try { return JSON.parse(localStorage.getItem('custom_statuses_list') || '[]'); } catch { return []; }
  });
  const [customFields, setCustomFields] = useState<CustomField[]>(() => {
    try { return JSON.parse(localStorage.getItem('custom_fields_list') || '[]'); } catch { return []; }
  });
  const [knownClients, setKnownClients] = useState<string[]>([]);
  const [renamingClient, setRenamingClient] = useState<string | null>(null);
  const [newClientName, setNewClientName] = useState('');
  const [clientSaveMsg, setClientSaveMsg] = useState('');
  const [statusSaveMsg, setStatusSaveMsg] = useState('');

  useEffect(() => {
    // Busca clientes únicos do Supabase
    const fetchClients = async () => {
      try {
        const r = await fetch(`${SUPA_URL}/rest/v1/sia_tarefas_tasks?select=client_name&client_name=not.is.null`, {
          headers: supaHdr,
        });
        if (r.ok) {
          const data: { client_name: string }[] = await r.json();
          const unique = [...new Set(data.map(d => d.client_name).filter(Boolean))].sort();
          setKnownClients(unique);
        }
      } catch { /* ignore */ }
    };
    fetchClients();
  }, []);

  const getClientColor = (client: string) => {
    const field = customFields.find(f => f.key === 'cliente_ecosystem');
    return field?.optionColors?.[client] || field?.bgColor || '#6366f1';
  };

  const updateClientColor = (client: string, color: string) => {
    const updated = customFields.map(f =>
      f.key === 'cliente_ecosystem' ? { ...f, optionColors: { ...(f.optionColors || {}), [client]: color } } : f
    );
    setCustomFields(updated);
    localStorage.setItem('custom_fields_list', JSON.stringify(updated));
  };

  const renameClient = async (oldName: string, newName: string) => {
    if (!newName.trim() || newName === oldName) { setRenamingClient(null); return; }
    try {
      const r = await fetch(`${SUPA_URL}/rest/v1/sia_tarefas_tasks?client_name=eq.${encodeURIComponent(oldName)}`, {
        method: 'PATCH',
        headers: { ...supaHdr, Prefer: 'return=minimal' },
        body: JSON.stringify({ client_name: newName.trim() }),
      });
      if (!r.ok) throw new Error('Erro ao renomear');
      // Migra cor para o novo nome
      const field = customFields.find(f => f.key === 'cliente_ecosystem');
      if (field?.optionColors?.[oldName]) {
        const newOptColors = { ...(field.optionColors || {}) };
        newOptColors[newName.trim()] = newOptColors[oldName];
        delete newOptColors[oldName];
        const updated = customFields.map(f => f.key === 'cliente_ecosystem' ? { ...f, optionColors: newOptColors } : f);
        setCustomFields(updated);
        localStorage.setItem('custom_fields_list', JSON.stringify(updated));
      }
      setKnownClients(prev => prev.map(c => c === oldName ? newName.trim() : c));
      setClientSaveMsg('Cliente renomeado!');
      setTimeout(() => setClientSaveMsg(''), 3000);
    } catch { setClientSaveMsg('Erro ao renomear.'); setTimeout(() => setClientSaveMsg(''), 3000); }
    setRenamingClient(null);
  };

  const updateStatusColor = (id: string, color: string) => {
    const updated = customStatuses.map(s => s.id === id ? { ...s, color } : s);
    setCustomStatuses(updated);
    localStorage.setItem('custom_statuses_list', JSON.stringify(updated));
    window.dispatchEvent(new Event('customStatusesChanged'));
  };

  const renameStatus = (id: string, label: string) => {
    const updated = customStatuses.map(s => s.id === id ? { ...s, label } : s);
    setCustomStatuses(updated);
    localStorage.setItem('custom_statuses_list', JSON.stringify(updated));
    window.dispatchEvent(new Event('customStatusesChanged'));
    setStatusSaveMsg('Status atualizado!');
    setTimeout(() => setStatusSaveMsg(''), 2000);
  };

  const [cfg, setCfg] = useState<NotifCfg>(defaultCfg);
  const [tableReady, setTableReady] = useState<boolean | null>(null);
  const [connStatus, setConnStatus] = useState<ConnStatus>('idle');
  const [qrImage, setQrImage] = useState<string | null>(null);
  const [connError, setConnError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [showSql, setShowSql] = useState(false);
  const [copied, setCopied] = useState(false);
  const [qrRefreshIn, setQrRefreshIn] = useState(30);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const qrTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const patch = (p: Partial<NotifCfg>) => setCfg(prev => ({ ...prev, ...p }));
  const handleTheme = (t: Theme) => { setTheme(t); applyTheme(t); };

  // ── load settings ──
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(
          `${SUPA_URL}/rest/v1/sia_tarefas_notif_settings?id=eq.1&select=id,evolution_url,evolution_instance,whatsapp_number,notify_expiring,expiring_days_before,notify_due_today,notify_overdue,connected`,
          { headers: supaHdr }
        );
        if (!r.ok) { setTableReady(false); return; }
        const data = await r.json();
        if (data?.[0]) {
          setCfg({ ...defaultCfg(), ...data[0] });
          if (data[0].connected) setConnStatus('connected');
        }
        setTableReady(true);
      } catch { setTableReady(false); }
    })();
    return () => stopPolling();
  }, []);

  // ── polling connection state ──
  const stopPolling = useCallback(() => {
    if (pollRef.current)  { clearInterval(pollRef.current);  pollRef.current = null; }
    if (qrTimerRef.current) { clearInterval(qrTimerRef.current); qrTimerRef.current = null; }
    if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
  }, []);

  const startPolling = useCallback((url: string, key: string) => {
    stopPolling();

    // poll state every 3s
    pollRef.current = setInterval(async () => {
      const state = await evState(url, key);
      if (state === 'open') {
        stopPolling();
        setQrImage(null);
        setConnStatus('connected');
        patch({ connected: true });
        // save connected flag
        await fetch(`${SUPA_URL}/rest/v1/sia_tarefas_notif_settings?id=eq.1`, {
          method: 'PATCH',
          headers: { ...supaHdr, Prefer: 'return=minimal' },
          body: JSON.stringify({ connected: true, updated_at: new Date().toISOString() }),
        });
      }
    }, 3000);

    // refresh QR every 28s
    let countdown = 30;
    setQrRefreshIn(countdown);
    countdownRef.current = setInterval(() => {
      countdown--;
      setQrRefreshIn(countdown);
      if (countdown <= 0) countdown = 30;
    }, 1000);

    qrTimerRef.current = setInterval(async () => {
      const newQr = await evGetQr(url, key);
      if (newQr) { setQrImage(newQr); setQrRefreshIn(30); countdown = 30; }
    }, 28000);
  }, [stopPolling]);

  // ── connect flow ──
  const connectWhatsApp = async () => {
    if (!cfg.evolution_url || !cfg.evolution_api_key) {
      setConnError('Informe a URL da API e a API Key antes de conectar.');
      return;
    }
    setConnError('');
    setQrImage(null);
    setConnStatus('creating');

    try {
      // try to get QR from existing instance first
      let qr = await evGetQr(cfg.evolution_url, cfg.evolution_api_key);

      if (!qr) {
        // create instance
        const cr = await evCreateInstance(cfg.evolution_url, cfg.evolution_api_key);
        if (!cr.ok && cr.status !== 409) {
          const body = await cr.json().catch(() => ({}));
          setConnError(body?.message ?? 'Erro ao criar instância. Verifique a URL e a API Key.');
          setConnStatus('error');
          return;
        }
        // get QR after creation
        await new Promise(r => setTimeout(r, 1500));
        qr = await evGetQr(cfg.evolution_url, cfg.evolution_api_key);
      }

      if (!qr) {
        setConnError('Não foi possível obter o QR Code. Verifique a instância no Evolution API.');
        setConnStatus('error');
        return;
      }

      setQrImage(qr);
      setConnStatus('qr');
      startPolling(cfg.evolution_url, cfg.evolution_api_key);

      // save url + key + instance to supabase
      await fetch(`${SUPA_URL}/rest/v1/sia_tarefas_notif_settings?id=eq.1`, {
        method: 'PATCH',
        headers: { ...supaHdr, Prefer: 'return=minimal' },
        body: JSON.stringify({
          evolution_url: cfg.evolution_url,
          evolution_instance: INSTANCE,
          evolution_api_key: cfg.evolution_api_key,
          connected: false,
          updated_at: new Date().toISOString(),
        }),
      });
    } catch (e: any) {
      setConnError(e?.message ?? 'Erro de conexão com o Evolution API.');
      setConnStatus('error');
    }
  };

  const disconnect = async () => {
    stopPolling();
    await evDisconnect(cfg.evolution_url, cfg.evolution_api_key);
    setConnStatus('idle');
    setQrImage(null);
    patch({ connected: false });
    await fetch(`${SUPA_URL}/rest/v1/sia_tarefas_notif_settings?id=eq.1`, {
      method: 'PATCH',
      headers: { ...supaHdr, Prefer: 'return=minimal' },
      body: JSON.stringify({ connected: false, updated_at: new Date().toISOString() }),
    });
  };

  const save = async () => {
    setSaving(true);
    try {
      await fetch(`${SUPA_URL}/rest/v1/sia_tarefas_notif_settings?id=eq.1`, {
        method: 'PATCH',
        headers: { ...supaHdr, Prefer: 'return=minimal' },
        body: JSON.stringify({
          whatsapp_number: cfg.whatsapp_number,
          notify_expiring: cfg.notify_expiring,
          expiring_days_before: cfg.expiring_days_before,
          notify_due_today: cfg.notify_due_today,
          notify_overdue: cfg.notify_overdue,
          updated_at: new Date().toISOString(),
        }),
      });
      setSaveMsg('Salvo!');
    } catch { setSaveMsg('Erro ao salvar.'); }
    setSaving(false);
    setTimeout(() => setSaveMsg(''), 3000);
  };

  const copySQL = () => {
    navigator.clipboard.writeText(SQL_SETUP);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const Toggle = ({ checked, onChange, label, sub }: { checked: boolean; onChange: (v: boolean) => void; label: string; sub?: string }) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0' }}>
      <div>
        <span style={{ fontSize: '13px', color: 'var(--text-on-surface)' }}>{label}</span>
        {sub && <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{sub}</p>}
      </div>
      <button type="button" onClick={() => onChange(!checked)} style={{
        width: '40px', height: '22px', borderRadius: '99px', border: 'none',
        background: checked ? 'var(--primary)' : 'var(--outline-variant)',
        cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0, marginLeft: '16px',
      }}>
        <span style={{
          position: 'absolute', top: '3px', left: checked ? '21px' : '3px',
          width: '16px', height: '16px', borderRadius: '50%',
          background: '#fff', transition: 'left 0.2s',
        }} />
      </button>
    </div>
  );

  const themeCard = (value: Theme, icon: string, label: string, desc: string) => {
    const active = theme === value;
    return (
      <button onClick={() => handleTheme(value)} style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px',
        padding: '24px 20px', borderRadius: 'var(--radius-lg)', cursor: 'pointer',
        border: `2px solid ${active ? 'var(--primary)' : 'var(--outline)'}`,
        background: active ? 'var(--primary-light)' : 'var(--surface)',
        transition: 'all 0.15s ease', flex: 1, maxWidth: '200px',
      }}>
        <div style={{
          width: '48px', height: '48px', borderRadius: '50%',
          background: active ? 'var(--primary)' : 'var(--surface-low)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: '24px', color: active ? '#fff' : 'var(--text-muted)' }}>{icon}</span>
        </div>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: '14px', fontWeight: 700, color: active ? 'var(--primary)' : 'var(--text-on-surface)', marginBottom: '2px' }}>{label}</p>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{desc}</p>
        </div>
        {active && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--primary)', borderRadius: '99px', padding: '2px 10px' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '12px', color: '#fff' }}>check</span>
            <span style={{ fontSize: '10px', fontWeight: 700, color: '#fff' }}>Ativo</span>
          </div>
        )}
      </button>
    );
  };

  return (
    <div className="layout-container">
      <SideNavBar activePage="settings" />
      <main className="main-content" style={{ display: 'flex', flexDirection: 'column' }}>

        <div style={{ marginBottom: '32px', borderBottom: '1px solid var(--outline)', paddingBottom: '16px' }}>
          <h2 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-on-surface)' }}>Configurações</h2>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>Personalize sua experiência no workspace</p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '680px' }}>

          {/* ── Tela ── */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--outline)', borderRadius: 'var(--radius-lg)', padding: '24px' }}>
            {sectionTitle('display_settings', 'Tela')}
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px', lineHeight: 1.6 }}>
              Escolha o tema visual do workspace.
            </p>
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              {themeCard('dark', 'dark_mode', 'Escuro', 'Fundo escuro')}
              {themeCard('light', 'light_mode', 'Claro', 'Fundo claro')}
            </div>
          </div>

          {/* ── Notificações ── */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--outline)', borderRadius: 'var(--radius-lg)', padding: '24px' }}>
            {sectionTitle('notifications', 'Notificações via WhatsApp')}

            {/* SQL setup banner */}
            {tableReady === false && (
              <div style={{ marginBottom: '20px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 'var(--radius-md)', padding: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#f59e0b' }}>warning</span>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#f59e0b' }}>Setup necessário</span>
                </div>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px', lineHeight: 1.6 }}>
                  Execute o SQL abaixo no <strong>Supabase → SQL Editor</strong> para habilitar notificações.
                </p>
                <button onClick={() => setShowSql(v => !v)}
                  style={{ fontSize: '12px', fontWeight: 600, color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginBottom: showSql ? '10px' : 0 }}>
                  {showSql ? '▲ Ocultar SQL' : '▼ Ver SQL'}
                </button>
                {showSql && (
                  <div style={{ position: 'relative' }}>
                    <pre style={{ background: 'var(--surface-low)', borderRadius: 'var(--radius-md)', padding: '12px', fontSize: '11px', color: 'var(--text-muted)', overflowX: 'auto', margin: 0, lineHeight: 1.6 }}>
                      {SQL_SETUP}
                    </pre>
                    <button onClick={copySQL} style={{ position: 'absolute', top: '8px', right: '8px', background: copied ? '#10b981' : 'var(--surface)', border: '1px solid var(--outline)', borderRadius: 'var(--radius-sm)', padding: '4px 10px', fontSize: '11px', fontWeight: 700, color: copied ? '#fff' : 'var(--text-muted-dark)', cursor: 'pointer' }}>
                      {copied ? '✓ Copiado' : 'Copiar'}
                    </button>
                  </div>
                )}
              </div>
            )}

            <div style={{ opacity: tableReady === false ? 0.4 : 1, pointerEvents: tableReady === false ? 'none' : 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>

              {/* ── Bloco 1: Conectar WhatsApp ── */}
              <div>
                <p style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>
                  Conexão Evolution API
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={labelStyle}>URL da API</label>
                    <input style={inputStyle} placeholder="https://api.seudominio.com" value={cfg.evolution_url}
                      onChange={e => patch({ evolution_url: e.target.value })}
                      onFocus={e => e.target.style.borderColor = 'var(--primary)'}
                      onBlur={e => e.target.style.borderColor = 'var(--outline-variant)'}
                      disabled={connStatus === 'connected'} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={labelStyle}>API Key global</label>
                    <input style={inputStyle} type="password" placeholder="••••••••" value={cfg.evolution_api_key}
                      onChange={e => patch({ evolution_api_key: e.target.value })}
                      onFocus={e => e.target.style.borderColor = 'var(--primary)'}
                      onBlur={e => e.target.style.borderColor = 'var(--outline-variant)'}
                      disabled={connStatus === 'connected'} />
                  </div>
                </div>

                {/* Status / QR / Botão */}
                {connStatus === 'idle' || connStatus === 'error' ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <button onClick={connectWhatsApp}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: '#25D366', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', padding: '11px 20px', fontSize: '14px', fontWeight: 700, cursor: 'pointer', alignSelf: 'flex-start' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>qr_code_2</span>
                      Conectar WhatsApp
                    </button>
                    {connError && (
                      <p style={{ fontSize: '12px', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>error</span>
                        {connError}
                      </p>
                    )}
                  </div>
                ) : connStatus === 'creating' ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '14px', background: 'var(--surface-low)', borderRadius: 'var(--radius-md)' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '20px', color: 'var(--primary)', animation: 'spin 1.2s linear infinite' }}>sync</span>
                    <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Criando instância e gerando QR Code…</span>
                    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                  </div>
                ) : connStatus === 'qr' && qrImage ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '12px' }}>
                    <div style={{ background: '#fff', padding: '12px', borderRadius: 'var(--radius-md)', display: 'inline-block', boxShadow: '0 2px 12px rgba(0,0,0,0.15)' }}>
                      <img src={qrImage} alt="QR Code WhatsApp" style={{ width: '200px', height: '200px', display: 'block' }} />
                    </div>
                    <div>
                      <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-on-surface)', marginBottom: '4px' }}>
                        Abra o WhatsApp → Dispositivos vinculados → Vincular dispositivo
                      </p>
                      <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        QR Code atualiza automaticamente em <strong style={{ color: 'var(--primary)' }}>{qrRefreshIn}s</strong> · Aguardando leitura…
                      </p>
                    </div>
                    <button onClick={() => { stopPolling(); setConnStatus('idle'); setQrImage(null); }}
                      style={{ fontSize: '12px', color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                      Cancelar
                    </button>
                  </div>
                ) : connStatus === 'connected' ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: 'var(--radius-md)' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '22px', color: '#10b981' }}>check_circle</span>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: '13px', fontWeight: 700, color: '#10b981' }}>WhatsApp conectado</p>
                      <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Instância: {INSTANCE}</p>
                    </div>
                    <button onClick={disconnect}
                      style={{ fontSize: '12px', color: '#ef4444', background: 'none', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 'var(--radius-sm)', padding: '5px 12px', cursor: 'pointer', fontWeight: 600 }}>
                      Desconectar
                    </button>
                  </div>
                ) : null}
              </div>

              {/* ── Bloco 2: Destinatário e alertas (só quando conectado) ── */}
              {connStatus === 'connected' && (
                <>
                  <div style={{ borderTop: '1px solid var(--outline)', paddingTop: '20px' }}>
                    <p style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>
                      Destinatário
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={labelStyle}>Número para receber os alertas (com DDI)</label>
                      <input style={inputStyle} placeholder="5511999999999" value={cfg.whatsapp_number}
                        onChange={e => patch({ whatsapp_number: e.target.value })}
                        onFocus={e => e.target.style.borderColor = 'var(--primary)'}
                        onBlur={e => e.target.style.borderColor = 'var(--outline-variant)'} />
                    </div>
                  </div>

                  <div style={{ borderTop: '1px solid var(--outline)', paddingTop: '20px' }}>
                    <p style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
                      Alertas
                    </p>
                    <Toggle checked={cfg.notify_due_today} onChange={v => patch({ notify_due_today: v })}
                      label="Vence hoje" sub="Avisa no dia do prazo" />
                    <div style={{ height: '1px', background: 'var(--outline)' }} />
                    <Toggle checked={cfg.notify_expiring} onChange={v => patch({ notify_expiring: v })}
                      label="Prazo próximo" sub={`Avisa ${cfg.expiring_days_before} dia(s) antes do vencimento`} />
                    {cfg.notify_expiring && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingBottom: '10px', paddingLeft: '4px' }}>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Avisar com</span>
                        <input type="number" min={1} max={30} value={cfg.expiring_days_before}
                          onChange={e => patch({ expiring_days_before: Number(e.target.value) })}
                          style={{ ...inputStyle, width: '64px', textAlign: 'center', padding: '6px 8px' }}
                          onFocus={e => e.target.style.borderColor = 'var(--primary)'}
                          onBlur={e => e.target.style.borderColor = 'var(--outline-variant)'} />
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>dia(s) de antecedência</span>
                      </div>
                    )}
                    <div style={{ height: '1px', background: 'var(--outline)' }} />
                    <Toggle checked={cfg.notify_overdue} onChange={v => patch({ notify_overdue: v })}
                      label="Em atraso" sub="Avisa 1x por dia enquanto o projeto estiver vencido" />
                  </div>

                  <div style={{ borderTop: '1px solid var(--outline)', paddingTop: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <button onClick={save} disabled={saving}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', padding: '10px 18px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>save</span>
                      {saving ? 'Salvando…' : 'Salvar alertas'}
                    </button>
                    {saveMsg && (
                      <span style={{ fontSize: '13px', fontWeight: 600, color: saveMsg.startsWith('E') ? '#ef4444' : '#10b981' }}>{saveMsg}</span>
                    )}
                  </div>
                </>
              )}

            </div>
          </div>

          {/* ── Personalização ── */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--outline)', borderRadius: 'var(--radius-lg)', padding: '24px' }}>
            {sectionTitle('palette', 'Personalização')}
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '24px', lineHeight: 1.6 }}>
              Edite nomes e cores dos clientes e dos status das tarefas.
            </p>

            {/* Clientes */}
            <div style={{ marginBottom: '28px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '15px', color: 'var(--text-muted)' }}>group</span>
                <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-on-surface)' }}>Clientes</span>
                {clientSaveMsg && <span style={{ fontSize: '11px', color: '#10b981', marginLeft: '8px' }}>{clientSaveMsg}</span>}
              </div>
              {knownClients.length === 0 ? (
                <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Nenhum cliente encontrado nas tarefas.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {knownClients.map(client => (
                    <div key={client} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', background: 'var(--surface-low)', borderRadius: 'var(--radius-md)', border: '1px solid var(--outline)' }}>
                      {/* Color swatch */}
                      <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', flexShrink: 0 }} title="Clique para alterar a cor">
                        <div style={{ width: 22, height: 22, borderRadius: 6, background: getClientColor(client), border: '2px solid var(--outline)', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
                        <input type="color" value={getClientColor(client)} onChange={(e) => updateClientColor(client, e.target.value)} style={{ width: 0, height: 0, opacity: 0, position: 'absolute', pointerEvents: 'none' }} />
                      </label>
                      {/* Name / rename */}
                      {renamingClient === client ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1 }}>
                          <input
                            autoFocus
                            type="text"
                            value={newClientName}
                            onChange={e => setNewClientName(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') renameClient(client, newClientName); if (e.key === 'Escape') setRenamingClient(null); }}
                            style={{ ...inputStyle, padding: '4px 8px', fontSize: '12px' }}
                          />
                          <button onClick={() => renameClient(client, newClientName)} style={{ background: '#10b981', border: 'none', borderRadius: 4, color: '#fff', padding: '4px 8px', fontSize: '11px', cursor: 'pointer', fontWeight: 600 }}>Salvar</button>
                          <button onClick={() => setRenamingClient(null)} style={{ background: 'transparent', border: '1px solid var(--outline)', borderRadius: 4, color: 'var(--text-muted)', padding: '4px 8px', fontSize: '11px', cursor: 'pointer' }}>Cancelar</button>
                        </div>
                      ) : (
                        <>
                          <span style={{ fontSize: '13px', color: 'var(--text-on-surface)', flex: 1 }}>{client}</span>
                          <button onClick={() => { setRenamingClient(client); setNewClientName(client); }} title="Renomear" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: '2px' }} onMouseOver={e => e.currentTarget.style.color = 'var(--primary)'} onMouseOut={e => e.currentTarget.style.color = 'var(--text-muted)'}>
                            <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>edit</span>
                          </button>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Status */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '15px', color: 'var(--text-muted)' }}>adjust</span>
                <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-on-surface)' }}>Status</span>
                {statusSaveMsg && <span style={{ fontSize: '11px', color: '#10b981', marginLeft: '8px' }}>{statusSaveMsg}</span>}
              </div>
              {customStatuses.length === 0 ? (
                <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Nenhum status configurado.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {customStatuses.map(status => (
                    <div key={status.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', background: 'var(--surface-low)', borderRadius: 'var(--radius-md)', border: '1px solid var(--outline)' }}>
                      {/* Cor */}
                      <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', flexShrink: 0 }} title="Clique para alterar a cor">
                        <div style={{ width: 22, height: 22, borderRadius: 6, background: status.color, border: '2px solid var(--outline)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <span className="material-symbols-outlined" style={{ fontSize: '13px', color: '#fff' }}>{status.icon}</span>
                        </div>
                        <input type="color" value={status.color} onChange={(e) => updateStatusColor(status.id, e.target.value)} style={{ width: 0, height: 0, opacity: 0, position: 'absolute', pointerEvents: 'none' }} />
                      </label>
                      {/* Label editável inline */}
                      <input
                        type="text"
                        defaultValue={status.label}
                        onBlur={(e) => { if (e.target.value.trim() && e.target.value.trim() !== status.label) renameStatus(status.id, e.target.value.trim()); }}
                        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                        style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: '13px', color: 'var(--text-on-surface)', cursor: 'text' }}
                      />
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)', flexShrink: 0, fontWeight: 600, textTransform: 'uppercase' }}>{status.category}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

        </div>
      </main>
    </div>
  );
};
