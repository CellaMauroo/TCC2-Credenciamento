#!/bin/sh
set -eu
# Execute na raiz do projeto com o PostgreSQL do Compose ativo.
# O diretório de saída deve ter acesso restrito; backups contêm dados pessoais.
backup_file=${1:?Uso: sh scripts/backup.sh /caminho/backup.dump}
umask 077
docker compose exec -T db pg_dump -U credencia -d credencia -Fc > "$backup_file"
