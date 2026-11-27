#!/usr/bin/env bash
# usage: verify.sh <worktree> <dbname> [steps...]
# steps: typecheck lint unit-be unit-fe build e2e openapi contract browser   (default: all)
# One full run at a time on this machine (flock), so timing-sensitive tests are not starved.
set -u
WT="$(cd "$1" && pwd)"; DB="$2"; shift 2
STEPS=("$@"); [ ${#STEPS[@]} -eq 0 ] && STEPS=(typecheck lint unit-be unit-fe build e2e openapi contract browser)
ROOT="${CV_OUT:-$HOME/.cache/cv-verify}"; OUT="$ROOT/$(basename "$WT")"; mkdir -p "$OUT"
exec 9>"$ROOT/lock"; flock 9
NPM="npx --yes npm@11.21.1"
export DATABASE_URL="postgres://omnicourse:omnicourse@localhost:5432/$DB"
CID="$(docker ps --filter publish=5432 --format '{{.Names}}' | head -1)"
if [ -n "$CID" ]; then
  docker exec "$CID" psql -U omnicourse -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$DB'" | grep -q 1 || docker exec "$CID" createdb -U omnicourse "$DB"
else
  echo "WARNING: no Postgres container publishes 5432; e2e will fail"
fi
BASE="$(git -C "$WT" merge-base origin/main HEAD)"
has() { for s in "${STEPS[@]}"; do [ "$s" = "$1" ] && return 0; done; return 1; }
run() {
  local name="$1"; shift
  local t0=$(date +%s)
  if ( cd "$WT" && eval "$*" ) > "$OUT/$name.log" 2>&1; then echo "PASS $name ($(( $(date +%s) - t0 ))s)"; else echo "FAIL $name ($(( $(date +%s) - t0 ))s) -> $OUT/$name.log"; echo "$name" >> "$OUT/failed"; fi
}
rm -f "$OUT/failed"
pids=()
has typecheck && { run typecheck-be "$NPM run typecheck -w src/backend" & pids+=($!); run typecheck-fe "$NPM run typecheck -w src/frontend" & pids+=($!); }
has lint && { run lint "$NPM run lint" & pids+=($!); }
has unit-be && { run unit-be "$NPM run test -w src/backend" & pids+=($!); }
has unit-fe && { run unit-fe "$NPM run test -w src/frontend" & pids+=($!); }
wait "${pids[@]}" 2>/dev/null
pids=()
has build && { run build-be "$NPM run build -w src/backend" & pids+=($!); run build-fe "$NPM run build -w src/frontend" & pids+=($!); }
wait "${pids[@]}" 2>/dev/null
pids=()
has e2e && { run e2e "$NPM run test:e2e -w src/backend" & pids+=($!); }
has openapi && { run openapi "$NPM run openapi -w src/backend && git diff --exit-code --stat $BASE -- src/backend/openapi.json" & pids+=($!); }
has contract && { run contract "git diff --exit-code --stat $BASE -- src/backend/src/database/migrations ':!src/backend/src/database/migrations/index.ts' package-lock.json" & pids+=($!); }
has browser && { run browser "$NPM run test:browser" & pids+=($!); }
wait "${pids[@]}" 2>/dev/null
count() { [ -f "$OUT/$1.log" ] && sed 's/\x1b\[[0-9;]*m//g' "$OUT/$1.log" | grep -E '^ +Tests ' | tail -1 | grep -oE '[0-9]+ passed' | grep -oE '[0-9]+' || echo '-'; }
echo "COUNTS unit-be=$(count unit-be) unit-fe=$(count unit-fe) e2e=$(count e2e) browser=$(count browser)   (baseline 3c4da22: 1132 1246 364 68)"
if [ -f "$OUT/failed" ]; then echo "RESULT: FAILED: $(tr '\n' ' ' < "$OUT/failed")"; exit 1; else echo "RESULT: ALL PASS (${STEPS[*]})"; fi
