# Líder Metas v1.13.0

A aba **Lançar vendas** passa a ter o botão **Fechar meses anteriores** para encerrar de uma vez todo o histórico já conferido até o fim do mês passado.

Depois da confirmação, os meses fechados continuam disponíveis para consulta, mas vendas e metas não podem mais ser incluídas, corrigidas ou removidas. A proteção é aplicada diretamente no banco, portanto vale também para outros fluxos do aplicativo.

O fechamento é cumulativo: o mês atual permanece liberado e, no mês seguinte, o mesmo botão avança o bloqueio para incluir o mês que acabou.

A versão inclui migration do Supabase, validação de permissões, proteção por triggers, teste automatizado, atualização do manual, Wiki e rodapé.
