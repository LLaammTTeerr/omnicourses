#!/usr/bin/env bash
# GUIDE-01o (second reader) and DEP-01e: keep this address over both limits for about three minutes, so that a second
# tester on another network (Dũng's phone on mobile data) can open Guides and sign in while this address is refused.
# Each round: 125 guide-list requests 12 at a time, and 11 wrong-password sign-ins for b1-run-r27a-a01 (an account
# nobody uses in the phone check). Every status is written with its UTC time to the file given as $1.
G=https://stag-omnicourses.lamter.cc/api/guides
S=https://stag-omnicourses.lamter.cc/api/auth/sign-in
OUT="$1"
: > "$OUT"
end=$(( $(date +%s) + ${SECONDS_TOTAL:-180} ))
round=0
while [ "$(date +%s)" -lt "$end" ]; do
  round=$((round + 1))
  seq 125 | xargs -P 12 -I{} sh -c 'printf "%s guides r%s %s\n" "$(date -u +%H:%M:%S)" "$1" "$(curl -s -o /dev/null -w "%{http_code}" "$0")"' "$G" "$round" >> "$OUT"
  for i in $(seq 11); do
    printf '%s sign-in r%s %s\n' "$(date -u +%H:%M:%S)" "$round" "$(curl -s -o /dev/null -w '%{http_code}' -H 'content-type: application/json' -d '{"email":"b1-run-r27a-a01@example.com","password":"not the password"}' "$S")" >> "$OUT"
  done
  echo "round $round done $(date -u +%H:%M:%SZ): guides $(grep -c "guides r$round 429" "$OUT") x 429, sign-in $(grep -c "sign-in r$round 429" "$OUT") x 429"
  sleep 20
done
echo "finished $(date -u +%H:%M:%SZ)"
