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

Com acesso administrativo ao **FinanCerto**, adicionar às URLs permitidas do Auth, preservando as existentes:

- `https://financerto-nexora.netlify.app`
- `https://financerto-nexora.netlify.app/?recovery=1`

Após a migração de domínio, conferir confirmação de cadastro e recuperação de senha. Login com senha usa o mesmo Supabase e não exige migração de usuários. Ajustar a Site URL somente quando o novo domínio público estiver confirmado.

A conta Supabase atualmente autenticada não tem acesso administrativo ao FinanCerto. A migration aditiva e as Edge Functions WAHA aguardam essa conta correta; o gateway também requer servidor Docker persistente, HTTPS e pareamento do número empresarial. Netlify hospeda o frontend, não o processo persistente WAHA.

Operação: [WHATSAPP-WAHA.md](WHATSAPP-WAHA.md). Evidências e limites: [WHATSAPP-VALIDACAO.md](WHATSAPP-VALIDACAO.md).
