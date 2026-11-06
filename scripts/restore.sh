#!/bin/sh
set -eu
# Restaure em uma base NOVA. Nunca sobrescreve a base de produção.
backup_file=${1:?Uso: sh scripts/restore.sh backup.dump nome_base_nova}
restore_database=${2:?Informe uma base nova para validar a restauração}
case "$restore_database" in
  ''|*[!a-z0-9_]*) echo 'Use somente a-z, 0-9 e sublinhado no nome da base.' >&2; exit 1 ;;
  credencia|postgres|template0|template1) echo 'Use uma base nova de validação.' >&2; exit 1 ;;
esac
docker compose exec -T db createdb -U credencia "$restore_database"
docker compose exec -T db pg_restore -U credencia -d "$restore_database" --no-owner < "$backup_file"
docker compose exec -T db psql -U credencia -d "$restore_database" -c 'SELECT count(*) AS presencas, coalesce(sum(minutes),0) AS minutos FROM attendances;'
