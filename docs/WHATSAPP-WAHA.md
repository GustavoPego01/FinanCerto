# FinanCerto — WhatsApp com WAHA

## Arquitetura

WhatsApp → WAHA persistente → Edge Function `whatsapp-webhook` → inbox SQL → parser pt-BR → serviços financeiros → Supabase → Realtime → Dashboard/PWA. A resposta fica no outbox da própria `whatsapp_messages`, independente do lançamento; `whatsapp-worker` processa/reenvia com leases e backoff. Não há IA paga nem processo persistente na Netlify.

`supabase/functions/_shared/providers/` contém a interface de transporte (`sendText`, `sendMessage`, `getSessionStatus`, `normalizeIncomingMessage`, `getSenderId`, `getMessageId`) e implementações WAHA/Meta. Credenciais e chamadas ao gateway ficam exclusivamente no backend. `WHATSAPP_PROVIDER` seleciona o transporte; o padrão novo é `waha`.

As tabelas de vínculo, códigos, inbox/outbox e contexto foram reutilizadas. A migration `202609290001_waha_provider.sql` acrescenta identificação do provider e saúde operacional, limita envios e publica alterações de vínculo no Realtime. Mensagens antigas permanecem `meta`. IDs WAHA usam `waha:<sessão>:<id>`, mantendo a constraint UNIQUE existente. A migration não apaga ou recria dados financeiros.

## Pré-requisitos e ordem de implantação

1. Acesso administrativo ao projeto Supabase existente, **fzqstnkrklgficdurqsd**. Não crie outro projeto nem use `db reset`.
2. Servidor Linux persistente com Docker Compose, volume protegido e domínio HTTPS para WAHA. Frontend continua na Netlify.
3. Um número empresarial e seu aparelho para escanear o QR.
4. Antes da atualização remota, execute `supabase/preflight.sql` e `supabase/waha-audit.sql` e registre contagens/hashes de Auth, profiles, transactions, goals e demais dados históricos em armazenamento privado. Repita depois, considerando alterações legítimas concorrentes (por exemplo, login muda timestamps do Auth). Não use dados reais para testes.
5. Confira `npx.cmd supabase migration list --linked`, depois `npx.cmd supabase db push --linked --dry-run`. Aplique somente após confirmar o histórico: `npx.cmd supabase db push --linked`.
6. Configure os secrets antes de ativar o transporte; publique as quatro funções abaixo. O cron de retries e seu segredo existentes devem ser preservados.

```powershell
npx.cmd supabase secrets set --env-file .cache/whatsapp-waha.env
npx.cmd supabase functions deploy whatsapp-webhook --use-api
npx.cmd supabase functions deploy whatsapp-worker --use-api
npx.cmd supabase functions deploy whatsapp-link --use-api
npx.cmd supabase functions deploy whatsapp-admin --use-api
```

O arquivo privado de secrets deve conter somente variáveis do backend, conforme `supabase/functions/.env.example`. Não sobrescreva secrets existentes com campos vazios. `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` são fornecidos pelo runtime Supabase. Nunca envie `service_role`, API key do WAHA, HMAC ou credencial administrativa à Netlify/React.

## Variáveis

| Variável | Uso |
| --- | --- |
| `WHATSAPP_PROVIDER` | `waha`; `meta` para o transporte anterior |
| `WAHA_BASE_URL` | URL HTTPS do gateway alcançável pelas Edge Functions |
| `WAHA_API_KEY` | Chave forte e exclusiva, igual no container e no backend |
| `WAHA_SESSION` | `default` para uma sessão; mantenha estável após ativar |
| `WAHA_WEBHOOK_SECRET` | Segredo aleatório do HMAC, configurado ao criar a sessão |
| `WHATSAPP_ADMIN_SECRET` | Credencial independente para operação administrativa |
| `WHATSAPP_BUSINESS_PHONE` | Número empresarial internacional, só dígitos; atendimento FinanCerto: 5562981833142 |
| `WHATSAPP_WORKER_SECRET` | Preserve o valor já usado pelo cron/Vault |
| `WAHA_IMAGE` | Imagem `devlikeapro/waha` com tag/digest fixo, validado no servidor |
| `WAHA_PORT` | Porta local do host; padrão 3000 |

Os exemplos `.env.example`, `.env.waha.example` e `supabase/functions/.env.example` não contêm credenciais. Gere segredos independentes com pelo menos 32 bytes aleatórios. `VITE_` é reservado à URL/chave pública Supabase.

## Docker local e produção

Copie `.env.waha.example` para `.env.waha`, preencha as variáveis do container e escolha uma versão fixada compatível com os endpoints documentados. A versão real da instância ainda precisa de validação, pois nenhuma instância WAHA foi conectada durante esta implementação.

```powershell
docker compose --env-file .env.waha -f docker-compose.waha.yml config --quiet
docker compose --env-file .env.waha -f docker-compose.waha.yml up -d
docker compose --env-file .env.waha -f docker-compose.waha.yml ps
```

