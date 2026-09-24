## v1.4.1 — Restrição do acesso público aos horários

Publicada em **24 de setembro de 2026**.

Esta versão registra o endurecimento aplicado no banco para a integração de horários com a Calculadora de Metas.

### Segurança do banco

- o papel `anon` mantém leitura apenas de `id`, `manha_inicio`, `manha_fim`, `noite_inicio` e `noite_fim`;
- os campos de auditoria `atualizado_por` e `atualizado_em` deixam de ficar disponíveis para leitura pública;
- `INSERT`, `UPDATE`, `DELETE` e `REFERENCES` permanecem indisponíveis ao acesso anônimo;
- a migration aplicada no Supabase está versionada no repositório.

### Regras preservadas

- cálculos de Meta, Supermeta, Megameta e PA permanecem inalterados;
- a integração de horários com a Calculadora de Metas continua funcionando normalmente;
- nenhuma regra de vendas, perfis ou conferência foi alterada.
