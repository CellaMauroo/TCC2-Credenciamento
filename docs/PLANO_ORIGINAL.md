# Plano do TCC2 — Sistema web de inscrições e presença em eventos acadêmicos

Versão 1.0 — planejamento para implementação. Nenhum software foi implementado nesta etapa.

## 1. Objetivo e decisões confirmadas

Desenvolver um sistema web mobile first, com React no frontend e Node.js no backend, para que alunos se inscrevam em eventos acadêmicos e registrem a presença lendo um QR Code exibido no local. O organizador acompanha inscrições, presenças e carga horária atribuída.

| Decisão confirmada pelo autor | Consequência no produto |
|---|---|
| Sistema web mobile first, React e Node.js | Todos os fluxos funcionam pelo navegador, priorizando celular e adaptando-se ao desktop. Flutter não será utilizado. |
| Inscrição feita pelo aluno | O aluno acessa o evento e se inscreve; o organizador consulta os inscritos. |
| Aluno lê o QR exibido no local | O QR identifica a atividade e sua oportunidade de check-in, não um aluno. A conta autenticada identifica quem registra presença. |
| Uma confirmação na entrada concede a carga horária prevista | Não há check-out, cálculo de permanência ou percentual mínimo de duração. |
| Coleta de localização no check-in | Solicitar a posição atual durante a confirmação, após a leitura do QR. |
| Funcionamento 100% online | Presença somente confirmada após persistência no servidor. Sem fila offline ou sincronização posterior. |
| Sem certificados na primeira versão | Não implementar emissão, download, verificação, assinatura ou revogação de certificados. |

O sistema registra comparecimento na entrada. A carga horária atribuída representa a regra adotada pela organização; não é uma medição da permanência física do aluno.

## 2. Escolhas propostas para completar o plano

As seguintes escolhas são recomendações de planejamento, não decisões já aprovadas pelo autor:

- Manter evento como agrupador e atividade como unidade de presença. Um evento simples possui uma única atividade; uma semana acadêmica pode ter várias.
- Inscrição inicial no evento, dando acesso às atividades, sem reservas individuais de vagas nesta versão.
- Dois perfis funcionais: aluno e organizador. Atribuição de organizador controlada pela administração técnica; cadastro público não permite escolher privilégios.
- Autenticação por e-mail e senha, confirmação de e-mail e recuperação de acesso. Nome e matrícula acadêmica complementam o cadastro, sem presumir que um campo autodeclarado comprova identidade institucional.
- PostgreSQL, Express e TypeScript como complementos à stack confirmada. Docker para ambiente reproduzível.
- Relatório CSV, painel de acompanhamento e histórico de horas para o aluno.
- QR renovável durante a janela de check-in, com validade curta. Ponto de partida para teste: 120 segundos; duração final depende do piloto.
- Localização obrigatória para o check-in automático. Sem permissão ou coordenadas utilizáveis, o sistema explica o problema e permite tentar novamente.
- Validação de proximidade é proposta adicional: coletar a localização está confirmado, mas bloquear por distância ainda precisa ser decidido.

Para limitar a primeira versão, não incluir pagamentos, limite de vagas, lista de espera, cadastro completo de palestrantes, login institucional, biometria, geolocalização contínua, integração com sistema acadêmico ou editor de relatórios. Esses itens não são dependências do fluxo principal.

## 3. Perfis e autorização

| Perfil | Ações |
|---|---|
| Aluno | Criar conta, entrar, visualizar eventos publicados, inscrever-se, consultar inscrições, confirmar presença e consultar suas presenças/horas. |
| Organizador | Gerenciar eventos sob sua responsabilidade, criar atividades, acompanhar inscrições, abrir/fechar check-in, exibir QR e consultar/exportar frequência. |

Uma pessoa pode participar como aluno em um evento e organizar outro. Todas as permissões são verificadas no backend por recurso e vínculo com o evento. Alterar um ID na URL não deve permitir acesso a inscrições ou relatórios alheios.

## 4. Fluxo do organizador

