# Documento de Requisitos do Produto (PRD)
## Gerenciador de Tarefas Hierárquico (ClickUp-Style)

---

## 1. Controle de Versão e Metadados do Projeto

| Atributo | Detalhes |
| :--- | :--- |
| **Nome do Produto** | TaskMaster Pro (Gerenciador de Tarefas Hierárquico) |
| **Status do PRD** | Pronto para Revisão (Sob Aprovação) |
| **Autor** | Engenheiro de Software Sênior & Product Manager |
| **Público-Alvo** | Gestores de Projetos, Líderes de Equipe e Clientes Finais (Visualizadores Externos) |
| **Stack Principal** | Frontend: React (Vite) + CSS Customizado<br>Backend: Node.js (Vercel Functions)<br>Database: Supabase (PostgreSQL) com RLS ativo |

---

## 2. Visão Geral e Proposta de Valor

O **TaskMaster Pro** é um gerenciador de tarefas corporativo e de alta eficiência projetado com uma abordagem baseada em utilidade e foco em dados ("ClickUp Style"). Ele visa solucionar a sobrecarga cognitiva enfrentada por gestores e equipes ao lidar com projetos de grande porte e alta complexidade, permitindo a decomposição infinita de entregas em até **7 níveis hierárquicos** estruturados.

Adicionalmente, o sistema resolve a fricção de comunicação de progresso com stakeholders externos através do **Portal do Cliente Público**, gerando links seguros e de leitura em tempo real sem a necessidade de criação de contas ou autenticação burocrática por parte do cliente final.

### Pilares do Produto:
*   **Decomposição Granular:** Quebrar objetivos macro em microetapas exequíveis.
*   **Transparência Assíncrona:** Portal externo elegante que exibe status e métricas financeiras ao cliente de forma transparente.
*   **Orquestração Financeira:** Integração direta entre cronograma físico (tarefas) e financeiro (valor contratual).
*   **Desempenho Extremo:** Carregamento ultrafluido mesmo sob estruturas profundamente aninhadas com milhares de linhas.

---

## 3. Arquitetura de Dados (Supabase / PostgreSQL)

O modelo de dados adota o padrão de **Adjacency List** (Lista de Adjacência), onde cada tarefa pode apontar para uma tarefa pai (`parent_id`) pertencente à mesma tabela, criando uma árvore hierárquica direcionada e acíclica de até 7 níveis.

### 3.1. DDL da Tabela `tasks`

Abaixo está o script SQL recomendado para provisionar o schema no Supabase, contendo enums, a tabela principal, chaves estrangeiras, restrições e índices otimizados.

```sql
-- 1. Criação do Enum para Status de Tarefa
CREATE TYPE task_status AS ENUM ('A Fazer', 'Em Execução', 'Pendente', 'Concluído');

-- 2. Criação da Tabela tasks
CREATE TABLE public.tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
    client_name VARCHAR(255) NOT NULL,
    contract_value NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    status task_status NOT NULL DEFAULT 'A Fazer',
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    description TEXT,
    owner_id UUID NOT NULL, -- FK referenciando auth.users do Supabase
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    
    -- Restrições de Integridade Lógica
    CONSTRAINT check_dates CHECK (end_date >= start_date),
    CONSTRAINT check_contract_value CHECK (contract_value >= 0)
);

-- 3. Índices Estratégicos para Performance
CREATE INDEX idx_tasks_parent_id ON public.tasks(parent_id);
CREATE INDEX idx_tasks_client_name ON public.tasks(client_name);
CREATE INDEX idx_tasks_owner_id ON public.tasks(owner_id);
```

### 3.2. Validação da Profundidade Hierárquica (Trigger de Segurança)

Para garantir que a regra de negócio inviolável de **profundidade máxima de 7 níveis** seja mantida, um Trigger do PostgreSQL calcula e valida a profundidade no momento de qualquer inserção ou alteração de parentesco (`parent_id`).

