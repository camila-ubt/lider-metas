import {
  responderPerguntaMetas as responderBase,
  sugestoesPerguntas,
} from "@/lib/assistenteMetas";

const moeda = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const percentual = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

function normalizar(texto) {
  return String(texto || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9%\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function ehPedidoDeAcao(pergunta) {
  const q = normalizar(pergunta);
  return /o que fazer|como melhorar|melhorar (esses|estes|os) numeros|que acao|quais acoes|plano de acao|estrategia|o que voce recomenda|o que recomenda|o que sugere|como reverter|como aumentar|como recuperar/.test(q);
}

function aliasesLoja(loja) {
  const codigo = normalizar(loja.codigo);
  const nome = normalizar(loja.nome);
  const ignorar = new Set(["loja", "acessorios", "acessorio", "bijoux", "biju", "bijuterias"]);
  return [...new Set([
    codigo,
    nome,
    ...nome.split(" ").filter((item) => item.length >= 3 && !ignorar.has(item)),
  ].filter(Boolean))];
}

function encontrarLojaNoContexto(lojas, historico) {
  const contexto = [...historico]
    .reverse()
    .map((item) => normalizar(item.conteudo))
    .filter(Boolean);

  for (const texto of contexto) {
    const tokens = new Set(texto.split(" "));
    const encontrada = lojas.find((loja) =>
      aliasesLoja(loja).some((alias) =>
        alias.includes(" ") ? texto.includes(alias) : tokens.has(alias)
      )
    );
    if (encontrada) return encontrada;
  }

  return null;
}

function encontrarPeriodo(pergunta, historico) {
  const contexto = [pergunta, ...[...historico].reverse().map((item) => item.conteudo)]
    .map(normalizar)
    .join(" ");
  if (/\bnoite\b|\bnoturno\b/.test(contexto)) return "noite";
  if (/\bmanha\b|\bmatutino\b/.test(contexto)) return "manha";
  return null;
}

function somar(lista, campo = "valor_vendido") {
  return lista.reduce((total, item) => total + Number(item?.[campo] || 0), 0);
}

function dataReferencia(mes, vendas) {
  const hoje = new Date();
  const [ano, numeroMes] = mes.split("-").map(Number);
  if (hoje.getFullYear() === ano && hoje.getMonth() + 1 === numeroMes) {
    return `${ano}-${String(numeroMes).padStart(2, "0")}-${String(hoje.getDate()).padStart(2, "0")}`;
  }

  const datas = vendas
    .map((item) => item.data)
    .filter((data) => String(data || "").startsWith(`${mes}-`))
    .sort();
  const ultimoDia = new Date(ano, numeroMes, 0).getDate();
  return datas.at(-1) || `${mes}-${String(ultimoDia).padStart(2, "0")}`;
}

function dadosLoja({ loja, periodo, mes, vendas, metas }) {
  const referencia = dataReferencia(mes, vendas);
  const [ano, numeroMes] = mes.split("-").map(Number);
  const totalDias = new Date(ano, numeroMes, 0).getDate();
  const diaAtual = Math.max(1, Number(referencia.slice(8, 10)) || 1);
  const inicio = `${mes}-01`;

  const vendasMes = vendas.filter((item) => {
    if (item.data < inicio || item.data > referencia) return false;
    if (Number(item.loja_id) !== Number(loja.id)) return false;
    if (periodo && item.periodo !== periodo) return false;
    return true;
  });

  const meta = somar(
    metas.filter((item) => {
      if (String(item.mes || "").slice(0, 7) !== mes) return false;
      if (Number(item.loja_id) !== Number(loja.id)) return false;
      if (periodo && item.periodo !== periodo) return false;
      return true;
    }),
    "valor_meta"
  );

  const vendido = somar(vendasMes);
  const porDia = new Map();
  vendasMes.forEach((item) => {
    porDia.set(item.data, (porDia.get(item.data) || 0) + Number(item.valor_vendido || 0));
  });
  const valoresDiarios = [...porDia.values()].filter((valor) => valor > 0);
  const mediaAtual = valoresDiarios.length ? vendido / valoresDiarios.length : 0;
  const diasRestantes = Math.max(totalDias - diaAtual, 0);
  const falta = Math.max(meta - vendido, 0);
  const necessarioDia = diasRestantes > 0 ? falta / diasRestantes : falta;
  const projecao = vendido + mediaAtual * diasRestantes;
  const atingimento = meta > 0 ? (vendido / meta) * 100 : null;
  const projecaoPct = meta > 0 ? (projecao / meta) * 100 : null;

  return {
    vendido,
    meta,
    mediaAtual,
    diasRestantes,
    falta,
    necessarioDia,
    projecao,
    atingimento,
    projecaoPct,
  };
}

function escolherLojaCritica({ lojas, periodo, mes, vendas, metas }) {
  const candidatos = lojas
    .map((loja) => ({ loja, dados: dadosLoja({ loja, periodo, mes, vendas, metas }) }))
    .filter((item) => item.dados.meta > 0);

  if (!candidatos.length) return lojas[0] || null;
  candidatos.sort((a, b) => (a.dados.projecaoPct ?? 999) - (b.dados.projecaoPct ?? 999));
  return candidatos[0].loja;
}

function respostaDeAcao({ pergunta, mes, vendas, metas, lojas, historico }) {
  if (!ehPedidoDeAcao(pergunta)) return null;

  const periodo = encontrarPeriodo(pergunta, historico);
  const lojaContexto = encontrarLojaNoContexto(lojas, historico);
  const loja = lojaContexto || escolherLojaCritica({ lojas, periodo, mes, vendas, metas });
  if (!loja) return "Não encontrei uma loja no contexto para montar um plano de ação.";

  const dados = dadosLoja({ loja, periodo, mes, vendas, metas });
  const nomePeriodo = periodo ? ` no turno da ${periodo === "manha" ? "manhã" : "noite"}` : "";

  if (!(dados.meta > 0)) {
    return `Para melhorar a ${loja.codigo}${nomePeriodo}, eu começaria acompanhando uma meta diária do turno e a média dos últimos dias. Hoje não encontrei uma meta mensal cadastrada para esse recorte, então não consigo calcular com segurança quanto precisa vender por dia.`;
  }

  const acoes = [];
  if (dados.diasRestantes > 0 && dados.falta > 0) {
    acoes.push(`trabalhar com um piso de ${moeda.format(dados.necessarioDia)} por dia nos ${dados.diasRestantes} dias restantes para garantir a Meta`);
  }

  if (dados.mediaAtual > 0) {
    if (dados.necessarioDia > dados.mediaAtual) {
      const aumento = ((dados.necessarioDia / dados.mediaAtual) - 1) * 100;
      acoes.push(`elevar a média diária de ${moeda.format(dados.mediaAtual)} para pelo menos ${moeda.format(dados.necessarioDia)}, um ganho de cerca de ${percentual.format(aumento)}%`);
    } else {
      acoes.push(`não deixar a média diária cair abaixo de ${moeda.format(dados.necessarioDia)}; a média atual está em ${moeda.format(dados.mediaAtual)}`);
    }
  }

  acoes.push("acompanhar o resultado do turno a cada 2 ou 3 dias e agir antes que a média necessária aumente");
  acoes.push("nos dias fracos, reforçar abordagem, sondagem e venda adicional, e comparar o resultado do turno com os dias em que a loja performou melhor");

  let resposta = `Para melhorar os números da ${loja.codigo}${nomePeriodo}, eu faria o seguinte: ${acoes.map((item, indice) => `${indice + 1}) ${item}`).join("; ")}.`;
  resposta += ` Hoje ela está em ${moeda.format(dados.vendido)} de ${moeda.format(dados.meta)} (${percentual.format(dados.atingimento)}% da Meta).`;

  if (dados.projecaoPct !== null) {
    if (dados.projecaoPct >= 100) {
      resposta += ` A projeção atual é ${moeda.format(dados.projecao)} (${percentual.format(dados.projecaoPct)}% da Meta), então o objetivo principal é sustentar o ritmo e evitar queda.`;
    } else {
      resposta += ` A projeção atual é ${moeda.format(dados.projecao)} (${percentual.format(dados.projecaoPct)}% da Meta), então é preciso acelerar o ritmo.`;
    }
  }

  return resposta;
}

export function responderPerguntaMetas(parametros) {
  const resposta = respostaDeAcao(parametros);
  if (resposta) return resposta;
  return responderBase(parametros);
}

export { sugestoesPerguntas };
