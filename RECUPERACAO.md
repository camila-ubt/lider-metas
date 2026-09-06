# Recuperação compartilhada PA / Líder Metas

A página https://metas-lider.vercel.app/recuperar-senha recebe os pedidos dos dois aplicativos. O login de cada aplicativo permanece separado; a senha pertence à mesma identidade no Supabase.

## Publicação

1. Publicar primeiro a alteração do Líder Metas, que fornece a página.
2. Publicar depois o link do PA. Manter PA_PAINEL_ATIVO desativado até a ativação autorizada do painel.
3. Solicitar um novo e-mail pela página oficial e abri-lo no mesmo navegador. E-mails antigos podem conter o endereço anterior.

Configuração aplicada no Supabase compartilhado em 06/09/2026:
- Site URL: https://metas-lider.vercel.app/
- Redirect URLs: https://metas-lider.vercel.app/recuperar-senha, https://metas-lider.vercel.app/, https://calculo-pa.vercel.app/ e https://calculo-pa.vercel.app/?recuperacao=1 (compatibilidade).
- Templates padrão mantidos.

A recuperação usa as variáveis públicas existentes do Supabase do Líder Metas, sem chave administrativa. O pedido começa no domínio compartilhado para manter o verificador PKCE no mesmo navegador. O armazenamento da sessão de recuperação é separado do login normal. Códigos inválidos não reutilizam sessões anteriores. Após atualizar a senha, o cliente solicita encerramento global das sessões.

## Validação

Seis testes automatizados de validação de link/sessão/senha passaram. Builds de ambos os projetos passaram; o Líder Metas foi compilado com configuração pública fictícia porque não havia ambiente local provisionado. Interface conferida em desktop e celular com cliente simulado, incluindo link expirado e conclusão. Nenhum e-mail real foi enviado e nenhuma senha real foi alterada. O teste completo por e-mail depende da publicação.
