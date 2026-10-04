# Finalização — 03/10/2026

## WhatsApp

Causa: o WAHA NOWEB 2026.9.1 retorna o identificador do envio em `key.id`. O adaptador aceitava somente `id`/`id._serialized`, lançava erro depois do envio efetivo e recolocava a resposta em pending. O cron de retries, executado a cada minuto, repetia a resposta. As mensagens recebidas tinham uma tentativa de processamento, mas suas respostas antigas apresentavam até quatro tentativas sem confirmação persistida.

Correção publicada: reconhecimento de `key.id`; sucesso termina em sent; falha de persistência após envio não vira reenvio; timeout/resultado incerto e lease vencido ficam em unknown para reconciliação, sem retry cego. Apenas recusa temporária explícita (429) permite até três tentativas com backoff. A migração aditiva acrescenta datas de tentativa/entrega e preserva histórico. O filtro de mensagens próprias também reconhece indicadores equivalentes e remetente igual ao bot. Eventos não suportados permanecem ignorados.

Validação real, conta QA separada: vínculo, oi e despesa de teste tiveram uma resposta cada, todas sent com delivery_attempts=1. Uma única despesa foi criada. O webhook original da despesa foi reenviado três vezes: registros, transação, data de entrega e tentativas permaneceram idênticos. O histórico WAHA confirmou três respostas distintas desde o vínculo QA e nenhum envio posterior por mais de 47 horas. Não foram enviadas mensagens adicionais para executar o replay.

Testes automatizados: duplicidade, fromMe, isolamento A/B, idempotência financeira, limite de retries, timeout incerto e falha de gravação após aceitação passaram. Os 15 testes de código/SQL e seis testes de interface/PWA passaram. Contagens e hashes de usuários e dados financeiros foram preservados na aplicação da migração. RLS permanece ativo.

## PWA e publicação

Produção: https://financerto-nexora.netlify.app

Deploy validado: `6ac1adddc6b8f9cc3d56f43e`.

Manifesto standalone, nome, escopo, cores e ícones 192/512 verificados. Metadados iOS e apple-touch-icon configurados. Rotas diretas dashboard/perfil/transacoes/metas/relatorios retornam 200 e a navegação aceita o pathname. Testes de 360x800, 390x844, 412x915 e 430x932 sem overflow passaram, além dos demais tamanhos existentes.

Login de produção, F5, reabertura da sessão, shell offline, service worker e ausência de dados Supabase no cache passaram. Instalação e standalone em aparelhos físicos Android/iPhone não foram observados nesta execução; configuração pronta, validação física ainda cabe ao proprietário.

Variáveis públicas Netlify: `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`. `VITE_SUPABASE_ANON_KEY` é alternativa suportada, não é necessária junto da publishable key. Nenhum segredo WAHA/service_role foi adicionado ao frontend ou ao Git.

A publicação final usou a API oficial Netlify com o build já validado e regras de redirects/headers derivadas do netlify.toml, após a CLI ficar sem progresso. HTTPS, manifest, SW e cache headers foram conferidos. A hospedagem WAHA permanece no Railway, com crédito temporário e sem contratação paga; não há garantia de custo zero permanente.

Deploy contínuo: repositório GitHub e branch main foram configurados no site. O build remoto falhou ao clonar com `Host key verification failed`; a publicação manual validada permanece ativa. Builds automáticos foram pausados para evitar consumo em novas tentativas. É necessário reautorizar/reconectar o GitHub no painel Netlify e então retomar builds. Não considerar push como deploy automático até essa conexão ser validada.
