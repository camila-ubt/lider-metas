import styles from "./SinalExpandir.module.css";

// Sinal visual padronizado para controles de abrir/fechar seções.
// A semântica do botão e aria-expanded ficam no componente que o utiliza.
export default function SinalExpandir({ aberto }) {
  return <span className={styles.sinal} aria-hidden="true">{aberto ? "−" : "+"}</span>;
}
