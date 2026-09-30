# Validação desta entrega — 29/09/2026

## Executado

| Verificação | Resultado |
| --- | --- |
| Git antes das mudanças | Árvore limpa; implementação anterior preservada |
| Suíte anterior, lint e build antes de editar | 10 testes passaram; lint/build passaram |
| Suíte final de código/SQL | 15 testes passaram |
| Interface simulada | 5 testes passaram: login/logout, sessão, operações, navegação, responsividade e PWA |
| Lint, build e Git diff | Passaram, sem erros de lint, compilação ou whitespace |
| Banco de integração | PostgreSQL local via PGlite, com migrations reais; não é o Supabase remoto |
| Vínculo A/B | Dois telefones vinculados a duas contas; uso único/expiração/replay e isolamento testados |
| Lançamentos e consultas | Receita, despesa, saldo, mês, categoria, últimas transações, score e metas |
| Idempotência | Cinco reenvios da mesma mensagem, retry após transação salva e falha no fechamento do processamento, retry de envio com WAHA simulado offline |
| Contexto e segurança | Contexto por usuário, expiração, número não vinculado, desconexão, HMAC adulterado, corpo excessivo, eco, grupos e sessão errada |
| Transporte | Fetch simulado para envio, lifecycle/QR e resolução LID; nenhum WhatsApp real enviado |
| Migration | Aplicada duas vezes localmente; registros históricos de teste preservados; RLS e acesso administrativo restritos |
| Reconexão | Cooldown persistente e limite de seis solicitações testados |
| Edge Functions | `deno check` passou nas quatro funções |
| Docker Compose | `config --quiet` passou com valores fictícios; nenhum container iniciado |
| PWA real com conta QA existente | Login, F5, fechar/reabrir, service worker, cache sem dados privados, offline/online passaram |
| Supabase público | DNS/Auth disponíveis; tabelas privadas exigem autenticação |
| Bundle | Nenhum dos segredos de backend locais conhecidos, nomes de secrets WAHA ou código do provider encontrado no build |
| Design | Nenhuma alteração nos estilos, Dashboard, navegação, login, cadastro ou demais telas; apenas o componente WhatsApp do Perfil foi ajustado |

O teste antigo do PWA verificava a presença do formulário antes de a sessão terminar de carregar. Ele foi corrigido para aguardar o formulário ou o Dashboard e passou na repetição. A suíte de interface simulada também passou a interceptar a Edge Function de status WhatsApp, evitando uma chamada externa acidental no teste isolado.

## Pendente de infraestrutura/acesso

1. **Supabase administrativo:** a CLI retornou `403 — Your account does not have the necessary privileges`. A API pública funciona, mas a conta administrativa conectada precisa de acesso ao projeto existente `fzqstnkrklgficdurqsd`.
2. **Auditoria remota antes/depois:** contagens/hashes globais de Auth, profiles, transactions e metas não puderam ser consultados nesta sessão sem esse acesso. Nenhuma migration remota ou alteração financeira de produção foi executada. O SQL de auditoria foi preparado.
3. **Implantação do backend:** aplicar a migration aditiva, configurar secrets e publicar as quatro Edge Functions. O frontend atualizado já foi publicado na Netlify; veja [NETLIFY.md](NETLIFY.md).
4. **WAHA:** disponibilizar servidor Docker persistente, domínio HTTPS, versão fixada, API key, sessão e segredo HMAC. O daemon Docker local não estava ativo; não houve teste de execução da imagem.
5. **Aparelho empresarial:** escanear o QR. Esta etapa depende do WhatsApp conectado ao número real.
6. **Aceite ponta a ponta:** enviar mensagens de duas contas QA pelo WhatsApp real e conferir respostas, isolamento, Realtime sem F5 e recuperação após reinício do container. O Realtime existente foi preservado, mas o percurso WAHA real → Supabase remoto → Dashboard não foi executado.

Não considerar esta entrega como WAHA já ativo em produção. Código, migration, configuração Docker e operação administrativa estão preparados; os testes locais e o teste real do PWA não substituem a ativação do gateway.

Procedimento: [WHATSAPP-WAHA.md](WHATSAPP-WAHA.md).
