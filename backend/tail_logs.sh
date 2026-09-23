#!/usr/bin/env bash
# Live backend logs, colour-coded.
#
#   ./tail_logs.sh              everything, merged: every request + response
#                               (logs/requests.log, as curl + JSON body) and
#                               the service output (errors, warnings,
#                               scheduler/scraper)
#   ./tail_logs.sh requests     only requests + responses
#   ./tail_logs.sh service      only the service output (journalctl)
#   ./tail_logs.sh errors       only warnings, errors, tracebacks, 4xx/5xx
#   ./tail_logs.sh scheduler    follow logs/scheduler.log (auto-scrape)
#   ./tail_logs.sh <file>       follow any log file
#
# Ctrl+C to stop.
set -euo pipefail

SERVICE="${SERVICE:-gunicorn}"   # systemd unit that runs Daphne
BACKEND_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MODE="${1:-all}"
REQUEST_LOG="$BACKEND_DIR/logs/requests.log"

RED=$'\033[0;31m'
YELLOW=$'\033[0;33m'
GREEN=$'\033[0;32m'
CYAN=$'\033[0;36m'
DIM=$'\033[2m'
RESET=$'\033[0m'

colorize() {
  while IFS= read -r line; do
    case "$line" in
      *'status=5'[0-9][0-9]*|*Traceback*|*ERROR*|*CRITICAL*|*Exception*|*'" 5'[0-9][0-9]' '*)
        printf '%s%s%s\n' "$RED" "$line" "$RESET" ;;
      *'status=4'[0-9][0-9]*|*WARNING*|*'" 4'[0-9][0-9]' '*)
        printf '%s%s%s\n' "$YELLOW" "$line" "$RESET" ;;
      *'status=2'[0-9][0-9]*|*'status=3'[0-9][0-9]*|*'" 2'[0-9][0-9]' '*|*'" 3'[0-9][0-9]' '*|*WSCONNECT*)
        printf '%s%s%s\n' "$GREEN" "$line" "$RESET" ;;
      *AutoScrape*|*Scheduler*|*Sessions*)
        printf '%s%s%s\n' "$CYAN" "$line" "$RESET" ;;
      'curl '*|'     -'*|'-- response --'|'--------'*)
        printf '%s%s%s\n' "$DIM" "$line" "$RESET" ;;
      *WSDISCONNECT*)
        printf '%s%s%s\n' "$DIM" "$line" "$RESET" ;;
      *)
        printf '%s\n' "$line" ;;
    esac
  done
}

only_problems() {
  grep --line-buffered -E 'Traceback|ERROR|CRITICAL|Exception|WARNING|" [45][0-9]{2} |status=[45][0-9]{2}|^\s+File "|Error:' || true
}

follow_service() {
  # -o cat drops journald's own prefix so each line is just the app output.
  journalctl -u "$SERVICE" -f -n "${1:-200}" -o cat
}

follow_requests() {
  touch "$REQUEST_LOG" 2>/dev/null || true
  # -F follows by name, so RotatingFileHandler rotation doesn't break it.
  tail -F -n "${1:-200}" "$REQUEST_LOG" 2>/dev/null
}

case "$MODE" in
  all)
    echo "${DIM}Following requests + $SERVICE output (Ctrl+C to stop)…${RESET}"
    # Both streams into one; Ctrl+C stops the whole group.
    trap 'kill 0' INT TERM
    { follow_service 50 & follow_requests 100 & wait; } | colorize
    ;;
  requests)
    echo "${DIM}Following $REQUEST_LOG (Ctrl+C to stop)…${RESET}"
    follow_requests | colorize
    ;;
  service)
    echo "${DIM}Following $SERVICE (Ctrl+C to stop)…${RESET}"
    follow_service | colorize
    ;;
  errors)
    echo "${DIM}Following warnings/errors (Ctrl+C to stop)…${RESET}"
    trap 'kill 0' INT TERM
    { follow_service 200 & follow_requests 0 & wait; } | only_problems | colorize
    ;;
  scheduler)
    LOG_FILE="$BACKEND_DIR/logs/scheduler.log"
    [ -f "$LOG_FILE" ] || { echo "Log file not found: $LOG_FILE" >&2; exit 1; }
    # -F follows by name, so RotatingFileHandler rotation doesn't break it.
    tail -F -n 200 "$LOG_FILE" | colorize
    ;;
  *)
    [ -f "$MODE" ] || { echo "Unknown option or file not found: $MODE (see the top of this script)" >&2; exit 1; }
    tail -F -n 200 "$MODE" | colorize
    ;;
esac