O compose usa NOWEB, volume nomeado `waha_sessions` em `/app/.sessions`, reinício `unless-stopped`, healthcheck autenticado e logs rotativos. A porta só escuta em `127.0.0.1:3000`; dashboard e Swagger públicos estão desativados. O armazenamento de mapeamentos LID é habilitado ao criar a sessão.

Em produção, publique a API por um proxy HTTPS do servidor, preservando `X-Api-Key`, sem logar headers/corpos. Configure `WAHA_BASE_URL` com esse domínio. **O localhost da Edge Function não é o servidor Docker.** Para desenvolvimento remoto, use um túnel HTTPS protegido. O webhook é a URL pública do Supabase, alcançável pelo container; não use o endereço local do frontend. Faça backup do volume criptografado e restrinja acesso. Não use `docker compose down -v`, que removeria a sessão.

## Sessão empresarial e QR

### HTTPS no servidor novo

O override `docker-compose.waha.production.yml` fornece proxy Caddy com certificados e renovação automáticos. Use um servidor exclusivo com Linux, Docker Compose, pelo menos 2 vCPU e 4 GB de RAM. Aponte o registro DNS de `WAHA_DOMAIN` para esse servidor e libere as portas 80/443. Mantenha a API WAHA na porta 3000 restrita ao loopback.

**Restrição do proprietário: somente serviços gratuitos.** A opção pesquisada é Oracle Cloud Always Free, `VM.Standard.A1.Flex`, Ubuntu ARM, 2 OCPUs, 4 GB de RAM e volume de boot de 50 GB, desde que todos os recursos estejam dentro da franquia disponível da conta e região principal. A documentação consultada em 29/09/2026 informa 2 OCPUs/12 GB totais para contas Always Free. Não usar recursos pagos, créditos temporários como substituto da franquia permanente ou upgrade Pay As You Go. A Oracle pode não ter capacidade disponível e pode retomar instâncias ociosas; não é garantia de disponibilidade contínua. A conta e o servidor ainda não foram criados nesta execução.

