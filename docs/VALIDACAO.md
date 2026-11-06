# Relatório de validação da entrega

## Resultado

- **Build aprovado:** checagem TypeScript e bundle React/Vite.
- **26 testes aprovados, zero falhas:** 17 de integração e regras, 5 de localização/rede, 1 de SMTP e 3 fluxos React em DOM simulado.
- **17 testes de integração aprovados também em PostgreSQL 18.6 convencional.**
- **Recuperação aprovada:** backup físico com cluster PostgreSQL parado, restauração e reinício preservaram as 51 presenças do cenário de teste.
- **Aplicação real iniciada e verificada via HTTP:** HTML servido, saúde do banco persistente, três eventos de demonstração, autenticação, cookie/sessão, painel autorizado e logout.

Ambiente efetivamente usado: Linux x86_64, Node.js 24.22.1, npm 11.9.0, PostgreSQL 18.6. O projeto está configurado para Node 22.12+; a imagem Docker declara Node 22. Não foi executado um build de imagem Docker neste ambiente.

## Carga sintética

Mesmo cenário de negócio nos dois motores: 500 inscritos, 50 alunos distintos confirmando em paralelo, sem login/bcrypt ou captura de GPS no intervalo medido. A medida inclui HTTP local, validação na API, queries, transação e persistência. Rate limiting é desabilitado somente na instância dos testes de carga; o limitador possui teste próprio.

| Motor | Inscritos | Concorrência | p95 | Maior latência |
|---|---:|---:|---:|---:|
| PGlite persistência de teste | 500 | 50 | 548 ms | 548 ms |
| PostgreSQL 18.6 | 500 | 50 | 160 ms | 160 ms |

Ambos ficaram abaixo da meta inicial de 2 segundos. É um ensaio em uma máquina local, sem latência de internet, TLS, SMTP, celulares ou carga concorrente de outros serviços. O desempenho precisa ser medido novamente na implantação e no piloto. O teste usa pool padrão de PostgreSQL; concorrência HTTP de 50 não significa 50 conexões simultâneas de banco.

Um segundo cenário executou **50 confirmações simultâneas para a mesma pessoa/atividade**: todos os retornos apontaram para o mesmo ID de presença; persistiu uma presença, uma evidência e apenas a carga horária prevista.

## Cobertura executada

- Cadastro público sem privilégios; cookie HttpOnly/SameSite; verificação de e-mail de uso único.
- Login, logout, CSRF, Origin, acesso anônimo e conta sem confirmação.
- Rascunho oculto, publicação somente com atividade e horários válidos.
- Organizador sem vínculo bloqueado em evento, inscritos, regras, QR e relatórios.
- Inscrição idempotente em dez solicitações simultâneas; período encerrado bloqueado.
- Leitura/GET sem presença; QR com token no fragmento e hash no banco.
- Aluno não inscrito, coordenadas ausentes/inválidas, precisão negativa e captura antiga recusados.
- QR inválido, expirado, revogado, atividade fechada e janela encerrada recusados.
- Repetições sem horas adicionais; cliente não escolhe usuário ou minutos.
- Mudança da carga horária preserva os minutos anteriormente creditados.
- Consulta de situação recupera registro persistido e não permite consultar outro aluno por query string.
- CSV com fórmulas neutralizadas e sem coordenadas; estatísticas distinguem pessoas e check-ins.
- Recuperação de senha com token expirado/uso único e invalidação de sessões.
- Encerramento preserva histórico e bloqueia reabertura.
- Retenção remove coordenadas vencidas e preserva presenças/minutos.
- Rate limiting separa os endereços de e-mail da mesma rede.
- Captura de localização com `maximumAge: 0`, preferência de alta precisão e timeout de 20 s.
- Permissão negada, timeout, indisponibilidade, contexto inseguro e falha de transporte com orientações específicas.
- SMTP exercitado contra servidor local de teste: entrega do destinatário e link de confirmação, incluindo codificação MIME.
- React em JSDOM: explorar → detalhes → login com retorno → inscrição → histórico; busca/estado vazio/404; recusa de localização sem escrita; perda de resposta sem sucesso antecipado e posterior recuperação do registro.

## Evidências e reprodução

Execute `npm run build`, `npm test` e `npm run test:postgres`. O último cria e remove uma instância PostgreSQL de teste em `work/`. Os logs desta execução e métricas estão em `docs/evidencias/`. A pasta `work/` não faz parte da entrega por conter arquivos temporários e potenciais tokens de desenvolvimento.

Os testes usam banco isolado e não dependem de `DATABASE_URL` da aplicação; uma instância externa de teste só é usada quando `TEST_DATABASE_URL` é definida explicitamente. Nunca aponte essa variável para produção.

## Verificações ainda dependentes do ambiente real

Não foi possível executar a automação visual do navegador disponibilizada pelo ambiente; não havia ferramenta `cua_repl.js` disponível. Os testes de UI descritos acima são de DOM simulado, não de navegador real.

Ainda precisam de execução presencial: leitura pela câmera nativa, GPS e permissões em Android/Chrome e iPhone/Safari reais; legibilidade do projetor; precisão em salas; acessibilidade e responsividade em aparelhos reais; usabilidade com participantes e métricas do tempo total. O CSS cobre larguras de celular, tablet e desktop, mas isso não foi apresentado como validação em dispositivos físicos.

Docker/Compose foram entregues, mas o acesso ao socket do daemon foi negado pelo ambiente. Backend, PostgreSQL e recuperação foram executados diretamente, sem Docker. Scripts `pg_dump`/`pg_restore` do Compose não foram executados; o teste de recuperação aprovado utilizou cópia física com PostgreSQL parado.

SMTP real de produção, domínio/TLS e política institucional de dados dependem da configuração da implantação. A entrega não contém resultados fictícios de piloto, nem comprovação absoluta de presença física. Consulte `PILOTO.md` para o roteiro restante.
