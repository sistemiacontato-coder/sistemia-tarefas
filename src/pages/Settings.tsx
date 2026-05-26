import React, { useState, useEffect } from 'react';
import { SideNavBar } from '../components/SideNavBar';

type Theme = 'dark' | 'light';

const SUPA_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPA_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

const supaHeaders = {
  apikey: SUPA_KEY,
  Authorization: `Bearer ${SUPA_KEY}`,
  'Content-Type': 'application/json',
};

const applyTheme = (t: Theme) => {
  localStorage.setItem('theme', t);
  document.body.classList.toggle('light-theme', t === 'light');
};

interface NotifSettings {
  evolution_url: string;
  evolution_instance: string;
  evolution_api_key: string;
  whatsapp_number: string;
  notify_expiring: boolean;
  expiring_days_before: number;
  notify_due_today: boolean;
  notify_overdue: boolean;
}

const defaultNotif = (): NotifSettings => ({
  evolution_url: '',
  evolution_instance: '',
  evolution_api_key: '',
  whatsapp_number: '',
  notify_expiring: false,
  expiring_days_before: 3,
  notify_due_today: true,
  notify_overdue: true,
});

const SQL_SETUP = `-- Execute no Supabase → SQL Editor

CREATE TABLE IF NOT EXISTS sia_tarefas_notif_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  evolution_url TEXT DEFAULT '',
  evolution_instance TEXT DEFAULT '',
  evolution_api_key TEXT DEFAULT '',
  whatsapp_number TEXT DEFAULT '',
  notify_expiring BOOLEAN DEFAULT false,
  expiring_days_before INTEGER DEFAULT 3,
  notify_due_today BOOLEAN DEFAULT true,
  notify_overdue BOOLEAN DEFAULT true,
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

const sectionTitle = (icon: string, label: string) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
    <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--primary)' }}>{icon}</span>
    <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-on-surface)' }}>{label}</h3>
  </div>
);

const inputStyle: React.CSSProperties = {
  padding: '9px 12px', borderRadius: 'var(--radius-md)',
  border: '1px solid var(--outline-variant)', fontSize: '13px',
  background: 'var(--surface-low)', color: 'var(--text-on-surface)',
  outline: 'none', width: '100%',
};

const labelStyle: React.CSSProperties = {
  fontSize: '12px', fontWeight: 600, color: 'var(--text-muted-dark)',
};

export const Settings: React.FC = () => {
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem('theme') as Theme) || 'dark'
  );

  const [notif, setNotif] = useState<NotifSettings>(defaultNotif);
  const [tableReady, setTableReady] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [testing, setTesting] = useState(false);
  const [testMsg, setTestMsg] = useState('');
  const [showSql, setShowSql] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleTheme = (t: Theme) => { setTheme(t); applyTheme(t); };

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(
          `${SUPA_URL}/rest/v1/sia_tarefas_notif_settings?id=eq.1&select=*`,
          { headers: supaHeaders }
        );
        if (!res.ok) { setTableReady(false); return; }
        const data = await res.json();
        if (data?.[0]) setNotif({ ...defaultNotif(), ...data[0] });
        setTableReady(true);
      } catch {
        setTableReady(false);
      }
    })();
  }, []);

  const patch = (p: Partial<NotifSettings>) => setNotif(prev => ({ ...prev, ...p }));

  const save = async () => {
    setSaving(true);
    try {
      await fetch(`${SUPA_URL}/rest/v1/sia_tarefas_notif_settings?id=eq.1`, {
        method: 'PATCH',
        headers: { ...supaHeaders, Prefer: 'return=minimal' },
        body: JSON.stringify({ ...notif, updated_at: new Date().toISOString() }),
      });
      setSaveMsg('Salvo!');
    } catch {
      setSaveMsg('Erro ao salvar.');
    }
    setSaving(false);
    setTimeout(() => setSaveMsg(''), 3000);
  };

  const test = async () => {
    if (!notif.evolution_url || !notif.whatsapp_number) {
      setTestMsg('Preencha URL, instância e número antes de testar.');
      setTimeout(() => setTestMsg(''), 4000);
      return;
    }
    setTesting(true);
    try {
      const res = await fetch(`${notif.evolution_url}/message/sendText/${notif.evolution_instance}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: notif.evolution_api_key },
        body: JSON.stringify({
          number: notif.whatsapp_number,
          text: '✅ *SistemIA Tarefas*\n\nConexão configurada com sucesso! As notificações estão funcionando.',
        }),
      });
      setTestMsg(res.ok ? '✅ Mensagem enviada!' : '❌ Erro: verifique a URL e a instância.');
    } catch {
      setTestMsg('❌ Não foi possível conectar. Verifique a URL.');
    }
    setTesting(false);
    setTimeout(() => setTestMsg(''), 5000);
  };

  const copySQL = () => {
    navigator.clipboard.writeText(SQL_SETUP);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const Toggle = ({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0' }}>
      <span style={{ fontSize: '13px', color: 'var(--text-on-surface)' }}>{label}</span>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        style={{
          width: '40px', height: '22px', borderRadius: '99px', border: 'none',
          background: checked ? 'var(--primary)' : 'var(--outline-variant)',
          cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0,
        }}
      >
        <span style={{
          position: 'absolute', top: '3px',
          left: checked ? '21px' : '3px',
          width: '16px', height: '16px', borderRadius: '50%',
          background: '#fff', transition: 'left 0.2s',
        }} />
      </button>
    </div>
  );

  const themeCard = (value: Theme, icon: string, label: string, desc: string) => {
    const active = theme === value;
    return (
      <button
        onClick={() => handleTheme(value)}
        style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px',
          padding: '24px 20px', borderRadius: 'var(--radius-lg)', cursor: 'pointer',
          border: `2px solid ${active ? 'var(--primary)' : 'var(--outline)'}`,
          background: active ? 'var(--primary-light)' : 'var(--surface)',
          transition: 'all 0.15s ease', flex: 1, maxWidth: '200px',
        }}
      >
        <div style={{
          width: '48px', height: '48px', borderRadius: '50%',
          background: active ? 'var(--primary)' : 'var(--surface-low)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: '24px', color: active ? '#fff' : 'var(--text-muted)' }}>
            {icon}
          </span>
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

            {/* Setup SQL */}
            {tableReady === false && (
              <div style={{ marginBottom: '20px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 'var(--radius-md)', padding: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#f59e0b' }}>warning</span>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#f59e0b' }}>Setup necessário</span>
                </div>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px', lineHeight: 1.6 }}>
                  Execute o SQL abaixo no <strong>Supabase → SQL Editor</strong> para criar as tabelas de notificação.
                </p>
                <button onClick={() => setShowSql(v => !v)}
                  style={{ fontSize: '12px', fontWeight: 600, color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginBottom: showSql ? '8px' : 0 }}>
                  {showSql ? '▲ Ocultar SQL' : '▼ Ver SQL'}
                </button>
                {showSql && (
                  <div style={{ position: 'relative' }}>
                    <pre style={{ background: 'var(--surface-low)', borderRadius: 'var(--radius-md)', padding: '12px', fontSize: '11px', color: 'var(--text-muted)', overflowX: 'auto', margin: 0, lineHeight: 1.6 }}>
                      {SQL_SETUP}
                    </pre>
                    <button onClick={copySQL}
                      style={{ position: 'absolute', top: '8px', right: '8px', background: copied ? '#10b981' : 'var(--surface)', border: '1px solid var(--outline)', borderRadius: 'var(--radius-sm)', padding: '4px 10px', fontSize: '11px', fontWeight: 700, color: copied ? '#fff' : 'var(--text-muted-dark)', cursor: 'pointer' }}>
                      {copied ? '✓ Copiado' : 'Copiar'}
                    </button>
                  </div>
                )}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', opacity: tableReady === false ? 0.4 : 1, pointerEvents: tableReady === false ? 'none' : 'auto' }}>

              {/* Conexão */}
              <div>
                <p style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>Conexão Evolution API</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={labelStyle}>URL da API</label>
                    <input style={inputStyle} placeholder="https://api.seudominio.com" value={notif.evolution_url}
                      onChange={e => patch({ evolution_url: e.target.value })}
                      onFocus={e => e.target.style.borderColor = 'var(--primary)'}
                      onBlur={e => e.target.style.borderColor = 'var(--outline-variant)'} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={labelStyle}>Instância</label>
                      <input style={inputStyle} placeholder="minha-instancia" value={notif.evolution_instance}
                        onChange={e => patch({ evolution_instance: e.target.value })}
                        onFocus={e => e.target.style.borderColor = 'var(--primary)'}
                        onBlur={e => e.target.style.borderColor = 'var(--outline-variant)'} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={labelStyle}>API Key</label>
                      <input style={inputStyle} type="password" placeholder="••••••••" value={notif.evolution_api_key}
                        onChange={e => patch({ evolution_api_key: e.target.value })}
                        onFocus={e => e.target.style.borderColor = 'var(--primary)'}
                        onBlur={e => e.target.style.borderColor = 'var(--outline-variant)'} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={labelStyle}>Número de destino (com DDI)</label>
                    <input style={inputStyle} placeholder="5511999999999" value={notif.whatsapp_number}
                      onChange={e => patch({ whatsapp_number: e.target.value })}
                      onFocus={e => e.target.style.borderColor = 'var(--primary)'}
                      onBlur={e => e.target.style.borderColor = 'var(--outline-variant)'} />
                  </div>
                </div>
              </div>

              {/* Alertas */}
              <div style={{ borderTop: '1px solid var(--outline)', paddingTop: '16px' }}>
                <p style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Alertas</p>

                <Toggle checked={notif.notify_due_today} onChange={v => patch({ notify_due_today: v })}
                  label="Vence hoje — avisa no dia do prazo" />
                <div style={{ height: '1px', background: 'var(--outline)' }} />

                <div>
                  <Toggle checked={notif.notify_expiring} onChange={v => patch({ notify_expiring: v })}
                    label="Prazo próximo — avisa antes do vencimento" />
                  {notif.notify_expiring && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingBottom: '10px', paddingLeft: '4px' }}>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Avisar com</span>
                      <input type="number" min={1} max={30} value={notif.expiring_days_before}
                        onChange={e => patch({ expiring_days_before: Number(e.target.value) })}
                        style={{ ...inputStyle, width: '64px', textAlign: 'center', padding: '6px 8px' }}
                        onFocus={e => e.target.style.borderColor = 'var(--primary)'}
                        onBlur={e => e.target.style.borderColor = 'var(--outline-variant)'} />
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>dia(s) de antecedência</span>
                    </div>
                  )}
                </div>
                <div style={{ height: '1px', background: 'var(--outline)' }} />

                <Toggle checked={notif.notify_overdue} onChange={v => patch({ notify_overdue: v })}
                  label="Em atraso — avisa 1x por dia enquanto estiver vencido" />
              </div>

              {/* Ações */}
              <div style={{ borderTop: '1px solid var(--outline)', paddingTop: '16px', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                <button onClick={save} disabled={saving}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', padding: '10px 18px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>save</span>
                  {saving ? 'Salvando…' : 'Salvar configurações'}
                </button>
                <button onClick={test} disabled={testing}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'none', color: 'var(--primary)', border: '1px solid var(--primary)', borderRadius: 'var(--radius-md)', padding: '10px 18px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', opacity: testing ? 0.7 : 1 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>send</span>
                  {testing ? 'Enviando…' : 'Enviar mensagem de teste'}
                </button>
                {saveMsg && (
                  <span style={{ fontSize: '13px', fontWeight: 600, color: saveMsg.startsWith('E') ? '#ef4444' : '#10b981' }}>{saveMsg}</span>
                )}
                {testMsg && (
                  <span style={{ fontSize: '13px', fontWeight: 600, color: testMsg.startsWith('✅') ? '#10b981' : '#ef4444' }}>{testMsg}</span>
                )}
              </div>

            </div>
          </div>

        </div>
      </main>
    </div>
  );
};
