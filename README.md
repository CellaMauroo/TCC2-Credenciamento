# Credencia

Sistema web mobile first de inscrições e presença em eventos acadêmicos. React 19 + TypeScript no frontend; Express 5 + Node.js no backend; PostgreSQL, migrations SQL e sessões em cookies HttpOnly.

O **plano .md prevalece sobre o TCC1**. O PDF foi usado somente como contexto. O sistema faz inscrição → leitura do QR da atividade → captura pontual de localização → presença persistida → histórico e relatório da organização. Um check-in concede toda a carga horária prevista. Não há check-out, certificado, Flutter, operação offline ou sincronização.

## Executar em poucos minutos

Requer Node.js 22.12+ e npm. O primeiro modo não precisa de Docker nem instalar PostgreSQL separadamente: usa o motor PostgreSQL embarcado PGlite, persistente em `data/`. O mesmo SQL é usado no servidor PostgreSQL convencional.

```sh
npm ci
cp .env.example .env
npm run build
npm run seed
npm start
```

Abra **http://localhost:3000**. O Express serve React e API no mesmo domínio. A demonstração cria eventos relativos ao momento do seed, sem presenças fictícias. A primeira atividade tem entrada aberta para experimentar o fluxo.

| Perfil de demonstração | E-mail | Senha |
|---|---|---|
| Organizador | organizador@demo.local | gerada por `npm run seed` |
| Aluno | aluno@demo.local | gerada por `npm run seed` |

Essas contas são criadas somente por `npm run seed`, que é bloqueado em produção. A demonstração preserva os eventos já criados. A cada execução, o comando gera uma nova senha aleatória para ambas as contas e a mostra somente no terminal. As datas não se renovam automaticamente: crie outro evento pelo painel quando necessário.

1. Entre como aluno, abra o primeiro evento e inscreva-se.
2. Em outro navegador/perfil, entre como organizador; abra o evento e clique em **Exibir QR Code** na primeira atividade.
3. Leia o QR com a câmera do celular. Em um teste no mesmo computador, decodifique o QR ou use o link retornado pela API autenticada de QR.
4. Entre como aluno e clique em **Confirmar presença**. Permita uma posição nova.
5. Confira a presença e as horas no histórico; na organização, consulte inscritos, painel e relatório CSV.

**No celular, configure um domínio HTTPS acessível e `APP_ORIGIN` com esse endereço antes de gerar o QR.** `localhost` no celular aponta para o próprio celular. A Geolocation API não funciona por HTTP em IP de rede comum. O endereço local é adequado ao desenvolvimento no mesmo computador.

## Desenvolvimento com atualização automática

Após o build inicial, `npm run dev:server` acompanha mudanças da API. Em outro terminal, `npm run dev:client` inicia Vite em 5173 e encaminha `/api` para 3000. Nesse modo configure `APP_ORIGIN=http://localhost:5173` no backend; os links de e-mail e QR devem apontar ao frontend.

## Cadastro, e-mail e organizadores

O cadastro público sempre cria aluno. Nome e e-mail são obrigatórios; matrícula é opcional. Senha com pelo menos 10 caracteres e até 72 bytes UTF-8. O aluno precisa confirmar o e-mail para se inscrever ou registrar presença.

Sem SMTP no desenvolvimento, os e-mails são gravados em **`work/mailbox.jsonl`**, somente no servidor, com acesso restrito. Abra o link contido nesse arquivo. Nenhum token é retornado pela API de cadastro ou recuperação. Em produção, configure SMTP real. A interface não expõe caixa de e-mails de desenvolvimento.

Depois de cadastrar e confirmar a conta que vai organizar:

```sh
npm run admin -- pessoa@instituicao.edu.br
```

Esse comando exige acesso técnico ao ambiente. O vínculo de organização por evento continua obrigatório; outro organizador não acessa eventos alheios. Conceder o perfil não confirma automaticamente o e-mail. O comando registra auditoria administrativa com o usuário do sistema operacional como contexto técnico, sem inventar um ator humano autenticado.

## PostgreSQL convencional e Docker

Defina `DATABASE_URL=postgresql://usuario:senha@host:5432/credencia`. O servidor aplica a migration idempotente na inicialização; também existe `npm run db:migrate`.

