import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabaseRealClient, isRealSupabaseConfigured } from '../supabaseClient';

interface SideNavBarProps {
  activePage: 'dashboard' | 'projects' | 'clients' | 'reports' | 'settings';
}

export const SideNavBar: React.FC<SideNavBarProps> = ({ activePage }) => {
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('sidebar-collapsed') === 'true';
  });

  const handleLogout = async () => {
    if (isRealSupabaseConfigured && supabaseRealClient) {
      await supabaseRealClient.auth.signOut();
    }
  };

  const toggleCollapsed = () => {
    setCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('sidebar-collapsed', String(next));
      return next;
    });
  };

  // Aplica o tema salvo ao montar
  useEffect(() => {
    const saved = localStorage.getItem('theme');
    document.body.classList.toggle('light-theme', saved === 'light');
  }, []);

  const getLinkStyle = (page: 'dashboard' | 'projects' | 'clients' | 'reports' | 'settings') => {
    const isActive = activePage === page;
    return {
      display: 'flex',
      alignItems: 'center',
      gap: collapsed ? '0' : '10px',
      padding: '8px 10px',
      justifyContent: collapsed ? 'center' : 'flex-start',
      color: isActive ? '#ffffff' : 'var(--text-muted-dark)',
      background: isActive ? 'var(--primary)' : 'transparent',
      borderRadius: 'var(--radius-sm)',
      fontWeight: isActive ? 600 : 500,
      textDecoration: 'none',
      fontSize: '13px',
      transition: 'all 0.15s ease-in-out',
      cursor: 'pointer',
      overflow: 'hidden',
      whiteSpace: 'nowrap' as const,
      title: collapsed ? page : undefined,
    };
  };

  const iconBtn: React.CSSProperties = {
    background: 'none', border: 'none', color: 'var(--text-muted)',
    cursor: 'pointer', padding: '4px', borderRadius: 'var(--radius-sm)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'color 0.2s',
  };

  return (
    <aside style={{
      width: collapsed ? '52px' : '200px',
      minWidth: collapsed ? '52px' : '200px',
      borderRight: '1px solid var(--outline)',
      background: 'var(--surface-low)',
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      position: 'sticky',
      top: 0,
      padding: '16px 6px',
      zIndex: 100,
      transition: 'width 0.2s ease, min-width 0.2s ease',
      overflow: 'hidden',
    }}>

      {/* Logo + botão recolher */}
      <div style={{ marginBottom: '24px', paddingLeft: collapsed ? '0' : '6px', display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'space-between' }}>
        {!collapsed && (
          <div>
            <h1 style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-on-surface)', lineHeight: 1.2, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span className="material-symbols-outlined" style={{ color: 'var(--primary)', fontSize: '20px' }}>bolt</span>
              SistemIA Tarefas
            </h1>
            <p style={{ fontSize: '9px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em', marginTop: '2px' }}>
              workspace
            </p>
          </div>
        )}
        <button
          onClick={toggleCollapsed}
          title={collapsed ? 'Expandir menu' : 'Recolher menu'}
          style={{ ...iconBtn, flexShrink: 0 }}
          onMouseOver={e => (e.currentTarget.style.color = 'var(--text-on-surface)')}
          onMouseOut={e => (e.currentTarget.style.color = 'var(--text-muted)')}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
            {collapsed ? 'menu' : 'menu_open'}
          </span>
        </button>
      </div>

      {/* Menu Principal */}
      <nav style={{ display: 'flex', flexDirection: 'column', gap: '3px', flex: 1 }}>
        <Link to="/" style={getLinkStyle('dashboard')} title={collapsed ? 'Dashboard' : undefined}>
          <span className="material-symbols-outlined" style={{ fontSize: '18px', flexShrink: 0 }}>dashboard</span>
          {!collapsed && 'Dashboard'}
        </Link>
        <Link to="/projects" style={getLinkStyle('projects')} title={collapsed ? 'Projetos' : undefined}>
          <span className="material-symbols-outlined" style={{ fontSize: '18px', flexShrink: 0 }}>folder_open</span>
          {!collapsed && 'Projetos'}
        </Link>
        <Link to="/clients" style={getLinkStyle('clients')} title={collapsed ? 'Clientes' : undefined}>
          <span className="material-symbols-outlined" style={{ fontSize: '18px', flexShrink: 0 }}>groups</span>
          {!collapsed && 'Clientes'}
        </Link>
        <Link to="/reports" style={getLinkStyle('reports')} title={collapsed ? 'Relatórios' : undefined}>
          <span className="material-symbols-outlined" style={{ fontSize: '18px', flexShrink: 0 }}>analytics</span>
          {!collapsed && 'Relatórios'}
        </Link>

        {/* Separador */}
        <div style={{ borderTop: '1px solid var(--outline)', margin: '8px 4px' }} />

        <Link to="/settings" style={getLinkStyle('settings')} title={collapsed ? 'Configurações' : undefined}>
          <span className="material-symbols-outlined" style={{ fontSize: '18px', flexShrink: 0 }}>settings</span>
          {!collapsed && 'Configurações'}
        </Link>
      </nav>

      {/* Rodapé */}
      <div style={{ borderTop: '1px solid var(--outline)', paddingTop: '12px', display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-start', gap: '8px' }}>
        <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--primary)', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '12px', flexShrink: 0 }}>
          SN
        </div>
        {!collapsed && (
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-on-surface)', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Saymon Nunes</p>
            <p style={{ fontSize: '9px', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Workspace Master</p>
          </div>
        )}
        {isRealSupabaseConfigured && (
          <button
            onClick={handleLogout}
            title="Sair"
            style={{ ...iconBtn, flexShrink: 0, marginLeft: collapsed ? '0' : 'auto' }}
            onMouseOver={e => (e.currentTarget.style.color = '#ef4444')}
            onMouseOut={e => (e.currentTarget.style.color = 'var(--text-muted)')}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>logout</span>
          </button>
        )}
      </div>
    </aside>
  );
};
