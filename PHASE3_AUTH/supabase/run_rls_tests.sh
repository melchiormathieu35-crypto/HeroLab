#!/usr/bin/env bash
# ============================================================================
# Exécute les tests d'isolation RLS sur un Postgres jetable.
#
# Monte un cluster local, applique le shim Supabase, le schéma, puis les tests.
# Ne nécessite AUCUN projet Supabase : c'est ce qui permet de faire tourner ces
# tests en intégration continue.
#
#   ./PHASE3_AUTH/supabase/run_rls_tests.sh
# ============================================================================
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PGBIN="${PGBIN:-/usr/lib/postgresql/16/bin}"
PGDATA="${PGDATA:-/var/lib/pgtest/data}"
PGPORT="${PGPORT:-5433}"
PGUSER_TEST="${PGUSER_TEST:-pgtest}"
DB="herolab_rls_$$"

export PGHOST=/tmp PGPORT PGUSER=postgres

if ! "$PGBIN/pg_isready" -h /tmp -p "$PGPORT" >/dev/null 2>&1; then
  echo "→ démarrage d'un cluster Postgres jetable"
  id -u "$PGUSER_TEST" >/dev/null 2>&1 || useradd -m "$PGUSER_TEST"
  if [ ! -d "$PGDATA" ]; then
    mkdir -p "$(dirname "$PGDATA")"
    chown "$PGUSER_TEST" "$(dirname "$PGDATA")"
    su "$PGUSER_TEST" -c "$PGBIN/initdb -D $PGDATA -A trust -U postgres" >/dev/null
  fi
  su "$PGUSER_TEST" -c "$PGBIN/pg_ctl -D $PGDATA -o '-p $PGPORT -k /tmp' -l $PGDATA/../log start" >/dev/null
  sleep 2
fi

cleanup() { psql -q -d postgres -c "drop database if exists $DB" >/dev/null 2>&1 || true; }
trap cleanup EXIT

psql -q -d postgres -c "create database $DB"

echo "→ échafaudage Supabase"
psql -q -v ON_ERROR_STOP=1 -d "$DB" -f "$HERE/000_supabase_shim.sql" >/dev/null

echo "→ schéma et policies"
psql -q -v ON_ERROR_STOP=1 -d "$DB" -f "$HERE/001_schema.sql" >/dev/null

echo "→ tests d'isolation"
if psql -v ON_ERROR_STOP=1 -d "$DB" -f "$HERE/002_rls_tests.sql" 2>&1 \
     | sed 's/^psql.*NOTICE:  //' | grep -E 'PASS|ÉCHEC|═══'; then
  echo
  echo "RLS : OK"
else
  echo
  echo "RLS : ÉCHEC" >&2
  exit 1
fi