```sql
-- Função de cálculo e validação de profundidade
CREATE OR REPLACE FUNCTION public.check_task_depth_limit()
RETURNS TRIGGER AS $$
DECLARE
    current_depth INT := 1;
    temp_parent_id UUID;
    sub_tree_depth INT := 0;
BEGIN
    -- 1. Determina a profundidade máxima da subárvore do próprio registro sendo modificado (caso ele já possua filhos)
    -- Isso previne mover um nó com filhos para um nível que ultrapassaria o limite total de 7
    WITH RECURSIVE sub_tree AS (
        SELECT id, 1 AS depth
        FROM public.tasks
        WHERE parent_id = NEW.id
        
        UNION ALL
        
        SELECT t.id, st.depth + 1
        FROM public.tasks t
        INNER JOIN sub_tree st ON t.parent_id = st.id
    )
    SELECT COALESCE(MAX(depth), 0) INTO sub_tree_depth FROM sub_tree;

    -- 2. Se for uma inserção ou mudança de pai, sobe a árvore a partir do novo parent_id para descobrir o nível do pai
    IF NEW.parent_id IS NOT NULL THEN
        temp_parent_id := NEW.parent_id;
        
        WHILE temp_parent_id IS NOT NULL LOOP
            current_depth := current_depth + 1;
            
            -- Salvaguarda contra loops infinitos de recursão cíclica
            IF current_depth > 7 THEN
                RAISE EXCEPTION 'Erro: A profundidade máxima da hierarquia de tarefas não pode exceder 7 níveis.';
            END IF;
            
            SELECT parent_id INTO temp_parent_id FROM public.tasks WHERE id = temp_parent_id;
        END LOOP;
    END IF;

    -- 3. Valida a soma: nível atual da tarefa + profundidade da sua subárvore descendente
    IF (current_depth + sub_tree_depth) > 7 THEN
        RAISE EXCEPTION 'Erro: Esta alteração excede a profundidade máxima permitida de 7 níveis na árvore de tarefas (Nível resultante: %).', (current_depth + sub_tree_depth);
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criação do Trigger
CREATE TRIGGER trg_check_task_depth
BEFORE INSERT OR UPDATE OF parent_id ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.check_task_depth_limit();
```

---

## 4. Query Recursiva Otimizada (CTE Recursiva)

Para renderizar e buscar toda a árvore hierárquica do projeto de um cliente de forma extremamente rápida, o Supabase fará uso da seguinte query com **Common Table Expression (CTE) Recursiva**. Ela retorna a estrutura hierárquica ordenada e calculada de uma só vez, evitando consultas aninhadas repetitivas (problema N+1 no banco de dados).

```sql
WITH RECURSIVE task_tree AS (
    -- Âncora: Seleciona as tarefas raiz (Nível 1) filtradas pelo cliente
    SELECT 
        id, 
        parent_id, 
        client_name, 
        contract_value, 
        status, 
        start_date, 
        end_date, 
        description, 
        owner_id,
        1 AS level,
        ARRAY[id::text] AS path_route
    FROM public.tasks
    WHERE parent_id IS NULL AND client_name = 'TechNova Solutions'
    
    UNION ALL
    
    -- Recursão: Junta os filhos com seus respectivos pais
    SELECT 
        t.id, 
        t.parent_id, 
        t.client_name, 
        t.contract_value, 
        t.status, 
        t.start_date, 
        t.end_date, 
        t.description, 
        t.owner_id,
        tt.level + 1 AS level,
        tt.path_route || t.id::text AS path_route
    FROM public.tasks t
    INNER JOIN task_tree tt ON t.parent_id = tt.id
    WHERE tt.level < 7 -- Medida de segurança
)
SELECT 
    id,
    parent_id,
    client_name,
    contract_value,
    status,
    start_date,
    end_date,
    description,
    owner_id,
    level,
    path_route
FROM task_tree
ORDER BY path_route;
```

---

## 5. Requisitos Funcionais Principais

### RF01 — Recursividade Hierárquica de 7 Níveis
*   **Descrição:** O sistema deve permitir criar subtarefas a partir de qualquer tarefa existente, até o limite imposto de 7 níveis.
*   **Comportamento de UX (ClickUp-Style):**
    *   Exibir recuo visual progressivo de acordo com a profundidade da tarefa (ex: classes `tree-indent-1` a `tree-indent-6` baseados no `level` retornado).
    *   Botão lateral na listagem para expandir/recolher filhos rapidamente.
    *   Ação de "Mover nó" por drag-and-drop ou seletor de tarefa-pai, com validação de segurança instantânea do trigger.
*   **Critérios de Aceite:**
    *   [ ] Ao tentar criar uma subtarefa de 8º nível, o sistema bloqueia e exibe uma mensagem clara de erro.
    *   [ ] Quando uma tarefa pai é excluída, todas as suas subtarefas (descendentes de qualquer nível) são deletadas em cascata via `ON DELETE CASCADE`.