1. Entrar no sistema.
2. Criar evento com nome, descrição, período, fuso horário, local e período de inscrição.
3. Criar atividades com título, início/fim e carga horária prevista em minutos.
4. Publicar o evento e compartilhar sua página.
5. Acompanhar os alunos inscritos.
6. No local, abrir o check-in da atividade dentro da janela configurada.
7. Exibir o QR em projetor, TV ou tela. A tela mostra atividade, estado da conexão e validade do código.
8. Acompanhar presenças confirmadas; fechar o check-in no encerramento da entrada.
9. Consultar e exportar os resultados. Encerrar o evento preservando seu histórico.

Se a projeção ficar sem conexão, sinalizar a falha e deixar de mostrar o código como válido após seu vencimento. Não há funcionamento offline para a projeção nem para o aluno.

## 5. Fluxo do aluno

1. Acessar a página pública do evento.
2. Criar conta/entrar e concluir sua inscrição.
3. No local, apontar a câmera nativa do celular para o QR exibido.
4. Abrir o link no navegador. Esta abordagem evita desenvolver um leitor de câmera dentro do site na primeira entrega.
5. Se necessário, autenticar-se e retornar à atividade. Se o código tiver vencido durante o login, solicitar nova leitura.
6. Visualizar atividade e finalidade da coleta de localização; tocar em “Confirmar presença”.
7. Autorizar a localização quando o navegador solicitar. Se já autorizada, obter uma nova posição para essa tentativa.
8. Enviar a confirmação autenticada para a API; o servidor valida e grava a presença.
9. Mostrar sucesso com atividade, horário e carga horária atribuída, ou uma orientação específica de erro.

Abrir o link ou ler o QR, por si só, não grava presença. A confirmação exige autenticação, localização e resposta de sucesso da API. O aluno não deve se deslocar durante o fluxo para que a posição capturada represente o momento da tentativa.

## 6. Localização: captura, uso e limites

Usar a Geolocation API do navegador em HTTPS. Ela depende de autorização do usuário. Obter latitude, longitude, precisão estimada em metros e horário informado pela leitura; guardar também o horário de recebimento definido pelo servidor.

Solicitar uma posição nova, sem reutilizar deliberadamente uma posição antiga em cache; pedir alta precisão como preferência e definir timeout. Alta precisão não é garantia de GPS nem de precisão suficiente em ambientes internos. O backend valida limites numéricos das coordenadas e rejeita dados ausentes ou inválidos. A origem dos dados continua sendo o dispositivo do usuário.

| Situação | Comportamento proposto |
|---|---|
| Permissão negada | Explicar como habilitar a localização e permitir nova tentativa; não confirmar automaticamente. |
| Timeout ou posição indisponível | Informar o problema e permitir tentar novamente. |
| Falta de conexão | Não exibir sucesso; quando reconectar, consultar se a tentativa anterior foi confirmada antes de solicitar outra. |
| Posição disponível | Registrar posição e precisão com a presença; se adotada, executar a regra de proximidade no servidor. |
| Precisão inadequada para a regra de proximidade | Solicitar nova tentativa; não interpretar coordenadas incertas como prova exata da localização. |

### Proposta opcional: bloquear confirmações fora do local

Configurar, por atividade, um ponto central, raio permitido e precisão máxima aceitável. Calcular a distância geográfica no backend. Regra inicial proposta: aceitar somente quando a distância estiver dentro do raio e a precisão informada atender ao limite configurado. Os limites devem ser calibrados no local real; não assumir valores universais para todas as salas ou prédios.

Com a regra habilitada, coordenadas fora do raio geram recusa, e precisão acima do limite gera solicitação de nova captura. A proximidade estimada não distingue necessariamente duas salas próximas. Não somar indiscriminadamente a margem de precisão ao raio, pois isso ampliaria a área aceita justamente nas leituras menos confiáveis.

Localização e QR de curta duração são barreiras contra uso indevido, não prova absoluta de identidade ou presença: o link pode ser compartilhado e coordenadas podem ser manipuladas no cliente. Essa limitação deve constar da avaliação do TCC.

Coletar posição somente no check-in, sem rastreamento contínuo. Limitar acesso às coordenadas e excluí-las do CSV comum. Antes do piloto com dados reais, documentar finalidade, responsáveis, acesso e prazo de retenção; a permissão do navegador não substitui essas definições. Presenças e horas podem ser preservadas após a remoção programada das coordenadas quando a política definida permitir.

## 7. Regras de negócio

