# Desenvolvimento e versões

## Fluxo de mudanças

As alterações são feitas em branches e revisadas por Pull Request antes de chegar à `main`.

O CI executa lint e testes, e a Vercel gera as publicações da aplicação.

Mudanças de banco devem ser acompanhadas por migrations.

## Versão do aplicativo

A versão oficial fica em um único lugar:

`package.json`

O rodapé da aplicação lê esse valor automaticamente, portanto não é necessário editar o número da versão manualmente no componente.

## Versão da Wiki

A Wiki usa o marcador:

`{{APP_VERSION}}`

Durante a sincronização, o GitHub Actions substitui esse marcador pela versão atual do `package.json`.

O workflow também roda quando o `package.json` muda, mantendo a versão exibida na Wiki sincronizada com a aplicação.

## Publicação da Wiki

Os arquivos-fonte ficam em `docs/wiki`.

Quando alterações nessa pasta chegam à `main`, o workflow **Sincronizar Wiki** publica o conteúdo na Wiki do GitHub.

A sincronização substitui o conteúdo antigo, evitando que páginas removidas continuem aparecendo na Wiki.

## Releases

O histórico detalhado das versões fica nas [Releases do GitHub](https://github.com/camila-ubt/lider-metas/releases), evitando duplicar changelog dentro da Wiki.
