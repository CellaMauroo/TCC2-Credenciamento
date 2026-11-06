# Decisões de implementação

O plano `Plano_TCC2_Web_Mobile_First.md` é a fonte de decisões. O PDF de TCC1 fornece contexto histórico; suas propostas incompatíveis não foram implementadas. O usuário autorizou resolver dúvidas pelo caminho mais simples.

| Tema | Decisão adotada |
|---|---|
| Stack | React, Node.js, Express e TypeScript; PostgreSQL convencional em produção. |
| Ambiente local sem infraestrutura | PGlite, motor PostgreSQL embarcado persistente. Não é SQLite, fila offline nem armazenamento no navegador. |
| Unidade de inscrição | Evento com várias atividades. Uma inscrição permite participar de todas. |
| Unidade de presença | Atividade. Entrada única concede os minutos previstos, copiados para a presença. |
| Perfis | Aluno por cadastro público; organizador concedido por CLI técnica. Vínculo de acesso por evento. |
| Cadastro | Nome, e-mail e senha obrigatórios. Matrícula opcional; sem integração institucional. |
| E-mail | Confirmação e recuperação por tokens aleatórios, hasheados no banco e com validade; SMTP em produção. |
| Sessão | Cookie HttpOnly, SameSite=Lax, Secure em produção; token CSRF e verificação de Origin. |
| QR | Token opaco da atividade no fragmento da URL, sem dados pessoais; 120 segundos, limitado ao fim da janela. |
| Renovação | Projeção consulta estado a cada 5 segundos e emite novo código quando restam 30 segundos. Não revoga o anterior só pela renovação. |
| Revogação | Fechamento, mudança de estado e alteração de atividade revogam os desafios emitidos. |
| Geolocalização | Obrigatória; captura nova, precisão e horários. Apenas registro, sem bloqueio por raio. |
| Validade da posição | Rejeitar captura com mais de 120 segundos ou mais de 30 segundos no futuro segundo o servidor; relógio incorreto pode exigir ajuste. |
| Atividades sobrepostas | Bloqueio RN12 desativado: é proposta que exige validação organizacional. O relatório não mede tempo físico nem deduplica horários entre atividades. |
| Organização | Criar/editar evento e atividades; publicar; abrir/fechar entrada; inscritos; painel; CSV; encerrar sem excluir histórico. |
| Mudança de carga horária | Fechar a entrada antes de editar. Presenças anteriores preservam os minutos creditados. |
| Recuperação de rede | Consultar a presença antes da tentativa e após falha de transporte; sem sucesso otimista e sem fila offline. |
| Retenção | Sem prazo universal inventado. Comando explícito de purge por prazo configurado pela instituição. |
| Hospedagem | Aplicação Node executável com Docker e PostgreSQL. Não adaptar silenciosamente para Workers/D1, nem publicar em infraestrutura incompatível com a stack do plano. |

Não incluídos: certificados, check-out, permanência mínima, offline, Flutter, leitura de câmera dentro do site, pagamentos, lotação individual, lista de espera, biometria, login institucional, edição manual de presença ou geolocalização contínua.

Antes do piloto real: configurar HTTPS/SMTP, política de dados e testar precisão no local com os dispositivos dos participantes. Os resultados sintéticos não encerram a avaliação de campo prevista no plano.
