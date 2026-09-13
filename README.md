# FinanCerto

Aplicativo React + Vite + Supabase, reconstruído em módulos. O Supabase é a fonte dos dados; somente a sessão Auth usa a persistência do SDK. Não há banco financeiro em localStorage.

## Executar

```powershell
npm.cmd install
npm.cmd run dev
```

Configure `.env` conforme `.env.example`, apenas com URL e chave pública. Nunca use service_role ou sb_secret no frontend; o build rejeita essas chaves.

## Banco existente

A causa do ENOTFOUND foi o projeto pausado. O projeto existente **FinanCerto**, ref `fzqstnkrklgficdurqsd`, foi reativado e vinculado à CLI. As migrations `202609100001` e `202609100002` foram aplicadas após revisão do schema real. Os hashes dos dados originais foram preservados.

1. Use `npm.cmd run check:supabase` para conferir DNS, Auth e disponibilidade da API. Uma tabela privada pode responder 401/42501 sem sessão; isso é proteção de acesso, não falha de DNS.
2. Para futuras migrations, confira o schema e execute `npx.cmd supabase db push --linked --dry-run` antes de aplicar. Não use reset.
3. Os Redirect URLs locais foram adicionados sem remover URLs ou alterar a confirmação de e-mail existente. Ao publicar em novo domínio, adicione sua URL exata ao Supabase Auth.

As datas antigas DD/MM/YYYY são lidas sem reescrever dados. A coluna remota `transactions.date` é PostgreSQL `date`; novas gravações usam YYYY-MM-DD. Transações e metas removidas na interface são arquivadas por `archived_at`. Nome, profissão, renda e objetivo reutilizam `profiles`; o complemento do onboarding fica em `user_financial_profiles`. Planos são protegidos contra alteração pelo cliente.

## Organização

- `src/app`, `contexts`, `hooks`: composição, sessão e carregamento.
- `src/pages`, `components`, `styles`: telas, componentes e visual responsivo.
- `src/services`, `utils`, `constants`: persistência, cálculos, score e regras.
- `src/integrations/whatsapp`: parser e orquestração desacoplada.
- `supabase`: migrations e Edge Functions de WhatsApp.
- `legacy-source`: cópia do código anterior, fora do aplicativo e do build.

## Verificar

```powershell
npm.cmd run lint
npm.cmd test
npm.cmd run build
$env:PLAYWRIGHT_BROWSERS_PATH = "$PWD/.cache/ms-playwright"
npx.cmd playwright install chromium
npm.cmd run test:runtime
```

`test:runtime` mantém a suíte isolada com respostas simuladas. `npm.cmd run test:real` executa a suíte real contra o projeto confirmado, criando/reutilizando duas contas QA separadas, sem mocks e sem apagar usuários ou registros existentes. Credenciais QA ficam somente em `.cache`, ignorado pelo Git. A suíte real verificou cadastro, login, sessão, onboarding, serviços, RLS e telas. `npx.cmd playwright test --config playwright.pwa-real.config.mjs` testa o build PWA com sessão real, fechamento/reabertura do navegador e cache seguro. Os testes SQL locais continuam disponíveis com PGlite.

O PWA armazena apenas o shell e assets. Chamadas Supabase não são cacheadas; dados financeiros exigem conexão. Notificações internas são geradas durante o uso; push remoto não está ativado. Realtime de transações está publicado no Supabase; operações no app e retorno à aba também recarregam os dados.

## WhatsApp

Vínculo seguro, webhook Meta, processamento/reenvio durável e Realtime foram implementados. As Edge Functions estão publicadas; falta configurar as credenciais oficiais da Meta. Veja [ativação e testes](supabase/functions/whatsapp-webhook/README.md). App e WhatsApp usam o mesmo serviço de transações e os mesmos dados. Nenhum segredo entra no React.
