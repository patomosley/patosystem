# Login do PATO SO — como configurar (5 minutos)

Como o Netlify hospeda só arquivos estáticos (HTML/JS/CSS), o login usa o
**Supabase** — um serviço gratuito que fornece autenticação + banco de dados
Postgres pronto, sem precisar montar servidor. Cada pessoa loga com seu
próprio e-mail e senha.

## 1. Criar o projeto no Supabase

1. Acesse https://supabase.com e crie uma conta (dá pra usar login do GitHub/Google).
2. Clique em **New project**. Escolha um nome (ex: `pato-so`), uma senha de
   banco (guarde essa senha, é só do Postgres, não é a que o time vai usar
   pra logar) e a região mais próxima (South America).
3. Aguarde ~1 minuto até o projeto ficar pronto.

## 2. Pegar a URL e a chave da API

1. No painel do projeto, vá em **Project Settings** (ícone de engrenagem) → **API**.
2. Copie o **Project URL** (algo como `https://xxxxx.supabase.co`).
3. Copie a chave **anon public** (uma chave longa começando com `eyJ...`).

## 3. Colar essas credenciais nos arquivos

Substitua `SEU-PROJETO.supabase.co` e `SUA-CHAVE-ANON-AQUI` em **2 arquivos**:

- `js/auth-guard.js` (linhas `SUPABASE_URL` e `SUPABASE_ANON_KEY`)
- `login.html` (mesmas variáveis, dentro do `<script>` no final do arquivo)

## 4. Desativar cadastro público (importante!)

Por padrão o Supabase permite que qualquer pessoa se cadastre. Como você quer
controlar quem entra, desative isso:

1. No painel, vá em **Authentication** → **Providers** → **Email**.
2. Desmarque a opção **"Allow new users to sign up"** (ou similar, o texto
   pode variar um pouco conforme a versão do painel).

Sem isso ligado, só quem você cadastrar manualmente consegue logar — o que é
exatamente o que você quer pra um sistema interno.

## 5. Adicionar/remover pessoas do time

1. No painel, vá em **Authentication** → **Users**.
2. Clique em **Add user** → **Create new user**.
3. Preencha e-mail e senha (pode marcar "Auto Confirm User" pra não precisar
   de e-mail de confirmação) e salve.
4. Pra remover alguém, é só achar o usuário na lista e excluir.

Não precisa mexer em nenhum código pra adicionar ou tirar gente — tudo é
feito por essa tela.

## 6. Publicar no Netlify

Suba a pasta normalmente (como já faz hoje). Os arquivos novos que foram
adicionados/alterados são:

- `login.html` (tela de login)
- `js/auth-guard.js` (protege as páginas e verifica o login)
- Todas as páginas do sistema (`index.html`, `whois/whois.html`,
  `mkscript/index.html`, etc.) — cada uma ganhou 3 linhas no `<head>` que
  carregam o auth-guard.

## Como funciona no dia a dia

- Ao abrir qualquer página do sistema sem estar logado, a pessoa é
  redirecionada automaticamente para `/login.html`.
- Depois de logar, ela volta pra página que tentou acessar.
- Um selinho no canto inferior direito mostra o e-mail logado e um botão
  **Sair** pra encerrar a sessão.
- A sessão fica salva no navegador (não precisa logar de novo a cada
  página).

## Se quiser proteger novas páginas no futuro

Basta colar essas 3 linhas dentro do `<head>`, logo após a tag
`<meta name="viewport" ...>`:

```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="/js/auth-guard.js"></script>
<style>html{visibility:hidden}</style>
```

## Custo

O plano gratuito do Supabase cobre folgadamente o uso de um time interno
(até 50.000 usuários ativos/mês, banco de 500MB). Não deve custar nada.
