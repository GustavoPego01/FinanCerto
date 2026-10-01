# Publicação do FinanCerto na Netlify

## Destino exclusivo

- Site: https://financerto-nexora.netlify.app
- Painel: https://app.netlify.com/projects/financerto-nexora
- Site ID: `8897d2b5-def6-42bf-93a0-0e4ff367a80a`
- GitHub: https://github.com/GustavoPego01/FinanCerto
- Supabase: `fzqstnkrklgficdurqsd` (projeto FinanCerto existente).

Não usar nem modificar o projeto Barbearias. Nenhum banco foi substituído.

## Configuração realizada

`netlify.toml` define `npm run build`, saída `dist`, Node 22, fallback SPA, headers de segurança e cache adequado ao service worker. As únicas variáveis configuradas na Netlify são `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`, do FinanCerto. Secrets WAHA e service_role ficam exclusivamente no backend Supabase.

O PWA tem manifesto, ícones, funcionamento do shell offline e atualização mediante aviso para evitar recarregar durante uma edição. Os dados financeiros não entram no cache offline.

O deploy `6abc4bd296f46af7fe157025` foi publicado pela CLI. Após autorização explícita do proprietário, somente este site teve removida a exigência de login da equipe Netlify. Página, manifesto, service worker e fallback SPA retornam HTTP 200 por HTTPS. O login do aplicativo e RLS continuam sob responsabilidade do Supabase, sem alteração de permissões.

`npm run test:production` passou no domínio Netlify com a conta QA existente: login, F5, fechamento/reabertura do navegador, service worker, ícones, ausência de dados privados no cache e recuperação após offline. O teste não enviou mensagens de WhatsApp.

## Publicar novamente

```powershell
npm.cmd ci
npm.cmd test
npm.cmd run lint
npm.cmd run build
npm.cmd run test:runtime
npx.cmd netlify-cli deploy --prod --no-build --dir dist --site 8897d2b5-def6-42bf-93a0-0e4ff367a80a
npm.cmd run test:production
```

A publicação atual usa a CLI autenticada; integração automática entre GitHub e Netlify ainda não foi configurada. Não presuma que um push publica o site automaticamente.

## Supabase e WhatsApp

Em 01/10/2026 UTC, o acesso administrativo ao FinanCerto foi confirmado. A URL principal do Auth foi alterada para https://financerto-nexora.netlify.app, e esse dom?nio com seus caminhos foi adicionado ? lista de redirecionamentos, preservando os endere?os existentes. A recupera??o de senha por e-mail ainda precisa de valida??o pelo destinat?rio.

A migra??o WAHA e as quatro Edge Functions foram publicadas. O gateway est? no Railway com HTTPS e volume persistente; o webhook HMAC foi validado. A sess?o aguarda pareamento pelo QR. Netlify hospeda o frontend.

Opera??o e evid?ncias atualizadas: [RAILWAY.md](RAILWAY.md), [WHATSAPP-WAHA.md](WHATSAPP-WAHA.md) e [WHATSAPP-VALIDACAO.md](WHATSAPP-VALIDACAO.md).
