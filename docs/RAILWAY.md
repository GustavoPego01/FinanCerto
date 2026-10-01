# WAHA do FinanCerto no Railway

Implantado em 29/09/2026, em conta exclusiva do proprietário. A conta e os projetos do cliente de barbearia não foram usados.

## Recursos publicados

- Projeto: `2e48597d-a808-4e04-8b24-98f04964f8ea` (FinanCerto).
- Ambiente: `3b130a10-386c-4d72-bb24-1d9bd4bdf303` (production).
- Serviço: `58c7000b-6663-41c4-92c9-e0c8d138b840` (waha).
- API: `https://waha-production-c111.up.railway.app`.
- Imagem: `devlikeapro/waha:noweb-2026.9.1`.
- Digest observado: `sha256:2e4cbc92b16f82da330f8324064e0877e142b81224585938b2314c1d6c90774d`.
- Volume persistente de 500 MB em `/app/.sessions`.
- Uma réplica, sem suspensão por inatividade, reinício em falha (até dez tentativas).

As variáveis `WAHA_DASHBOARD_ENABLED`, `WHATSAPP_SWAGGER_ENABLED` e `WAHA_PRINT_QR` estão em `false`; `WHATSAPP_DEFAULT_ENGINE=NOWEB`, `WAHA_LOG_LEVEL=warn` e `PORT=3000`. A API exige uma chave aleatória exclusiva de 32 bytes. Os segredos estão no serviço e no arquivo local ignorado `.cache/whatsapp-waha.env`, nunca no frontend ou no Git.

## Validação realizada

- Railway: implantação `SUCCESS`, instância `RUNNING`, volume `READY`.
- `GET /api/sessions` sem chave: 401.
- O mesmo endpoint com chave: 200, nenhuma sessão conectada.
- `GET /api/server/version` autenticado: 2026.9.1, NOWEB, linux/x64.
- `/dashboard` e `/swagger`: 404.

Estes testes comprovam a disponibilidade e proteção da API. Em 01/10/2026 UTC, o backend Supabase foi publicado e a sessão `default` criada com webhook HMAC. O webhook recebeu eventos autenticados; a sessão aguarda leitura do QR pelo proprietário. Não há validação de mensagens reais de ponta a ponta ainda.

## Custo e continuidade

Na criação, a conta tinha US$ 5 de crédito de teste por 30 dias, nenhum cartão e nenhuma assinatura de consumo ativa. Não foi contratado plano pago. Esse crédito é temporário: a implantação não representa garantia de hospedagem gratuita permanente.

A tentativa de limitar o consumo a US$ 1 foi rejeitada pelo Railway: o limite rígido aceita zero ou pelo menos US$ 10. Nenhum limite foi aplicado. Antes de qualquer mudança de plano ou inclusão de pagamento, é necessária autorização específica do proprietário, cuja restrição permanece custo zero.

## Operação

Confirme a conta com `npx.cmd --yes @railway/cli whoami --json` antes de operar. Use o projeto e serviço acima explicitamente quando houver dúvida de vínculo. Não remova o volume: ele preserva as credenciais da sessão.

O acesso ao Supabase **fzqstnkrklgficdurqsd** foi confirmado e os preflights de [WHATSAPP-WAHA.md](WHATSAPP-WAHA.md) executados. Somente a migração `202609290001_waha_provider.sql` estava pendente e foi aplicada. Contagens e hashes de `auth.users`, `profiles`, `transactions`, `goals` e `user_financial_profiles` permaneceram idênticos imediatamente após a migração. As evidências estão em `.cache/waha-fingerprints-before.json` e `.cache/waha-fingerprints-after.json`, fora do Git.

As funções `whatsapp-webhook`, `whatsapp-worker`, `whatsapp-link` e `whatsapp-admin` foram publicadas. As quatro retornam 401 em chamadas sem autenticação. O cron `financerto-whatsapp-retry` permanece ativo a cada minuto; seu segredo foi preservado. A URL principal do Auth agora é `https://financerto-nexora.netlify.app`, com redirecionamentos de produção e endereços locais existentes preservados. Os 15 testes automatizados e o teste PWA no site de produção passaram.

Para concluir, obtenha um QR atualizado com o script administrativo e conecte o aparelho destinado ao FinanCerto. Após o status `WORKING`, confirme o número empresarial e faça o teste de vínculo e mensagem pelo usuário, sem usar dados financeiros reais como massa de teste. Nenhum projeto da barbearia foi alterado.
