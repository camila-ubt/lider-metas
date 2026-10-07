"use client";

import { useState } from "react";
import styles from "./ManualUsuario.module.css";

const secoes = [
  {
    titulo: "Vendas",
    itens: [
      ["Como lançar ou corrigir uma venda?", [
        "Abra “Lançar vendas”, escolha o dia, o período e a loja, informe o valor e salve. Para corrigir, abra o mesmo lançamento, altere o valor e salve novamente.",
      ]],
      ["O que fazer quando o caixa não abriu?", [
        "Use “Marcar caixa não aberto”. O sistema registra o período com valor zero.",
      ]],
      ["Como fechar o mês?", [
        "Depois de preencher o último dia e conferir os valores, use “Fechar mês”. O mês continuará disponível para consulta, mas não poderá mais ser alterado.",
      ]],
    ],
  },
  {
    titulo: "Metas",
    itens: [
      ["Como cadastrar ou editar uma meta?", [
        "Escolha o mês e abra Configurações → Metas. Toque na loja e no período, informe a meta e salve.",
      ]],
      ["Como imprimir as metas?", [
        "Em Configurações → Metas, toque em “Imprimir metas”, confira o mês e envie para a impressora.",
      ]],
    ],
  },
  {
    titulo: "PA das vendedoras",
    itens: [
      ["Como conferir ou corrigir o PA?", [
        "Abra “PA das vendedoras”, escolha o mês e a vendedora. Entre na loja para conferir os lançamentos. Use “Editar” para corrigir ou remover e “Adicionar lançamento” quando faltar um registro.",
      ]],
      ["Como registrar férias?", [
        "Selecione a vendedora, toque em “Registrar férias”, informe início e fim e confirme. Lançamentos existentes nas datas informadas podem ser removidos.",
      ]],
      ["Como fechar ou reabrir o PA do mês?", [
        "Depois de conferir e aprovar as lojas, use “Fechar mês”. Para corrigir um mês já fechado, uma administradora deve usar “Reabrir mês”.",
      ]],
    ],
  },
  {
    titulo: "Acesso e problemas",
    itens: [
      ["Algo não aparece ou não bate. O que conferir?", [
        "Confira primeiro o mês selecionado e atualize a página. Se o total estiver diferente do Athos, revise os lançamentos por loja e período antes de fazer um novo registro.",
      ]],
      ["Não consigo acessar ou editar. O que fazer?", [
        "Confira se o cadastro está aprovado e se o mês não está fechado. Para senha esquecida, use a recuperação por e-mail.",
      ]],
    ],
  },
];

function normalizar(texto) {
  return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

export default function ManualUsuario() {
  const [busca, setBusca] = useState("");
  const termo = normalizar(busca);
  const visiveis = secoes
    .map((secao, indice) => ({
      ...secao,
      id: "manual-tarefa-" + indice,
      itens: secao.itens.filter(([pergunta, respostas]) =>
        !termo || normalizar([secao.titulo, pergunta, ...respostas].join(" ")).includes(termo)
      ),
    }))
    .filter((secao) => secao.itens.length);

  const total = visiveis.reduce((soma, secao) => soma + secao.itens.length, 0);

  return (
    <section className={styles.manual} data-manual-usuario id="manual-inicio">
      <div className={styles.hero}>
        <p className={styles.eyebrow}>Ajuda</p>
        <h2>Manual do usuário</h2>

        <label className={styles.searchLabel} htmlFor="manual-busca">Buscar</label>
        <div className={styles.searchRow}>
          <input
            id="manual-busca"
            type="search"
            value={busca}
            onChange={(evento) => setBusca(evento.target.value)}
            placeholder="Ex.: férias, meta, mês fechado"
          />
          {busca && <button type="button" onClick={() => setBusca("")}>Limpar</button>}
        </div>

        <nav className={styles.quick} aria-label="Tarefas do manual">
          {visiveis.map((secao) => (
            <a
              key={secao.id}
              href={"#" + secao.id}
              onClick={(evento) => {
                evento.preventDefault();
                const grupo = document.getElementById(secao.id);
                if (grupo) {
                  grupo.open = true;
                  grupo.scrollIntoView({ block: "start" });
                  grupo.querySelector("summary")?.focus({ preventScroll: true });
                }
              }}
            >
              {secao.titulo}
            </a>
          ))}
        </nav>
      </div>

      <div className={styles.sections}>
        {visiveis.map((secao) => (
          <details
            className={styles.group}
            id={secao.id}
            key={secao.id + "-" + termo}
            open={termo ? true : undefined}
          >
            <summary>
              <h3>{secao.titulo}</h3>
            </summary>

            <div className={styles.groupContent}>
              {secao.itens.map(([pergunta, respostas]) => (
                <details key={pergunta} open={termo ? true : undefined}>
                  <summary>{pergunta}</summary>
                  <div className={styles.answer}>
                    {respostas.map((resposta) => <p key={resposta}>{resposta}</p>)}
                  </div>
                </details>
              ))}
            </div>
          </details>
        ))}
      </div>

      {!total && <p className={styles.notice}>Nenhuma instrução encontrada.</p>}
    </section>
  );
}