| ID | Regra |
|---|---|
| RN01 | Uma inscrição por aluno e evento; repetição retorna a inscrição existente. |
| RN02 | Somente aluno autenticado e inscrito no evento pode confirmar presença em sua atividade. |
| RN03 | QR válido pertence a uma atividade, tem validade temporal e pode ser usado por vários alunos inscritos. Não é consumido pela primeira leitura. |
| RN04 | O check-in exige atividade aberta, janela vigente e token válido conforme horário do servidor. Fechamento invalida novas confirmações imediatamente. |
| RN05 | Uma presença por aluno e atividade, protegida também por restrição única no banco de dados. |
| RN06 | Uma presença confirmada concede integralmente a carga horária prevista da atividade; não exige saída. |
| RN07 | A carga horária fica registrada na presença no momento da confirmação; mudanças posteriores não reescrevem silenciosamente horas já atribuídas. |
| RN08 | O backend determina aluno, atividade e horas. O frontend não escolhe livremente esses valores na requisição. |
| RN09 | Toda confirmação automática exige localização utilizável. Bloqueio por proximidade depende da decisão adicional descrita na seção 6. |
| RN10 | Repetições e requisições simultâneas retornam a presença existente sem somar horas. |
| RN11 | Presenças e eventos com histórico não são apagados fisicamente por operações comuns. |
| RN12 | Sessões simultâneas não devem conceder crédito duplicado pelo mesmo período. Proposta inicial: recusar uma segunda atividade com horário sobreposto a outra já creditada; validar essa regra com a organização antes de ativá-la. |

Proposta para simplificar o MVP: somente atividades sem limite individual de vagas; sem edição arbitrária de horas e sem correção manual de presença na primeira entrega. Durante o piloto, falhas não resolvidas são registradas como ocorrências para análise, sem inventar uma localização ou marcar sucesso. Uma função de correção auditada pode ser priorizada posteriormente se o organizador demonstrar essa necessidade.

## 8. Requisitos funcionais

| ID | Requisito | Critério de aceite resumido |
|---|---|---|
| RF01 | Cadastro e autenticação do aluno | Conta pode entrar, sair, confirmar e-mail e recuperar acesso; aluno não se atribui perfil de organizador. |
| RF02 | Gestão de eventos | Organizador cria e publica seus eventos; outro organizador sem vínculo recebe acesso negado. |
| RF03 | Gestão de atividades | Cada atividade possui evento, horários, janela de check-in e carga horária válida. |
| RF04 | Listagem pública | Visitante visualiza somente eventos publicados e suas informações públicas. |
| RF05 | Inscrição pelo aluno | Aluno se inscreve no período permitido e aparece na lista do organizador. |
| RF06 | Consulta de inscritos | Organizador consulta inscritos apenas nos eventos sob sua responsabilidade. |
| RF07 | Abertura e fechamento do check-in | Organizador controla a operação; confirmações fora da janela ou após fechamento são recusadas. |
| RF08 | Exibição de QR | Tela mostra QR correspondente à atividade aberta e validade; token vencido é rejeitado. |
| RF09 | Captura pontual de localização | A tentativa obtém coordenadas e precisão ou mostra erro recuperável. |
| RF10 | Confirmação de presença | Aluno inscrito, autenticado e com dados válidos recebe uma presença persistida e as horas previstas. |
| RF11 | Consulta de resultado | Após perda de resposta, aluno consulta sua situação sem criar registro duplicado. |
| RF12 | Histórico do aluno | Aluno consulta apenas suas inscrições, presenças e soma de horas válidas. |
| RF13 | Painel do organizador | Mostra inscritos e presenças por atividade, distinguindo pessoas únicas de quantidade de check-ins. |
| RF14 | Exportação CSV | Exporta aluno, identificador, evento, atividade, horário de confirmação e carga horária; sem coordenadas no arquivo comum. |
| RF15 | Auditoria operacional | Abertura/fechamento, alteração de regras e ações administrativas relevantes identificam ator e momento. |
| RF16 | Validação de proximidade, se aprovada | Distância e precisão são verificadas no backend com parâmetros da atividade e respostas específicas de falha. |

## 9. Telas previstas

**Públicas:** eventos, detalhes/programação e cadastro/login/recuperação de acesso.

