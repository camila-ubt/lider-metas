# Operação e manutenção

## Fluxo de mudança

1. crie uma branch com escopo claro;
2. faça alterações pequenas e revisáveis;
3. atualize documentação e migrações relacionadas;
4. execute build, lint e auditoria de dependências;
5. abra uma Pull Request;
6. aguarde a prévia e os checks;
7. revise o diff;
8. faça merge somente depois da aprovação.

A `main` não deve receber push direto.

## Verificações recomendadas

- instalação reproduzível pelo lockfile;
- build de produção;
- auditoria de dependências sem alertas críticos ou altos;
- ausência de segredos no patch;
- funcionamento de login e aprovação de perfil;
- leitura do painel com um mês conhecido;
- criação, correção e remoção controlada de lançamento;
- cadastro administrativo de meta;
- geração de prévia e fechamento;
- cabeçalhos de segurança no ambiente publicado.

## Banco de dados

Mudanças de esquema devem ser registradas como migrações. Depois da aplicação:

1. confirme a versão da migração;
2. execute os advisors de segurança;
3. valide RLS e grants;
4. teste permissões de usuário ativo e administradora;
5. confirme que visitantes continuam sem acesso.

## Dependências

Dependabot monitora alertas e pode abrir atualizações de segurança. Atualizações devem manter o lockfile sincronizado e ser verificadas em prévia antes do merge.

## Publicação

A Vercel acompanha a branch principal e produz prévias para Pull Requests. Uma prévia aprovada não substitui a conferência do ambiente final após o merge.

## Documentação

- README: visão curta do projeto;
- Wiki: documentação funcional e técnica;
- release: mudanças de uma versão estável;
- Pull Request: motivo, escopo e evidências de cada alteração.

## Rotina periódica

- revisar acessos ativos;
- conferir alertas do GitHub e do Supabase;
- atualizar dependências;
- validar backup e recuperação conforme o plano disponível;
- revisar páginas da Wiki quando o comportamento mudar;
- criar uma nova release para marcos estáveis.
