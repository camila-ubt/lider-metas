# Releases

## v1.2.1 — Manutenção da documentação e política de segurança

Publicada em **7 de setembro de 2026**.

- Política de segurança com orientações para relatar vulnerabilidades.
- Correção da versão no rodapé da Wiki e alinhamento do README e do aplicativo.
- Histórico completo das releases na Wiki.

Proteção da `main` verificada: PR obrigatório, sem bypass de administradores, bloqueio de exclusão e de sobrescrita forçada do histórico. Essa configuração pertence ao repositório, não ao pacote da aplicação.

## v1.2.0 — Integração e gestão do PA

Publicada em **6 de setembro de 2026**.

### PA das vendedoras

- nova aba **PA das vendedoras**, exclusiva da gestão;
- resumo mensal por vendedora com dias válidos, vendas, peças, PA e premiação prevista;
- totais separados por loja;
- detalhamento diário dos lançamentos;
- aprovação dos lançamentos por vendedora, mês e loja;
- correção administrativa de vendas e peças;
- aviso automático no PA da vendedora quando um lançamento é corrigido;
- alteração posterior de um lançamento invalida a aprovação da loja para nova conferência.

### Perfis das vendedoras

- nova aba administrativa **Vendedoras**;
- novos cadastros entram como solicitações pendentes;
- aprovação e ativação do acesso diretamente pelo Líder Metas;
- separação entre solicitações pendentes e vendedoras já cadastradas;
- filtros de perfis ativos, desativados e todos;
- desativação com preservação do histórico;
- reativação sem necessidade de novo cadastro;
- sincronização do acesso entre o Líder Metas e o Cálculo PA.

### Segurança e dados

- somente perfis administrativos ativos podem gerenciar o acesso das vendedoras;
- registro da primeira aprovação para distinguir novos pedidos de perfis desativados;
- operações de correção e notificação do PA gravadas de forma integrada no banco.

## v1.1.1 — Ajuste na Conferência com o Athos

Publicada em **2 de setembro de 2026**.

### Correção

- alinhamento dos valores e totais na Conferência com o Athos;
- melhoria da organização visual para facilitar a comparação dos lançamentos.

## v1.1.0 — Conferência e segurança

Publicada em **2 de setembro de 2026**.

### Destaques

- filtro para ordenar as datas da Conferência com o Athos do mais recente para o mais antigo ou na ordem inversa;
- reforço das configurações de segurança do projeto;
- resumo do README;
- criação da publicação automática de releases com base na versão do aplicativo.

## v1.0.0 — Primeira versão oficial

Publicada em **31 de agosto de 2026**.

### Destaques

- acompanhamento de metas e níveis;
- lançamento diário por loja e período;
- calendário com estados completo, parcial e pendente;
- correção e remoção de lançamentos;
- registro de caixa não aberto;
- painel com ranking, evolução e projeções;
- comparativo histórico;
- conferência operacional;
- prévia e fechamento mensal;
- manual incorporado ao aplicativo;
- autenticação e perfis administrativos;
- interface responsiva.

### Segurança e manutenção posteriores

Após a v1.0.0, o projeto recebeu atualização de dependências, cabeçalhos de segurança, restrição de funções do banco, proteção da branch principal e ativação dos recursos de segurança do GitHub.

## Política de versão

- correção: ajustes sem mudança funcional relevante;
- versão menor: nova funcionalidade compatível;
- versão maior: mudança ampla de comportamento ou arquitetura.

Cada nova release deve incluir data, resumo, mudanças funcionais, migrações, observações de segurança e limitações conhecidas.

Consulte as [releases do repositório](https://github.com/camila-ubt/lider-metas/releases).