Para executar a composição local, copie `.env.example` para `.env`, defina `POSTGRES_PASSWORD` (prefira caracteres seguros para URL ou codifique-os na conexão) e mantenha `NODE_ENV=development`:

```sh
docker compose up --build -d
docker compose exec app npm run seed
```

Aplicação: http://localhost:3000. E-mails de desenvolvimento: http://localhost:8025 (Mailpit). O PostgreSQL não é exposto em porta pública e usa volume persistente. Nunca execute `docker compose down -v` para reiniciar uma instalação com dados que precisam ser preservados.

Para produção: use PostgreSQL convencional, `NODE_ENV=production`, SMTP real, `MAIL_FROM` válido e `APP_ORIGIN=https://seu-dominio`. O servidor recusa produção sem esses requisitos. Coloque a aplicação atrás de um proxy HTTPS e configure `TRUST_PROXY=1` somente quando houver exatamente um proxy confiável. Cookies recebem `Secure` em produção. A composição é uma base local; certificados TLS, domínio, backups externos e SMTP dependem do ambiente de implantação.

Em um ambiente com proxy corporativo que precise de CA adicional, o Dockerfile aceita `docker build --secret id=proxy_ca,src=/caminho/ca.pem -t credencia .`. A CA é montada somente no passo de instalação e não entra na imagem.

## Testar

```sh
npm run build         # TypeScript + bundle React
npm test              # integração, localização e fluxos React em DOM simulado
npm run test:postgres # mesmos testes de integração no PostgreSQL real + recuperação
```

`test:postgres` sobe temporariamente PostgreSQL 18 em 55432 dentro de `work/`, sem Docker. Requer a dependência opcional de binários compatível com a plataforma; em Linux, execute como usuário comum. Todos os dados de teste são isolados. O teste também faz cópia física com cluster parado, restaura e verifica presenças após reinício.

Os testes HTTP precisam de permissão para abrir sockets locais. Os testes de carga usam 500 inscritos e 50 solicitações simultâneas. O resultado é um benchmark sintético local, não uma promessa de desempenho em produção. Consulte [os resultados e limites](docs/VALIDACAO.md).

## Dados, backups e retenção

Em PGlite, pare o backend antes de copiar `data/` para backup; restaure a cópia com o backend parado. Não compartilhe o diretório ou o arquivo de e-mails.

No PostgreSQL do Compose:

```sh
sh scripts/backup.sh /diretorio-restrito/credencia.dump
sh scripts/restore.sh /diretorio-restrito/credencia.dump validacao_backup
```

A restauração usa uma **base nova**, sem sobrescrever `credencia`. Valide contagens de presenças e minutos antes de promover uma restauração. Os scripts do Compose estão entregues, mas a execução do Docker foi limitada pelo ambiente desta implementação; o teste automatizado de recuperação usou PostgreSQL executado diretamente.

A captura de localização é obrigatória, pontual e não aplica bloqueio por raio. Coordenadas ficam em tabela separada, sem endpoint comum de leitura e sem inclusão no CSV. Antes de dados reais, a instituição deve documentar responsável, finalidade, base legal, acesso, canal de solicitações e prazo de retenção. Não foi inventado um prazo jurídico no produto.

Quando a política estiver definida, configure `LOCATION_RETENTION_DAYS` e execute periodicamente:

```sh
npm run privacy:purge
```

O comando remove somente evidências vencidas de localização, preservando presenças e horas; sem prazo explícito ele recusa executar. O agendamento é operacional, por cron ou mecanismo equivalente da implantação.

## Organização do código

- `src/`: aplicação React, navegação mobile first e integração com API.
- `server/modules/`: autenticação, eventos/inscrições, check-in, organização e relatórios.
- `server/schema.sql`: migration inicial com chaves estrangeiras, validações e unicidades.
- `server/db.ts`: adaptadores PostgreSQL/PGlite e transações.
- `tests/`: testes de regras de negócio, segurança, concorrência, localização e DOM React.
- `docs/`: decisões, arquitetura, rastreabilidade, implantação e avaliação do TCC2.

[Decisões adotadas](docs/DECISOES.md) · [Arquitetura e API](docs/ARQUITETURA.md) · [Rastreabilidade](docs/REQUISITOS.md) · [Validação](docs/VALIDACAO.md) · [Roteiro do piloto](docs/PILOTO.md).
