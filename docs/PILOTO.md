# Roteiro do piloto e material para o TCC2

## Preparar

1. Definir instituição controladora, responsável técnico, contato, finalidade, base legal e política de acesso/retenção; ajustar o aviso público com os dados aprovados.
2. Implantar com PostgreSQL, HTTPS e SMTP. Testar recebimento de e-mail fora do ambiente local. Verificar cookies Secure, domínio e `APP_ORIGIN`.
3. Cadastrar organizador real, verificar e-mail, conceder perfil pela CLI. Não usar contas demo com dados reais.
4. Criar evento, inscrição, atividades, janelas e minutos. Conferir o fuso no painel.
5. Validar conectividade de alunos e projetor. Dimensionar o limitador por IP para a rede compartilhada.
6. Testar backup e restauração em uma base nova; documentar responsáveis e frequência operacional.

## Executar em celulares reais

Registrar modelo, sistema, navegador e versão efetivamente usados; não preencher a tabela antecipadamente.

| Dispositivo | SO e versão | Navegador e versão | Data | Resultado |
|---|---|---|---|---|
| Android real | A preencher | Chrome a preencher | A preencher | Pendente |
| iPhone real | A preencher | Safari a preencher | A preencher | Pendente |
| Desktop real | A preencher | Navegador a preencher | A preencher | Pendente |

Em cada um: criar/confirmar conta, autenticar, inscrever, ler QR nativamente, conceder localização e confirmar; verificar exatamente os minutos previstos no histórico e CSV. Repetir confirmação; negar e reabilitar permissão; testar timeout/indisponibilidade; deixar QR expirar durante autenticação; fechar a entrada; desconectar projetor e aluno; consultar a situação após perda de resposta. Avaliar contraste, toque, zoom, teclado, rolagem e legibilidade da projeção à distância.

Medir separadamente tempo humano total e tempo da API. Registrar taxa de primeira tentativa, distribuição de precisão, causas de falha, divergências de minutos e facilidade de uso. Não registrar coordenadas em planilha pública de avaliação. Se a posição falhar, registrar ocorrência para análise; não inventar localização nem presença.

## Atualizar o TCC1

O título de trabalho sugerido pelo plano é “Sistema web mobile first para inscrições e registro de presença em eventos acadêmicos com QR Code e geolocalização”. A aprovação acadêmica do título continua com o autor/orientador.

A redação deve refletir a implementação: React responsivo; aluno lê QR da atividade; funcionamento online; localização pontual; entrada única concede carga horária prevista; Node/Express e PostgreSQL; sessões e autorização por vínculo; transações e unicidades. Remover promessas de Flutter, SQLite local, offline, emissão/verificação de certificados e filas documentais.

Usar os diagramas de arquitetura/dados/sequência em `ARQUITETURA.md`, a rastreabilidade e o relatório de validação como base técnica. Não apresentar o teste sintético como piloto real nem a localização como prova absoluta. Conferir referências bibliográficas do TCC1 antes da versão final: elas não foram verificadas como publicações existentes nesta implementação.

O calendário permanece aberto: não foi fornecido prazo acadêmico ou evento piloto. As etapas implementadas não substituem a execução assistida e a análise empírica com participantes reais.
