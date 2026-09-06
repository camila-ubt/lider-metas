# Arquitetura

## Visão geral

O Líder Metas é uma aplicação Next.js com interface React. O navegador acessa o Supabase usando uma chave publicável de baixo privilégio; autenticação, grants e Row Level Security determinam quais dados podem ser lidos ou alterados.

```text
Usuário autenticado
        ↓
Interface Next.js / React
        ↓
Cliente Supabase no navegador
        ↓
Auth + API de dados + políticas RLS
        ↓
PostgreSQL
```

## Camadas

### Interface

`src/app` contém a estrutura principal, estilos globais, metadados e manifesto. A página central controla autenticação, mês, navegação, lançamentos e metas.

### Componentes

`src/components` reúne painel, calendário, conferência, fechamento, inteligência gerencial, manual e ajustes de apresentação.

### Regras auxiliares

`src/lib` concentra contexto do mês, cálculos estatísticos, horários e criação do cliente Supabase.

### Persistência

O PostgreSQL do Supabase armazena perfis, lojas, metas e vendas. A autenticação é fornecida pelo Supabase Auth.

## Dependências principais

- Next.js 16;
- React 19;
- Supabase JS e Supabase SSR;
- Recharts;
- date-fns;
- html-to-image;
- Tailwind/PostCSS na cadeia de estilos.

## Estado no navegador

O aplicativo preserva preferências de navegação, mês, posição e horários para melhorar a continuidade de uso. Dados comerciais continuam sendo carregados do banco; o armazenamento local não substitui a fonte persistente.

## Renderização e publicação

A aplicação usa o App Router do Next.js e é publicada pela Vercel. Cada alteração deve passar por Pull Request e pela verificação de build antes de chegar à `main`.

## Cabeçalhos de segurança

A configuração do Next.js aplica CSP, restrições de recursos do navegador, política de referência, proteção contra detecção incorreta de conteúdo e bloqueio de incorporação em frames.

Veja [Operação e manutenção](Operacao-e-manutencao).
