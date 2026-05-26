import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Dashboard } from './pages/Dashboard';
import { ClientPortal } from './pages/ClientPortal';
import { Projects } from './pages/Projects';
import { Clients } from './pages/Clients';
import { Reports } from './pages/Reports';
import { Settings } from './pages/Settings';

function App() {
  return (
    <Router>
      <Routes>
        {/* Rota Privada: Workspace de Tarefas */}
        <Route path="/" element={<Dashboard />} />
        
        {/* Rota Privada: Projetos */}
        <Route path="/projects" element={<Projects />} />
        
        {/* Rota Privada: Clientes */}
        <Route path="/clients" element={<Clients />} />
        
        {/* Rota Privada: Relatórios */}
        <Route path="/reports" element={<Reports />} />
        
        {/* Rota Privada: Configurações */}
        <Route path="/settings" element={<Settings />} />

        {/* Rota Pública: Portal do Cliente */}
        <Route path="/share/:token" element={<ClientPortal />} />
        
        {/* Fallback de rotas inexistentes redireciona para o painel privado */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