### RF02 — Portal Público do Cliente (`/share/:client_id` ou `/share/:share_token`)
*   **Descrição:** Permite que o cliente final visualize o progresso do projeto em tempo real sem precisar de autenticação.
*   **Lógica de Segurança:**
    *   Como a tabela de tarefas possui informações que não devem ser expostas abertamente a qualquer um, a rota pública não deve utilizar apenas um número sequencial vulnerável a ataques de varredura.
    *   O sistema gera um link contendo um **Token de Compartilhamento Criptográfico (UUIDv4)** atrelado ao cliente.
    *   O link será estruturado como: `https://taskmaster.vercel.app/share/:share_token`.
*   **Estrutura de dados para compartilhamento:**
    ```sql
    CREATE TABLE public.client_shares (
        share_token UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        client_name VARCHAR(255) NOT NULL,
        owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
    );
    ```
*   **Critérios de Aceite:**
    *   [ ] Clientes visualizando o link de compartilhamento não possuem permissões de escrita, edição ou exclusão.
    *   [ ] O portal público exibe o progresso percentual acumulado, o valor contratado, o cronograma em árvore (somente leitura) e o status das tarefas.
    *   [ ] O gestor pode revogar ou regenerar o token de compartilhamento a qualquer momento através do painel privado de configurações do projeto.

### RF03 — Propagação e Gerenciamento de Status
*   **Descrição:** O status de uma tarefa pai deve refletir de forma inteligente o progresso de suas subtarefas filhas.
*   **Lógica de Atualização (ClickUp Logic):**
    *   **Cálculo de Progresso Percentual por Tarefa:**
        *   Se a tarefa é folha (não tem filhos): `Concluído` = 100%, `Em Execução` = 50%, `Pendente` = 25%, `A Fazer` = 0%.
        *   Se a tarefa possui subtarefas: O progresso da tarefa pai é a **média aritmética** do progresso de suas filhas diretas.
    *   **Mudança Automática de Status:**
        *   Se todas as tarefas filhas de uma tarefa pai forem alteradas para `Concluído`, o status da tarefa pai muda automaticamente para `Concluído`.
        *   Se pelo menos uma tarefa filha for alterada para `Em Execução`, o status da tarefa pai muda automaticamente para `Em Execução` (se estiver como `A Fazer` ou `Pendente`).
*   **Abordagem Técnica:** Implementação via Trigger no PostgreSQL para evitar latência no frontend ou disparos desordenados de rede.
*   **Critérios de Aceite:**
    *   [ ] A alteração do status de uma tarefa folha recalcula e atualiza instantaneamente a árvore de pais ascendentes correspondentes.

### RF04 — Consolidação e Organização Financeira
*   **Descrição:** Exibição destacada dos indicadores financeiros consolidados do projeto no topo da página.
*   **Indicadores Obrigatórios (Top Cards):**
    *   **Valor Total do Contrato:** Soma acumulada de todos os `contract_value` cadastrados na árvore do projeto selecionado.
    *   **Valor Executado (Faturado):** Soma do `contract_value` apenas de tarefas que estejam no status `Concluído`.
    *   **Progresso Financeiro:** Indicador percentual representativo do valor executado em relação ao total do contrato ($\frac{\text{Valor Executado}}{\text{Valor Total}} \times 100$).
*   **Critérios de Aceite:**
    *   [ ] O painel financeiro se atualiza em tempo real sempre que uma tarefa de qualquer nível tem seu `contract_value` alterado ou seu status modificado para/de `Concluído`.

---

## 6. Segurança e Row Level Security (RLS) no Supabase

Para garantir total conformidade com a LGPD e o isolamento de dados de multi-inquilino (multi-tenant), as políticas de RLS devem ser configuradas estritamente no Supabase.

### 6.1. Política para Usuários Autenticados (Painel do Gestor)
Os gestores autenticados só podem interagir com tarefas e registros que pertencem a eles (`owner_id` igual ao seu `uid`).

```sql
-- Habilita o RLS nas tabelas
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_shares ENABLE ROW LEVEL SECURITY;

-- 1. Políticas para a tabela 'tasks' (Usuários Autenticados)
CREATE POLICY "Gestores podem gerenciar suas próprias tarefas"
ON public.tasks
FOR ALL
TO authenticated
USING (auth.uid() = owner_id)
WITH CHECK (auth.uid() = owner_id);

-- 2. Políticas para a tabela 'client_shares' (Usuários Autenticados)
CREATE POLICY "Gestores podem gerenciar seus tokens de compartilhamento"
ON public.client_shares
FOR ALL
TO authenticated
USING (auth.uid() = owner_id)
WITH CHECK (auth.uid() = owner_id);
```

### 6.2. Política de Acesso Público para o Portal do Cliente (Leitura Anônima)
O cliente externo que acessa sem login deve ter acesso de leitura concedido **estritamente** aos registros que batem com o `client_name` authorized pelo token ativo.

