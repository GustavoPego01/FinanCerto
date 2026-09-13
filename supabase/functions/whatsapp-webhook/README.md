# Ativação do WhatsApp — FinanCerto

Backend publicado no Supabase existente `fzqstnkrklgficdurqsd`:

- `whatsapp-link`: sessão Auth validada no servidor; status, código e desconexão.
- `whatsapp-webhook`: desafio GET e assinatura HMAC-SHA256 do corpo POST da Meta.
- `whatsapp-worker`: processamento/reenvio durável, chamado a cada minuto pelo Cron com assinatura de 90 segundos e proteção contra replay. O segredo permanece no Vault; não entra na fila HTTP do pg_net.

## Configuração externa restante

1. No app da Meta, habilite WhatsApp Business Platform/Cloud API e verifique o número **+55 62 98276-7026** no WhatsApp Manager.
2. Em WhatsApp → API Setup/Getting Started, obtenha o **Phone Number ID desse número** e o **WhatsApp Business Account ID (WABA)**. O Phone Number ID não é o telefone e o WABA ID não é o Business Portfolio ID.
3. Gere um token de usuário do sistema com acesso ao WABA e permissões `whatsapp_business_messaging` e `whatsapp_business_management`. O token temporário do painel serve apenas para testes. Obtenha também o App Secret em configurações básicas do mesmo app Meta.
4. Cadastre o callback `https://fzqstnkrklgficdurqsd.supabase.co/functions/v1/whatsapp-webhook`. Use o **WHATSAPP_VERIFY_TOKEN já gerado em `.cache/whatsapp-server.env`** (arquivo local ignorado pelo Git). Copie apenas o valor para o painel; não publique o arquivo.
5. Assine o campo **messages** do objeto **whatsapp_business_account** e vincule/assine o app ao WABA correspondente. Eventos de status não geram respostas, evitando loops.
6. Preencha um arquivo local **`.cache/whatsapp-meta.env`**, usando `supabase/functions/.env.example` como referência. Informe os quatro valores reais: `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_BUSINESS_ACCOUNT_ID`, `META_APP_SECRET`.

```powershell
npx.cmd supabase secrets set --env-file .cache/whatsapp-meta.env --project-ref fzqstnkrklgficdurqsd
```

As funções e migrations já estão publicadas. Os secrets `WHATSAPP_VERIFY_TOKEN` e `WHATSAPP_WORKER_SECRET` já foram criados; preserve-os. O Supabase fornece `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` às funções. Nada disso deve ser adicionado como variável VITE. Versão Graph padrão: v23.0, substituível por `WHATSAPP_GRAPH_API_VERSION`.

Referência oficial: https://www.postman.com/meta/whatsapp-business-platform/documentation/wlk6lh4/whatsapp-cloud-api

## Vínculo e teste final

No Perfil autenticado, gere o código e envie **VINCULAR CÓDIGO** do WhatsApp pessoal para o número empresarial. O código tem 60 bits de entropia, hash SHA-256, validade de 10 minutos, uso único e limite de emissão. Apenas o `wa_id` recebido de um webhook assinado pode confirmar o vínculo. A desconexão invalida a versão do vínculo, o contexto e respostas pendentes. Uma resposta já enviada ao provedor não pode ser recolhida.

Envie `Gastei 45 no almoço`, `Recebi 3000 de salário`, `Quanto tenho de saldo?`, `Quanto gastei esse mês?`, `Quanto recebi esse mês?`, `Quanto gastei com alimentação?`, `Últimos gastos`, `Como está minha vida financeira?`, `Meu FinanScore`, `Minhas metas` ou `Quanto falta para minha viagem?`. Mensagens incompletas podem ser completadas em até 10 minutos; `cancelar` limpa o contexto. Períodos não suportados e exclusões são direcionados ao app. Não há IA paga.

Confirme a resposta real da Meta e o lançamento no Dashboard sem F5. Esta última etapa exige as credenciais oficiais; os testes atuais validam banco/Edge/Realtime reais e capturam o envio em um adaptador de teste, sem declarar entrega pela Meta.

## Segurança e recuperação

`provider_message_id` é único; o banco vincula cada mensagem à versão da conexão no recebimento. A escrita usa `transactionService` e RPC com identidade derivada no servidor. Uma repetição não duplica transações. Processamento e entrega têm leases e retries separados. Respostas são enviadas dentro de 23 horas da mensagem recebida; não há templates nem disparos proativos. Conteúdo temporário é limpo após processamento/envio ou expiração de 24 horas. IDs e estados permanecem para deduplicação. Falhas ambíguas da rede podem repetir a confirmação enviada pela Meta, mas nunca o lançamento financeiro.

RLS restringe a conexão ao proprietário; códigos, mensagens, contextos e limites são exclusivos do backend. `transactions` está na publicação Realtime, com assinatura filtrada por usuário e RLS. Logs não imprimem tokens nem conteúdo financeiro.

Testes: `npm.cmd test`, `node tests/whatsapp-real.mjs` com Vite na porta 4180 e contas QA locais; `npx.cmd playwright test --config playwright.pwa-real.config.mjs` para sessão/cache; `node tests/pwa-install.mjs` com preview na porta 4173 para instalação standalone em perfil Chromium isolado. Testes reais exigem CLI autenticada; as contas e lançamentos QA são identificados, preservados e arquivados, sem excluir usuários.

## Frontend Vercel

Não foi encontrada autenticação Vercel, domínio nem vínculo `.vercel/project.json` neste ambiente. No projeto Vercel existente, configure apenas as variáveis públicas de `.env` (`VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`), build `npm run build`, saída `dist`. Adicione o domínio HTTPS efetivo às URLs de redirecionamento do Supabase Auth. Nenhum projeto/domínio novo foi inventado.
