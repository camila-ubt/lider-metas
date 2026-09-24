## v1.4.0 — Segurança da autenticação e recuperação

Publicada em **24 de setembro de 2026**.

Esta versão reforça os fluxos de acesso do Líder Metas e da recuperação compartilhada com o Cálculo PA, sem alterar as regras de vendas, metas ou PA.

### Autenticação

- limite local de tentativas em login e cadastro;
- bloqueio temporário após cinco falhas em uma janela de dez minutos;
- bloqueio de quinze minutos após atingir o limite;
- e-mails normalizados antes das operações de autenticação;
- bloqueio adicional em falhas de recuperação e troca de senha.

### Senhas

- criação e redefinição passam a exigir no mínimo 8 caracteres;
- a senha deve conter letra maiúscula, letra minúscula e número;
- confirmação da nova senha continua obrigatória;
- sessões continuam sendo encerradas globalmente após a redefinição.

### Validação

- testes automatizados adicionados para regra de senha e rate limit;
- fluxo compartilhado de recuperação preservado;
- controles do Supabase continuam sendo a proteção do servidor, com o rate limit local atuando como camada complementar.

### Regras preservadas

- cálculos de Meta, Supermeta, Megameta e PA permanecem inalterados;
- integração de horários com a Calculadora de Metas permanece inalterada;
- regras de perfis, lançamentos e conferência permanecem inalteradas.