```sql
-- Função auxiliar para validar acesso via Token e retornar o cliente correspondente
CREATE OR REPLACE FUNCTION public.get_client_name_by_share_token(token UUID)
RETURNS VARCHAR(255) AS $$
    SELECT client_name 
    FROM public.client_shares 
    WHERE share_token = token AND is_active = TRUE;
$$ LANGUAGE sql SECURITY DEFINER;

-- Política de RLS para Leitura Anônima na tabela de Tarefas
CREATE POLICY "Acesso público via share_token de cliente"
ON public.tasks
FOR SELECT
TO anon
USING (
    client_name = public.get_client_name_by_share_token(
        NULLIF(current_setting('request.headers', true)::json->>'x-share-token', '')::uuid
    )
);
```

---

## 7. Especificação de Frontend (React + Vite)

### 7.1. Componente "Tree View" de Alta Performance
O carregamento de estruturas de 7 níveis pode gerar lentidão se renderizado de forma ingênua. Recomenda-se a utilização de uma **árvore recursiva híbrida** ou carregamento sob demanda (**Lazy Loading**).

#### Arquitetura de Componentes Recomendada:
```
[ProjectDashboard] (State: tasksTree, expandedTasks)
   ├── [FinanceSummaryHeader] (Exibe R$ Total, R$ Executado e % Financeiro)
   └── [TaskTable] (Estrutura tabular com layout grid flexível)
         ├── [TableHeader]
         └── [TaskRowGroup] (Recursivo / Iterativo)
               ├── [TaskRow] (Nó individual com botão expandir, status badge e input de valor)
               └── [SubTaskContainer] (Se expandido, renderiza recursivamente ou renderiza os filhos)
```

#### Estratégia de Otimização e Performance:
1.  **Vetor Único Achatado (Flattened Array):** Em vez de manter um estado profundamente aninhado que dificulta atualizações e rastreamento, o frontend consome a árvore ordenada da CTE do Postgres e a mantém achatada em um array.
2.  **Lazy Rendering de Filhos Ocultos:** Subtarefas recolhidas não devem ser instanciadas no DOM do navegador. Elas são filtradas dinamicamente na renderização do array com base em um mapa de estados `expandedTasks` (objeto chave-valor do tipo `{ [taskId: string]: boolean }`).
3.  **Micro-interações Suaves:** Hover nas linhas revela o botão de arrastar (`drag_indicator`), e a transição ao abrir subtarefas deve ser suave com transições de opacidade.

### 7.2. Cores, Formas e Componentes (Tokens do Design System)
Conforme as diretrizes corporativas modernas especificadas, o frontend deve seguir estritamente os tokens abaixo:

*   **Paleta de Cores:**
    *   `background`: Slate claro `#f8f9ff` com container de elevação em Branco `#ffffff`.
    *   `primary`: Azul Real `#0058be` para ações críticas e foco.
    *   `outline`: Cinza `#727785` para divisórias leves de linhas da tabela.
*   **Tipografia:**
    *   Corpo das tarefas: `Inter` de 14px (`body-md`), otimizado para alta densidade.
    *   Badge de Status:
        *   `A Fazer`: Fundo Cinza 100 / Texto Cinza 800.
        *   `Em Execução`: Fundo Azul Real 500 / Texto Branco.
        *   `Pendente`: Fundo Âmbar 100 / Texto Âmbar 900.
        *   `Concluído`: Fundo Esmeralda 500 / Texto Branco.

---

## 8. User Stories Detalhadas e Critérios de Aceite

### User Story 1
> **Como** gestor ou usuário do sistema,  
> **Quero** criar tarefas e ramificá-las em subtarefas de até 7 níveis hierárquicos,  
> **Para** simplificar o planejamento técnico de projetos complexos in etapas menores e exequíveis, reduzindo minha carga cognitiva.

*   **Cenário 1: Criação de subtarefa válida**
    *   **Dado** que estou visualizando o projeto com profundidade 3,
    *   **Quando** eu clico no botão "Adicionar Subtarefa" na tarefa de nível 3,
    *   **Então** uma nova tarefa filha é criada abaixo dela no nível 4, herdando o `client_name` e o `owner_id`.
*   **Cenário 2: Bloqueio de profundidade limite**
    *   **Dado** que tenho uma ramificação no nível 7,
    *   **Quando** eu tento criar ou arrastar uma subtarefa para baixo desse nível 7,
    *   **Then** o sistema exibe um aviso informando que a profundidade limite de 7 níveis foi alcançada, impedindo a operação tanto no frontend quanto no banco.

