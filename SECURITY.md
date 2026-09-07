# Política de segurança

## Versões suportadas

A versão publicada mais recente do Líder Metas recebe correções de segurança.

| Versão | Suporte |
| --- | --- |
| 1.x | ✅ |
| anteriores | ❌ |

## Como reportar uma vulnerabilidade

Não publique vulnerabilidades, credenciais, tokens, dados pessoais ou detalhes de exploração em Issues, Discussions ou Pull Requests.

Use o recurso **Report a vulnerability** na aba **Security** deste repositório para enviar o relato de forma privada. Inclua, quando possível:

- descrição do problema;
- passos mínimos para reproduzir;
- impacto observado;
- versão ou commit afetado;
- sugestão de correção, se houver.

Relatos serão analisados antes de qualquer divulgação pública. Credenciais eventualmente expostas devem ser revogadas ou rotacionadas imediatamente, independentemente da correção no código.

## Escopo

Este repositório nunca deve conter:

- chaves `service_role` ou `sb_secret_*` do Supabase;
- senhas, tokens de acesso ou chaves privadas;
- arquivos `.env` reais;
- dados pessoais ou exportações do banco de produção.

O cliente web utiliza somente a URL pública do projeto e uma chave publishable do Supabase. A autorização dos dados é aplicada no banco com Row Level Security (RLS) e separação de permissões entre vendedoras e administração.
