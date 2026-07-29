export default function manifest() {
  return {
    name: "Metas Líder",
    short_name: "Metas Líder",
    description: "Acompanhamento de metas das lojas CB, AA e AB",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f6f3fb",
    theme_color: "#7650a7",
    orientation: "portrait-primary",
    icons: [
      {
        src: "/lider-metas-icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any maskable",
      },
    ],
  };
}