---

### User Story 2
> **Como** cliente do projeto (stakeholder externo),  
> **Quero** acessar um link público de compartilhamento gerado para mim,  
> **Para** acompanhar em tempo real o andamento físico e financeiro do projeto sem precisar de cadastro ou autenticação.

*   **Cenário 1: Visualização do Portal Público**
    *   **Dado** que eu acessei o link `https://taskmaster.vercel.app/share/e3981a5f-0df5-4c07-b3cd-943cc453ef1a`,
    *   **Quando** a página carregar,
    *   **Então** eu vejo a árvore de tarefas e cronograma restrita apenas às tarefas que pertencem a mim, com os cards superiores financeiros e progresso consolidados.
*   **Cenário 2: Bloqueio de Ações de Edição**
    *   **Dado** que estou no portal público de leitura,
    *   **Quando** eu tentar clicar em qualquer elemento ou disparar uma rota de escrita na API,
    *   **Então** a interface me impede fisicamente e as requisições falham com erro de autorização nas políticas RLS do Supabase.

---

## 9. Plano de Deploy, CI/CD e Verificação

### 9.1. Integração Contínua e Deploy
*   **Repositório:** GitHub com ramificação principal `main` protegida.
*   **Hospedagem:** Deploy automático na Vercel conectado à branch `main`.
*   **Vercel Serverless Functions:** As rotas do backend Node.js (se necessárias para integrações externas ou relatórios complexos) serão hospedadas na pasta `/api` do repositório, garantindo deploy unificado.
*   **Configuração de Ambiente (Variables):**
    *   `VITE_SUPABASE_URL`: Endpoint da instância Supabase.
    *   `VITE_SUPABASE_ANON_KEY`: Chave anônima para requisições do frontend.
    *   `SUPABASE_SERVICE_ROLE_KEY` (apenas no backend Vercel, se aplicável).

### 9.2. Plano de Testes e Validação Técnica

#### Testes do Banco de Dados (Supabase/PostgreSQL)
Para validar os limites hierárquicos, execute o seguinte teste de estresse SQL no console do Supabase:
```sql
-- Script de Teste para Validar Recursividade de 7 Níveis e Bloqueio no 8º Nível
INSERT INTO public.tasks (id, parent_id, client_name, contract_value, status, start_date, end_date, owner_id) VALUES
('00000000-0000-0000-0000-000000000001', NULL, 'TechNova Solutions', 1000.00, 'A Fazer', '2026-01-01', '2026-12-31', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'); -- Nivel 1

INSERT INTO public.tasks (id, parent_id, client_name, contract_value, status, start_date, end_date, owner_id) VALUES
('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'TechNova Solutions', 1000.00, 'A Fazer', '2026-01-01', '2026-12-31', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'); -- Nivel 2

INSERT INTO public.tasks (id, parent_id, client_name, contract_value, status, start_date, end_date, owner_id) VALUES
('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000002', 'TechNova Solutions', 1000.00, 'A Fazer', '2026-01-01', '2026-12-31', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'); -- Nivel 3

INSERT INTO public.tasks (id, parent_id, client_name, contract_value, status, start_date, end_date, owner_id) VALUES
('00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000003', 'TechNova Solutions', 1000.00, 'A Fazer', '2026-01-01', '2026-12-31', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'); -- Nivel 4

INSERT INTO public.tasks (id, parent_id, client_name, contract_value, status, start_date, end_date, owner_id) VALUES
('00000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000004', 'TechNova Solutions', 1000.00, 'A Fazer', '2026-01-01', '2026-12-31', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'); -- Nivel 5

INSERT INTO public.tasks (id, parent_id, client_name, contract_value, status, start_date, end_date, owner_id) VALUES
('00000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000005', 'TechNova Solutions', 1000.00, 'A Fazer', '2026-01-01', '2026-12-31', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'); -- Nivel 6

INSERT INTO public.tasks (id, parent_id, client_name, contract_value, status, start_date, end_date, owner_id) VALUES
('00000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000006', 'TechNova Solutions', 1000.00, 'A Fazer', '2026-01-01', '2026-12-31', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'); -- Nivel 7

-- O insert abaixo DEVE falhar e retornar a exceção customizada do Trigger:
INSERT INTO public.tasks (id, parent_id, client_name, contract_value, status, start_date, end_date, owner_id) VALUES
('00000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000007', 'TechNova Solutions', 1000.00, 'A Fazer', '2026-01-01', '2026-12-31', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'); -- Nivel 8 (ERRO ESPERADO)
```
