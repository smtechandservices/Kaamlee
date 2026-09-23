#!/usr/bin/env bash
# Deploy/restart the Kaamlee backend on the server:
#
#   1. git fetch + git pull (current branch, fast-forward only)
#   2. pip install — only if the pull changed requirements.txt
#   3. apply migrations — only if there are unapplied ones
#   4. sudo systemctl restart gunicorn, then wait for it to answer
#
# Usage:  ./restart.sh
# Stops at the first failing step, so a failed pull or migration never
# leads to a restart on half-applied changes.
set -euo pipefail

SERVICE="${SERVICE:-gunicorn}"                     # systemd unit (runs Daphne)
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:8000/api/stats/}"
BACKEND_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

step() { printf '\n\033[1;32m==> %s\033[0m\n' "$*"; }
note() { printf '    %s\n' "$*"; }
fail() { printf '\n\033[1;31m✗ %s\033[0m\n' "$*"; exit 1; }

cd "$BACKEND_DIR"
[ -f venv/bin/activate ] || fail "No virtualenv at $BACKEND_DIR/venv"
# shellcheck disable=SC1091
source venv/bin/activate

# 1. Pull ---------------------------------------------------------------
branch="$(git rev-parse --abbrev-ref HEAD)"
before="$(git rev-parse HEAD)"

step "Fetching ($branch)"
git fetch --prune

step "Pulling"
git pull --ff-only
after="$(git rev-parse HEAD)"

if [ "$before" = "$after" ]; then
  note "Already up to date at $(git log -1 --oneline)"
else
  note "Updated $(git rev-parse --short "$before") → $(git rev-parse --short "$after"):"
  git log --oneline "$before..$after" | sed 's/^/      /'
fi

# 2. Requirements (only if they changed in this pull) ------------------
if [ "$before" != "$after" ] && ! git diff --quiet "$before" "$after" -- requirements.txt; then
  step "requirements.txt changed — installing"
  pip install -q -r requirements.txt
fi

# 3. Migrations (only if any are unapplied) ----------------------------
step "Checking for migrations"
pending="$(python manage.py showmigrations --plan 2>/dev/null | grep '^\[ \]' || true)"
if [ -n "$pending" ]; then
  note "Unapplied:"
  echo "$pending" | sed 's/^\[ \] /      /'
  step "Migrating"
  python manage.py migrate --noinput
else
  note "None — database is up to date"
fi

# 4. Restart ------------------------------------------------------------
step "Restarting $SERVICE"
sudo systemctl restart "$SERVICE"

step "Waiting for the backend to answer"
code=""
for i in $(seq 1 20); do
  code="$(curl -s -o /dev/null -w '%{http_code}' "$HEALTH_URL" || true)"
  if [ "$code" = "200" ]; then
    printf '\033[1;32m✓ Backend is up after %ss\033[0m\n\n' "$i"
    journalctl -u "$SERVICE" -n 8 --no-pager || true
    exit 0
  fi
  sleep 1
done

echo
journalctl -u "$SERVICE" -n 40 --no-pager || true
fail "No 200 from $HEALTH_URL within 20s (last status: ${code:-none}) — see the log above."
