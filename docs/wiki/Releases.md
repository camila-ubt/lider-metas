# Releases

## v1.6.0 — Gestão de lançamentos do PA

Publicada em **28 de setembro de 2026**.

- novo botão **Adicionar lançamento** no resumo da vendedora;
- escolha de loja, data, vendas e peças diretamente pela gestão;
- lançamento gravado no mesmo PA e refletido para a vendedora;
- aviso automático para a vendedora quando a gestão adiciona um lançamento;
- botão **Remover** no detalhamento diário para excluir registros incorretos ou duplicados;
- aviso automático para a vendedora também nas remoções;
- correção sem campo de observação obrigatório, usando os valores antes e depois no próprio aviso;
- remoção apenas da loja escolhida quando houver mais de um lançamento no mesmo dia;
- exclusão do dia do cálculo quando o registro removido era o único daquela data;
- bloqueio de duplicidade para a mesma loja e data, mantendo **Corrigir** como fluxo de edição;
- validação de loja ativa, quantidades e situação do dia;
- aprovação anterior da loja invalidada automaticamente após inclusão, correção ou remoção;
- testes automatizados para autorização, duplicidade, validações, remoção seletiva, aviso e invalidação da conferência.

A mudança concentra na conferência administrativa as ações necessárias para completar, corrigir ou remover lançamentos sem exigir acesso à conta da vendedora.

## v1.5.0 — Planejamento da meta por turno

Publicada em **28 de setembro de 2026**.

- detalhamento de quanto falta para a Meta nos períodos da manhã e da noite;
- contagem dos períodos restantes considerando o horário final de cada turno;
- cálculo da necessidade média por período restante;
- divisão igual dessa necessidade entre as lojas ativas;
- indicação direta quando a Meta do turno já foi atingida.

A atualização amplia a leitura gerencial do mês sem alterar metas, lançamentos ou regras de PA.

## v1.4.1 — Restrição do acesso público aos horários

Publicada em **24 de setembro de 2026**.

- leitura anônima da configuração de horários limitada aos campos necessários à Calculadora de Metas;
- campos de auditoria deixam de ser expostos ao acesso público;
- operações de escrita continuam restritas aos fluxos autenticados;
- migration de segurança versionada no repositório.

Esta versão não altera regras de vendas, metas, PA ou cálculos.

## v1.4.0 — Segurança da autenticação e recuperação

Publicada em **24 de setembro de 2026**.

- limite local de tentativas em login, cadastro, recuperação e troca de senha;
- bloqueio temporário após cinco falhas consecutivas dentro da janela configurada;
- novas senhas exigem pelo menos 8 caracteres, com maiúscula, minúscula e número;
- testes automatizados adicionados para as novas regras de autenticação;
- recuperação compartilhada entre Líder Metas e Cálculo PA preservada.

Esta versão não altera as regras de vendas, metas, PA ou integração de horários.

## v1.3.1 — Segurança e atualização de dependências

Publicada em **14 de setembro de 2026**.

- correção preventiva no tratamento do percentual exibido no feedback dos turnos;
- ajuste recomendado pela análise de código do GitHub;
- atualização do React, React DOM, Supabase e dependências de desenvolvimento;
- verificações automatizadas concluídas com sucesso.

Esta versão não altera as regras de vendas, metas, PA ou integração de horários.

## v1.3.0 — Integração de horários e melhorias de acesso

Publicada em **13 de setembro de 2026**.

### Integração com a Calculadora de Metas

- horários de manhã e noite passam a ser armazenados em configuração compartilhada no banco;
- Líder Metas e Calculadora de Metas usam a mesma referência de horários;
- alterações feitas pela gestão são refletidas nos cálculos dos dois sistemas;
- leitura pública controlada dos horários e alteração restrita a administradoras.

### Acesso e cadastro

- correção do link de recuperação de senha recebido por e-mail;
- suporte ao fluxo de recuperação enviado pelo provedor de autenticação e compatibilidade com links anteriores;
- nomes das vendedoras padronizados visualmente em caixa alta, inclusive em cadastros antigos;
- aba **Vendedoras** permanece selecionada após atualizar a página.

### Manutenção técnica

- atualização de dependências de produção e desenvolvimento;
- atualização do `actions/checkout` usado nos workflows;
- configuração de atualizações automáticas com Dependabot.

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
