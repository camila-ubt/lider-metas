# Líder Metas

Aplicação web para acompanhamento de vendas e metas das lojas **CB, AA e AB**, com análise por loja, período e mês.

O sistema foi desenvolvido para centralizar os lançamentos diários, facilitar a conferência dos resultados e transformar os dados de vendas em informações práticas para a gestão.

## Acesso

Aplicação publicada em:

**https://metas-lider.vercel.app**

O acesso é restrito a usuários cadastrados e aprovados.

## Release atual

### Líder Metas v1.0.0 — Primeira versão oficial

A versão **v1.0.0** marca a primeira versão oficial e estável do Líder Metas.

Principais recursos disponíveis nesta release:

- acompanhamento de metas;
- cálculo dos valores necessários para atingir os objetivos;
- visualização do desempenho por loja;
- indicadores para acompanhamento das vendas;
- interface responsiva para uso em diferentes dispositivos.

## Principais funcionalidades

### Painel de acompanhamento

- Total vendido no mês
- Percentual da Meta atingido
- Jornada para Meta, Supermeta e Megameta
- Projeção de fechamento do mês
- Valor necessário por dia restante
- Resultado geral por loja
- Resultado separado por manhã e noite
- Ranking interativo das lojas
- Evolução acumulada das vendas
- Comparativo histórico
- Insights automáticos de desempenho

### Níveis de meta e comissão

- **Meta:** 100% do valor cadastrado
- **Supermeta:** 110% da Meta
- **Megameta:** 120% da Meta

Os cálculos são realizados para:

- resultado geral;
- cada loja;
- período da manhã;
- período da noite.

### Lançamento de vendas

- Calendário mensal de lançamentos
- Registro por loja e período
- Correção de valores já lançados
- Identificação de dias completos e parciais
- Lista de pendências por loja
- Pendências exibidas somente para períodos já encerrados
- Opção para registrar caixa não aberto
- Remoção de lançamentos incorretos

### Conferência com o Athos

Área para comparar os valores registrados no sistema com o relatório Athos.

- Conferência diária por loja
- Visualização rápida das diferenças
- Botão de edição em cada dia
- Abertura direta do lançamento que precisa ser corrigido

### Cadastro de metas

Área administrativa para cadastrar a Meta de cada loja e período.

A Supermeta e a Megameta são calculadas automaticamente em **110%** e **120%** da Meta cadastrada.

### Configuração dos períodos

Os horários de início e término da manhã e da noite podem ser configurados.

Esses horários são utilizados para:

- definir quando um período já encerrou;
- controlar quais lançamentos podem aparecer como pendentes;
- calcular corretamente os dias restantes da manhã e da noite;
- evitar que o período atual seja cobrado antes de terminar.

### Manual do usuário

O aplicativo possui um manual interno para apoiar a equipe durante o uso.

O manual inclui:

- explicação de todas as abas;
- interpretação dos indicadores;
- regras dos cálculos;
- orientação para lançamentos e correções;
- dúvidas frequentes;
- barra de pesquisa por palavra-chave.

## Regras dos cálculos por dia

Durante o mês em andamento, o sistema mostra:

- quanto falta no total para cada nível;
- quanto precisa ser vendido por dia restante.

Nos períodos da manhã e da noite, o cálculo respeita os horários configurados.

Quando o mês já encerrou, o sistema mostra:

- quanto faltou para atingir cada nível;
- a média equivalente por dia daquele mês.

## Fluxo recomendado de uso

1. Confirmar o mês selecionado.
2. Lançar as vendas de todas as lojas e períodos encerrados.
3. Corrigir eventuais pendências.
4. Conferir os valores com o relatório Athos.
5. Analisar o painel, o ranking, as projeções e os insights.

## Tecnologias utilizadas

- Next.js
- React
- JavaScript
- Supabase
- Recharts
- CSS Modules
- Vercel

## Estrutura principal

```text
src/
├── app/
│   ├── layout.js
│   ├── page.js
│   └── arquivos de estilo
├── components/
│   ├── DashboardEstavelV2.js
│   ├── FluxoPendenciasLancamento.js
│   ├── ConferenciaAthos.js
│   ├── ConfiguracaoHorarios.js
│   ├── ManualUsuario.js
│   └── demais componentes do sistema
└── lib/
    ├── supabase/
    └── horários e regras auxiliares
```

## Variáveis de ambiente

Para executar o projeto localmente, configure as credenciais do Supabase no arquivo `.env.local`.

Exemplo:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

Não publique credenciais privadas no repositório.

## Execução local

```bash
npm install
npm run dev
```

Depois, abra:

```text
http://localhost:3000
```

## Autoria

Produzido por [@camila-ubt](https://github.com/camila-ubt).
