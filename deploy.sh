#!/usr/bin/env bash

set -Eeuo pipefail

########################################
# CONFIG
########################################

APP_DIR="/var/www/testcase"

BACKEND_DIR="$APP_DIR/server"
FRONTEND_DIR="$APP_DIR/client"

LOG_DIR="$APP_DIR/logs"
BACKUP_DIR="/var/backups/testcase"

BRANCH="main"

TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
LOG_FILE="$LOG_DIR/deploy_$TIMESTAMP.log"

BACKEND_URL="http://127.0.0.1:3001/api/health"
FRONTEND_URL="http://127.0.0.1:5173/"

BACKUP_KEEP_DAYS=14

########################################
# LOGGING
########################################

mkdir -p "$LOG_DIR"
mkdir -p "$BACKUP_DIR"

exec > >(tee -a "$LOG_FILE") 2>&1

echo "========================================"
echo " TESTCASE DEPLOY"
echo " Started: $(date)"
echo "========================================"

########################################
# ERROR HANDLER
########################################

trap '{
    EXIT_CODE=$?

    echo ""
    echo "========================================"
    echo " DEPLOY FAILED"
    echo " Time: $(date)"
    echo " Exit code: $EXIT_CODE"
    echo " Log: $LOG_FILE"
    echo "========================================"

    exit $EXIT_CODE
}' ERR

########################################
# STEP 1 - CHECK ENVIRONMENT
########################################

echo ""
echo "[1/10] Checking environment..."

command -v git >/dev/null
command -v node >/dev/null
command -v npm >/dev/null
command -v curl >/dev/null
command -v pg_dump >/dev/null

echo "Git:  $(git --version)"
echo "Node: $(node --version)"
echo "NPM:  $(npm --version)"

########################################
# STEP 2 - UPDATE SOURCE
########################################

echo ""
echo "[2/10] Updating source code..."

cd "$APP_DIR"

git config --global --add safe.directory "$APP_DIR" || true
chmod -R u+rwX "$APP_DIR/.git" 2>/dev/null || true

git fetch origin "$BRANCH"

OLD_COMMIT="$(git rev-parse HEAD)"
NEW_COMMIT="$(git rev-parse "origin/$BRANCH")"

echo "Current commit: $OLD_COMMIT"
echo "Target commit:  $NEW_COMMIT"

if [ "$OLD_COMMIT" = "$NEW_COMMIT" ]; then
    echo "Already up to date."
else
    echo "Updating source..."

    git reset --hard "origin/$BRANCH"

    echo "Source updated successfully."
fi

########################################
# STEP 3 - BACKUP DATABASE
########################################

echo ""
echo "[3/10] Backing up database..."

DB_BACKUP_FILE="$BACKUP_DIR/testcase_db_$TIMESTAMP.dump"

pg_dump \
    -h 127.0.0.1 \
    -p 5432 \
    -U testcase \
    -d testcase_db \
    --format=custom \
    --file="$DB_BACKUP_FILE"

echo "Database backup created:"
echo "$DB_BACKUP_FILE"

########################################
# CLEAN OLD BACKUPS
########################################

echo "Cleaning backups older than $BACKUP_KEEP_DAYS days..."

find "$BACKUP_DIR" \
    -type f \
    -name "testcase_db_*" \
    -mtime +"$BACKUP_KEEP_DAYS" \
    -delete || true

########################################
# STEP 4 - BACKEND DEPENDENCIES
########################################

echo ""
echo "[4/10] Installing backend dependencies..."

cd "$BACKEND_DIR"

npm ci

########################################
# STEP 5 - FIX DB OWNERSHIP & MIGRATION
########################################

echo ""
echo "[5/10] Fixing DB ownership & running migrations..."

cd "$BACKEND_DIR"

# Chuyển ownership tất cả tables, sequences, types cho user testcase
# để tránh lỗi "must be owner of table" khi chạy ALTER TABLE
echo "Transferring database object ownership to 'testcase'..."

sudo -u postgres psql -d testcase_db -q <<'EOSQL'
DO $$
DECLARE r RECORD;
BEGIN
  -- Tables
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE 'ALTER TABLE public.' || quote_ident(r.tablename) || ' OWNER TO testcase';
  END LOOP;
  -- Sequences
  FOR r IN SELECT sequencename FROM pg_sequences WHERE schemaname = 'public' LOOP
    EXECUTE 'ALTER SEQUENCE public.' || quote_ident(r.sequencename) || ' OWNER TO testcase';
  END LOOP;
  -- Types (enums)
  FOR r IN SELECT typname FROM pg_type t JOIN pg_namespace n ON t.typnamespace = n.oid WHERE n.nspname = 'public' AND t.typtype = 'e' LOOP
    EXECUTE 'ALTER TYPE public.' || quote_ident(r.typname) || ' OWNER TO testcase';
  END LOOP;
END $$;
EOSQL

echo "Database ownership transferred successfully."

npx prisma generate

npx prisma migrate deploy

echo ""
echo "Checking migration status..."

npx prisma migrate status

echo "Database migrations completed successfully."

########################################
# STEP 6 - BUILD BACKEND & SEED DATA
########################################

echo ""
echo "[6/10] Building backend..."

cd "$BACKEND_DIR"

npm run build

echo "Backend build successful."

echo "Running database seed..."

npm run seed:prod

echo "Database seed completed successfully."

########################################
# STEP 7 - FRONTEND DEPENDENCIES
########################################

echo ""
echo "[7/10] Installing frontend dependencies..."

cd "$FRONTEND_DIR"

npm ci

########################################
# STEP 8 - BUILD FRONTEND
########################################

echo ""
echo "[8/10] Building frontend..."

npm run build

echo "Frontend build successful."

########################################
# STEP 9 - RESTART APPLICATION
########################################

echo ""
echo "[9/10] Restarting applications..."

sudo /usr/bin/pm2 restart testcase-server

sudo /usr/bin/pm2 restart testcase-frontend

echo "PM2 applications restarted."

########################################
# STEP 10 - HEALTH CHECK
########################################

echo ""
echo "[10/10] Running health checks..."

sleep 5

echo "Checking backend..."

curl \
    --fail \
    --silent \
    --show-error \
    --retry 5 \
    --retry-delay 2 \
    "$BACKEND_URL"

echo ""
echo "Backend: OK"

echo ""
echo "Checking frontend..."

curl \
    --fail \
    --silent \
    --show-error \
    --retry 5 \
    --retry-delay 2 \
    "$FRONTEND_URL" \
    >/dev/null

echo "Frontend: OK"

########################################
# SUCCESS
########################################

echo ""
echo "========================================"
echo " DEPLOY SUCCESS"
echo " Finished: $(date)"
echo " Commit: $NEW_COMMIT"
echo " Database backup: $DB_BACKUP_FILE"
echo " Log: $LOG_FILE"
echo "========================================"

exit 0