**Aluno:** minhas inscrições, detalhes da inscrição, confirmação de presença após QR, resultado da tentativa e histórico de presenças/horas.

**Organizador:** meus eventos, formulário de evento, atividades, inscritos, controle de check-in, tela de projeção do QR e relatório de frequência.

Mobile first significa formulários curtos, ações principais acessíveis ao toque, feedback legível, contraste adequado e navegação sem depender de hover. Exibir texto junto às cores de sucesso/erro. No celular, preferir cartões ou linhas resumidas em vez de tabelas extensas. A projeção do QR deve ser legível à distância e evitar mostrar dados de alunos.

## 10. Arquitetura e dados

Aplicação React → API Node.js → PostgreSQL. Uma aplicação backend organizada por módulos: autenticação, eventos, inscrições, check-in e relatórios. Regras de negócio ficam na API. Usar o mesmo domínio com rotas /api quando possível para simplificar a implantação e a sessão web.

Complementos propostos: Express, TypeScript, migrations de banco, sessão em cookie HttpOnly/Secure com proteção contra CSRF, validação de entrada e consultas parametrizadas. Não exigir microsserviços, WebSocket, Redis, aplicativo nativo ou service worker offline. O painel pode consultar periodicamente a API, com intervalo moderado, pausa em segundo plano e tratamento de falhas.

| Entidade | Conteúdo principal |
|---|---|
| Usuário | Nome, e-mail, matrícula opcional conforme público, credencial de autenticação e estado da conta. |
| Vínculo de organização | Usuário, evento e permissão. |
| Evento | Responsável, nome, descrição, período, fuso, local, período de inscrição e estado. |
| Atividade | Evento, título, horários, minutos previstos, janela de check-in, estado e configuração opcional de proximidade. |
| Inscrição | Aluno, evento e data; unicidade aluno/evento. |
| Desafio QR | Atividade, hash do token opaco aleatório, validade e revogação; múltiplos alunos podem usá-lo. |
| Presença | Inscrição, atividade, horário do servidor, horas/minutos creditados e referência da tentativa; unicidade aluno/atividade. |
| Evidência de localização | Presença, latitude, longitude, precisão e horários; acesso restrito e retenção separada. |
| Auditoria | Ator, ação, recurso e momento; sem senhas, tokens completos ou coordenadas em logs gerais. |

Endpoints conceituais: autenticação; consulta/gestão de eventos e atividades; inscrição; lista de inscritos; abrir/fechar check-in; emissão de desafio QR; confirmar presença; consultar minha presença; exportar frequência. O GET aberto pelo QR somente prepara a tela; o POST autenticado grava a presença.

Para reduzir exposição do token a logs, preferir transportá-lo no fragmento da URL do QR e enviá-lo à API no corpo da confirmação. Não incluir nome, matrícula, senha ou localização no QR. Proteger exportações, limitar tentativas e neutralizar células perigosas em CSV para evitar interpretação de fórmulas por planilhas.

## 11. Qualidade e critérios de validação

| Área | Verificação planejada |
|---|---|
| Integridade | Requisições concorrentes para o mesmo aluno/atividade geram uma única presença e uma única atribuição de horas. |
| Autorização | Aluno não consulta outro aluno; organizador não acessa evento alheio; alteração de IDs é recusada. |
| Localização | Cobrir permissão negada, timeout, coordenadas inválidas e captura normal; com raio habilitado, testar distância/precisão limítrofes. |
| Rede | Perder a resposta após gravação não produz duplicidade; desconexão nunca produz mensagem de sucesso sem confirmação. |
| QR | Cobrir token inválido, vencido, revogado, de atividade fechada e expiração durante autenticação/captura de posição. |
| Responsividade | Validar os fluxos completos em Android/Chrome, iPhone/Safari e desktop, registrando versões efetivamente usadas. |
| Desempenho | Meta inicial para a API: p95 até 2 s na confirmação, excluindo login, obtenção da posição e ação humana. Cenário preliminar: evento com 500 inscritos e rajada de 50 solicitações concorrentes; calibrar conforme o piloto. |
| Recuperação | Testar backup/restauração e reinício do backend sem perda de presenças confirmadas. |

