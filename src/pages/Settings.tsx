import React, { useState } from 'react';
import { SideNavBar } from '../components/SideNavBar';

type Theme = 'dark' | 'light';

const applyTheme = (t: Theme) => {
  localStorage.setItem('theme', t);
  document.body.classList.toggle('light-theme', t === 'light');
};

const sectionTitle = (icon: string, label: string) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
    <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--primary)' }}>{icon}</span>
    <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-on-surface)' }}>{label}</h3>
  </div>
);

export const Settings: React.FC = () => {
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem('theme') as Theme) || 'dark'
  );

  const handleTheme = (t: Theme) => {
    setTheme(t);
    applyTheme(t);
  };

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
          transition: 'all 0.15s ease', minWidth: '140px', flex: 1, maxWidth: '200px',
        }}
        onMouseOver={e => { if (!active) e.currentTarget.style.borderColor = 'var(--outline-variant)'; }}
        onMouseOut={e => { if (!active) e.currentTarget.style.borderColor = 'var(--outline)'; }}
      >
        <div style={{
          width: '48px', height: '48px', borderRadius: '50%',
          background: active ? 'var(--primary)' : 'var(--surface-low)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all 0.15s',
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: '24px', color: active ? '#fff' : 'var(--text-muted)' }}>
            {icon}
          </span>
        </div>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: '14px', fontWeight: 700, color: active ? 'var(--primary)' : 'var(--text-on-surface)', marginBottom: '2px' }}>
            {label}
          </p>
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

        {/* Header */}
        <div style={{ marginBottom: '32px', borderBottom: '1px solid var(--outline)', paddingBottom: '16px' }}>
          <h2 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-on-surface)' }}>Configurações</h2>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>Personalize sua experiência no workspace</p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', maxWidth: '680px' }}>

          {/* ── Tela ── */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--outline)', borderRadius: 'var(--radius-lg)', padding: '24px' }}>
            {sectionTitle('display_settings', 'Tela')}
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px', lineHeight: 1.6 }}>
              Escolha o tema visual do workspace. A preferência é salva automaticamente.
            </p>
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              {themeCard('dark', 'dark_mode', 'Escuro', 'Fundo escuro')}
              {themeCard('light', 'light_mode', 'Claro', 'Fundo claro')}
            </div>
          </div>

          {/* ── Notificações (placeholder) ── */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--outline)', borderRadius: 'var(--radius-lg)', padding: '24px', opacity: 0.7 }}>
            {sectionTitle('notifications', 'Notificações')}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px', background: 'var(--surface-low)', borderRadius: 'var(--radius-md)', border: '1px dashed var(--outline-variant)' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '24px', color: 'var(--text-muted)' }}>construction</span>
              <div>
                <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-on-surface)' }}>Em breve</p>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Alertas via WhatsApp para tarefas vencendo, vencidas e mudanças de status.</p>
              </div>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
};
