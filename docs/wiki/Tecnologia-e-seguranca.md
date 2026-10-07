# Tecnologia e segurança

## Stack

O Líder Metas utiliza:

- **Next.js** e **React** na aplicação web;
- **Supabase** para autenticação, API e PostgreSQL;
- **Recharts** para visualizações;
- **Vercel** para publicação;
- **GitHub Actions** para verificações e automações do repositório.

## Arquitetura

```text
Usuário
  ↓
Next.js / React
  ↓
Cliente Supabase
  ↓
Auth + API + RLS
  ↓
PostgreSQL
```

A interface é responsável pela experiência de uso e pelos cálculos de apresentação. Os dados persistentes ficam no PostgreSQL do Supabase.

## Banco de dados

Entre as estruturas principais estão:

- `perfis`;
- `lojas`;
- `vendas_diarias`;
- `metas_mensais`;
- tabelas e funções relacionadas ao PA e aos fechamentos mensais.

Alterações de estrutura são registradas em migrations versionadas no repositório.

## Segurança

O acesso depende da autenticação do Supabase e das políticas de **Row Level Security (RLS)**.

As regras do banco impedem que uma simples alteração na interface contorne permissões importantes.

Funções sensíveis validam a identidade e o papel do usuário antes de executar ações administrativas.

Chaves secretas e credenciais privilegiadas não ficam no código cliente nem na documentação pública.
