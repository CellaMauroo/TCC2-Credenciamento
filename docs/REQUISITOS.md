# Rastreabilidade do plano

| Requisito | Entrega / verificação |
|---|---|
| RF01 | Cadastro, login, logout, confirmação, reenvio e recuperação; privilégios somente na CLI; testes de token, CSRF e invalidação de sessão. |
| RF02 | CRUD sem exclusão de histórico, publicação e encerramento; teste de vínculo de outro organizador. |
| RF03 | Atividade com título, datas, minutos e janela; validação no backend e formulário no fuso do evento. |
| RF04 | Listagem e detalhes exclusivamente publicados; rascunho retorna 404. |
| RF05 | Inscrição pelo aluno no período; teste de 10 solicitações concorrentes. |
| RF06 | Lista de inscritos protegida por vínculo. |
| RF07 | Abrir/fechar; janela vigente e estado validados no servidor. |
| RF08 | QR real, 120 s, projeção com renovação e conexão; expiração/revogação testadas na API. |
| RF09 | Captura nova, alta precisão, timeout e mensagens de falha; testes das opções e erros da API de localização. |
| RF10 | Confirmação transacional, evidência separada, minutos definidos no servidor; 50 solicitações duplicadas sem crédito adicional. |
| RF11 | Consulta de presença existente e recuperação após erro de transporte; sem sucesso offline. |
| RF12 | Inscrições próprias, detalhe, histórico e soma de horas; tentativa de escolher outro user_id não dá acesso. |
| RF13 | Inscritos, pessoas únicas, check-ins, minutos totais e quantidade por atividade; painel consulta periodicamente. |
| RF14 | CSV protegido por evento, sem coordenadas e com neutralização de fórmulas. |
| RF15 | Auditoria de criação/edição/publicação/encerramento, regras, abertura/fechamento, presença e exportação; ações técnicas identificadas como CLI/sistema. |
| RF16 | Opcional não ativado: adotado somente registro de localização. |

| Regra | Cobertura |
|---|---|
| RN01 | UNIQUE usuário/evento + retorno da inscrição existente. |
| RN02 | Sessão verificada e inscrição exigidas. |
| RN03 | Token vinculado à atividade, reutilizável entre alunos; somente hash persistido. |
| RN04 | Validade e janela pelo relógio do servidor; fechamento transacional invalida código. |
| RN05 | UNIQUE usuário/atividade. |
| RN06 | Minutos integrais, sem saída. |
| RN07 | Snapshot da carga horária na presença. |
| RN08 | Usuário pela sessão, atividade pela rota/token, minutos pela configuração persistida. |
| RN09 | Posição obrigatória; captura antiga é recusada. Sem bloqueio opcional por raio. |
| RN10 | UNIQUE + ON CONFLICT + transação; retornos concorrentes têm o mesmo ID. |
| RN11 | Sem exclusão comum de eventos, atividades com histórico ou presenças. Encerramento preserva registros. |
| RN12 | Proposta não ativada: sem bloqueio de sobreposição entre atividades nesta versão. |

As telas previstas estão entregues: públicas; autenticação; inscrições e detalhes; confirmação/resultado; histórico; eventos da organização; formulário de evento; atividades; inscritos; check-in; projeção; relatório. O piloto presencial e a revisão acadêmica final do texto continuam como avaliação de campo, sem resultados inventados.