Medir separadamente o tempo total do aluno: abrir QR, autenticar, conceder permissão, obter posição e confirmar. Registrar taxa de sucesso na primeira tentativa, falhas por causa, divergência de horas e facilidade de uso. Metas são propostas de avaliação, não resultados já obtidos.

## 12. Sequência de implementação por entregas

Não fixar datas sem conhecer prazo acadêmico e disponibilidade semanal.

| Etapa | Trabalho | Pronto quando |
|---|---|---|
| 1. Contratos e prova de localização | Confirmar política de raio, cadastro e unidade de inscrição; prototipar captura HTTPS em celulares no local real; desenhar telas críticas. | Fluxo e falhas conhecidos; limites de localização, se usados, definidos por teste. |
| 2. Base e acesso | React mobile first, API Node, banco/migrations, cadastro/login, permissões e ambiente de implantação. | Aluno e organizador entram; acesso indevido é bloqueado. |
| 3. Eventos e inscrições | Publicação, atividades, inscrição pelo aluno e lista do organizador. | Um aluno real de teste se inscreve e aparece corretamente no painel. |
| 4. Presença ponta a ponta | QR da atividade, localização, validações, gravação transacional, prevenção de duplicidade e consulta de resultado. | Um celular lê o QR, confirma presença e recebe exatamente a carga horária prevista. |
| 5. Acompanhamento | Histórico do aluno, painel, soma de horas e CSV. | Dados exportados e exibidos correspondem às presenças válidas. |
| 6. Robustez e piloto | Testes de autorização, concorrência, rede e usabilidade; backup; execução assistida no evento. | Fluxos críticos passam e resultados/limitações estão documentados. |
| 7. Documentação TCC2 | Requisitos, casos de uso, modelo de dados, sequência do check-in, implantação, avaliação e revisão do texto. | Documento descreve fielmente o sistema entregue e as mudanças de escopo. |

Atualizar a documentação ao longo das etapas, não somente ao final. A primeira entrega demonstrável deve cobrir inscrição → QR no local → localização → presença registrada → consulta pelo organizador.

## 13. Mudanças necessárias no TCC1

- Substituir o módulo móvel Flutter por interfaces web responsivas em React.
- Alterar o sentido de leitura do QR: o aluno lê o código da atividade exibido no local.
- Remover offline, SQLite local e sincronização do escopo desta versão.
- Remover emissão e validação de certificados e filas específicas de geração documental.
- Descrever a coleta pontual de localização e, somente se aprovada, a validação de proximidade.
- Declarar que um check-in concede as horas previstas, sem medição da permanência.
- Atualizar objetivos, diagramas, metodologia e cronograma; integração institucional direta permanece fora do MVP proposto.
- Revisar título para refletir a entrega: “Sistema web mobile first para inscrições e registro de presença em eventos acadêmicos com QR Code e geolocalização” é uma sugestão, não título já aprovado.
- Verificar referências bibliográficas e evitar prometer prevenção absoluta de fraude.

## 14. Decisões restantes, sem reabrir as já confirmadas

1. Localização será apenas registrada ou também bloqueará confirmação fora do raio? Recomendação: avaliar bloqueio com teste real de precisão no local.
2. Evento agrupa várias atividades e a inscrição dá acesso a todas? Recomendação inicial: sim; sem reservas por atividade.
3. Matrícula e e-mail institucional serão obrigatórios ou haverá público externo? Recomendação: não presumir integração institucional; fechar os campos conforme o evento piloto.
4. Qual o prazo de entrega e quais eventos servirão de piloto? Isso define o calendário, volume de teste e política de retenção dos dados.

Essas pendências não alteram React/Node, mobile first, entrada única, ausência de certificados ou exigência de internet.

## 15. Fontes técnicas consultadas

- MDN — Geolocation.getCurrentPosition: https://developer.mozilla.org/en-US/docs/Web/API/Geolocation/getCurrentPosition — obtenção da posição, permissão, contexto seguro e opções de captura.
- MDN — GeolocationCoordinates.accuracy: https://developer.mozilla.org/en-US/docs/Web/API/GeolocationCoordinates/accuracy — significado da precisão informada em metros.

Os parâmetros, a arquitetura detalhada e as políticas descritas como propostas são decisões de projeto a validar no piloto, não exigências dessas fontes.