Para essa VM ARM, usar imagem WAHA `devlikeapro/waha:noweb-arm-<versão>` ou digest ARM64 validado, não a imagem x86. Referências: [Oracle Always Free](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm), [imagens WAHA](https://waha.devlike.pro/docs/how-to/engines/), [Caddy em Docker](https://caddyserver.com/docs/running#docker-compose).

Preencha `CADDY_IMAGE` com tag/digest fixo da imagem oficial `caddy`, `WAHA_DOMAIN` com o hostname (sem protocolo/caminho) e `TLS_EMAIL` com o contato dos certificados. Configure `WAHA_BASE_URL=https://<WAHA_DOMAIN>` no Supabase. Nenhuma contratação de servidor foi feita por este arquivo.

```sh
docker compose --env-file .env.waha -f docker-compose.waha.yml -f docker-compose.waha.production.yml config --quiet
docker compose --env-file .env.waha -f docker-compose.waha.yml -f docker-compose.waha.production.yml up -d
docker compose --env-file .env.waha -f docker-compose.waha.yml -f docker-compose.waha.production.yml ps
```

Não compartilhe a saída de `docker compose config` sem `--quiet`, pois ela contém variáveis resolvidas. Preserve os volumes `waha_sessions`, `waha_tls_data` e `waha_tls_config` nas reinicializações. O proxy não configura logs de acesso com headers/corpos das mensagens. A contratação e a validação real de TLS dependem do servidor e DNS disponíveis.

Inclua `SUPABASE_URL` e `WHATSAPP_ADMIN_SECRET` em um arquivo privado, por exemplo `.cache/whatsapp-admin.env`. O script abaixo não imprime credenciais.

```powershell
node --env-file=.cache/whatsapp-admin.env scripts/whatsapp-admin.mjs health
node --env-file=.cache/whatsapp-admin.env scripts/whatsapp-admin.mjs create
node --env-file=.cache/whatsapp-admin.env scripts/whatsapp-admin.mjs qr
```

`create` cria/inicia a sessão e configura webhook HMAC para `message` e `session.status`. O QR é salvo em `.cache/waha-qr.png`; abra-o localmente e escaneie em **Aparelhos conectados** no WhatsApp empresarial. QR e volume são sensíveis. Aguarde `WORKING`/`ONLINE` no health.

Para sessão já existente, confira sua configuração de webhook antes de usar `start`. Não duplique webhook global e por sessão. O comando `reconnect` só reinicia sessões paradas/com falha; `STARTING` e `SCAN_QR_CODE` aguardam. As tentativas têm cooldown persistente de 30, 60, 120, 240, 480 e 960 segundos e param após seis solicitações. `health` com sessão `WORKING` zera o contador. Após seis falhas, inspecione a causa e recupere a sessão pelo operador WAHA; não há loop automático de reinício.

O endpoint `POST /functions/v1/whatsapp-admin` exige `Authorization: Bearer <WHATSAPP_ADMIN_SECRET>` e recebe `{ "action": "health|create|start|reconnect|qr" }`. Usuários comuns não recebem acesso. `health` distingue WAHA online/offline/iniciando/erro, disponibilidade do banco e último webhook autenticado. `UNVERIFIED` significa que nenhum evento foi observado; a data do último webhook não prova disponibilidade atual em uma conversa silenciosa.

## Vínculo e comandos

No Perfil, **Gerar código de vínculo** → enviar `VINCULAR <código>` ao número empresarial. O código atual tem 12 caracteres aleatórios, hash SHA-256, validade de dez minutos e uso único. O backend usa o remetente autenticado pelo gateway; não aceita `user_id` da mensagem. O número do usuário aparece mascarado. Desconectar revoga somente o vínculo daquela conta; não para a sessão empresarial.

- Despesas: `Gastei 45 no almoço`, `paguei 89,90 de gasolina`, `120 mercado`, `comprei 35 de remédio`.
- Receitas: `Recebi 3000 de salário`, `entrou 850 de venda`, `recebi 500`, `ganhei 200`, `caiu 1200 de pagamento`.
- Consultas: `saldo`, `quanto tenho?`, `gastos do mês`, `receitas do mês`, `quanto gastei com alimentação?`, `últimos lançamentos`, `meu score`, `metas`.
- Contexto: `Gastei no mercado` → `150`. Expira após dez minutos, isolado por usuário e versão do vínculo. `cancelar` encerra o contexto.

Valores brasileiros são normalizados; categorias reutilizam as do app. Novos lançamentos usam a data atual em `America/Sao_Paulo`. Despesas sem descrição pedem esclarecimento; receitas sem descrição usam `Receita`/`Outros`. Múltiplos valores/períodos ambíguos pedem esclarecimento. Edição/exclusão continuam no aplicativo.

## Segurança, filas e limitações

O webhook verifica HMAC **SHA-512 nos bytes originais** usando `X-Webhook-Hmac`/`X-Webhook-Hmac-Algorithm`, limita corpo a 256 KiB e texto a 1000 caracteres. Ignora grupos, status, eco do bot, mídia e sessão errada. `@lid` só vira telefone mediante consulta autenticada ao WAHA; ausência de mapeamento retorna 503 para retry, sem vincular um identificador opaco à conta.

RLS e funções privilegiadas permanecem restritos. Enqueue recusa mensagens com mais de 24h ou mais de cinco minutos no futuro. Duplicatas usam o ID persistido UNIQUE. Entrada: 20 mensagens/minuto/remetente. Saída: 10/minuto/remetente e 30/minuto/global. O worker assinado continua a cada minuto; processamento tem no máximo cinco tentativas e envio oito, com backoff e leases. Desconexão cancela respostas pendentes do usuário.

Uma falha de envio nunca refaz o lançamento. Se o gateway entregar uma resposta e a conexão cair antes do acknowledgement, um retry pode repetir **a confirmação**; o endpoint WAHA `sendText` não fornece garantia documentada de envio exatamente uma vez. As tentativas são limitadas; a transação continua única. A fila expira em 24h e o envio após 23h é cancelado, preservando a política anterior. Não há disparo em massa.

## Verificação e diagnóstico

```powershell
npm.cmd test
npm.cmd run lint
npm.cmd run build
npm.cmd run test:runtime
npm.cmd run check:supabase
```

`tests/waha.test.mjs` verifica assinatura/endpoint HTTP, rejeição de mensagens inválidas, transporte, LID, parser e integração com PostgreSQL local (PGlite), incluindo vínculo A/B, RLS, deduplicação, consultas, contexto, falha de gateway/reenvio, desconexão e backoff administrativo. A migration é aplicada duas vezes para testar repetibilidade e os valores históricos são comparados.

- **403 na CLI Supabase:** autentique uma conta com acesso administrativo ao projeto existente. Não é falha do parser ou da API pública.
- **401 no webhook:** confirme segredo HMAC, algoritmo SHA-512 e proxy sem alteração do corpo.
- **503 no webhook:** confira secrets, migration, conexão ao banco e mapeamento LID; o WAHA deve reenviar.
- **429 administrativo:** respeite `nextSessionAttemptAt`; após seis tentativas, investigue o servidor.
- **QR indisponível:** precisa de `SCAN_QR_CODE`; obtenha outro QR quando expirar.
- **Lançamento salvo, resposta pendente:** confira WAHA, cron `financerto-whatsapp-retry`, Vault `financerto_whatsapp_worker` e `WHATSAPP_WORKER_SECRET`, sem reenviar a operação financeira.
- **Dashboard sem atualização:** confira publicação Realtime de `transactions`, autenticação e conexão WebSocket.

Para voltar à Meta, mantenha a migration, configure os secrets Meta existentes e `WHATSAPP_PROVIDER=meta`. Valide o webhook Meta e deixe a fila WAHA inativa. Não apague a sessão nem as filas para mudar o transporte.

## Referências do contrato WAHA

- [Eventos e HMAC](https://waha.devlike.pro/docs/how-to/events/)
- [Sessões, persistência e QR](https://waha.devlike.pro/docs/how-to/sessions/)
- [Envio de texto](https://waha.devlike.pro/docs/how-to/send-messages/)
- [Mapeamento LID/telefone](https://waha.devlike.pro/docs/how-to/contacts/)

Consulte `docs/WHATSAPP-VALIDACAO.md` para separar verificações executadas de etapas remotas pendentes.
