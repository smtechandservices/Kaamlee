#!/usr/bin/env bash
# Tail the live request log in prod, with color-coded status codes.
# Usage: ./scripts/tail_logs.sh [path-to-log-file]
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE="${1:-$SCRIPT_DIR/../logs/requests.log}"

if [ ! -f "$LOG_FILE" ]; then
    echo "Log file not found: $LOG_FILE" >&2
    exit 1
fi

RED=$'\033[0;31m'
YELLOW=$'\033[0;33m'
GREEN=$'\033[0;32m'
DIM=$'\033[2m'
RESET=$'\033[0m'

# -F follows the file by name, so log rotation (RotatingFileHandler) doesn't break the tail.
tail -F -n 200 "$LOG_FILE" | while IFS= read -r line; do
    case "$line" in
        *"status=4"*|*"status=5"*)
            printf '%s%s%s\n' "$RED" "$line" "$RESET" ;;
        *"status=2"*|*"status=3"*)
            printf '%s%s%s\n' "$GREEN" "$line" "$RESET" ;;
        curl*)
            printf '%s%s%s\n' "$YELLOW" "$line" "$RESET" ;;
        ----*)
            printf '%s%s%s\n' "$DIM" "$line" "$RESET" ;;
        *)
            printf '%s\n' "$line" ;;
    esac
done
