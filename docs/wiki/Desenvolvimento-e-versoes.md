# Desenvolvimento e versões

## Fluxo de mudanças

As alterações são feitas em branches e revisadas por Pull Request antes de chegar à `main`.

O CI executa lint e testes, e a Vercel publica a aplicação.

Mudanças de banco são registradas em migrations.

## Versão do aplicativo

A versão da aplicação é definida em:

`package.json`

O rodapé e o Manual do usuário exibem essa versão automaticamente.

## Versão da Wiki

A Wiki usa o marcador:

`{{APP_VERSION}}`

Na sincronização, o GitHub Actions substitui o marcador pela versão definida no `package.json`.

## Publicação da Wiki

Os arquivos-fonte ficam em `docs/wiki`.

Alterações nessa pasta ou no `package.json`, quando chegam à `main`, acionam o workflow **Sincronizar Wiki**.

## Releases

O histórico de versões está nas [Releases do GitHub](https://github.com/camila-ubt/lider-metas/releases).
