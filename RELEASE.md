# Líder Metas v1.11.0

O PA agora permite fechar um mês já conferido para preservar os dados aprovados.

- novo botão **Fechar mês** em **PA das vendedoras** para meses anteriores;
- o fechamento só é liberado quando todas as lojas com lançamentos das vendedoras ativas estão aprovadas;
- após o fechamento, lançamentos, correções, remoções, férias e aprovações daquele mês ficam bloqueados;
- o mês fechado continua disponível normalmente para consulta;
- somente administradoras ativas podem usar **Reabrir mês**;
- proteção aplicada também no banco de dados, evitando alterações por outros fluxos;
- teste automatizado para aprovação obrigatória, bloqueio e reabertura.

A atualização inclui a migration `20261005164500_fechamento_mensal_pa.sql`.

