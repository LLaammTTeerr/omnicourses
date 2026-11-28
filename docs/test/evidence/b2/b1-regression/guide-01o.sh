#!/usr/bin/env bash
# GUIDE-01o: 121 unauthenticated requests to the guide list within a minute, then one more after a minute.
U=${GUIDE_URL:-https://stag-omnicourses.lamter.cc/api/guides}
start=$(date +%s)
for i in $(seq 121); do
  printf '%s %s\n' "$i" "$(curl -s -o /dev/null -w '%{http_code}' "$U")"
done > "$1/guide-01o-burst.txt"
end=$(date +%s)
echo "burst took $((end-start)) s, finished $(date -u +%H:%M:%SZ)"
awk '$1<=120 {a[$2]++} $1==121 {last=$2} END {for (k in a) printf "requests 1-120: %s x%d\n", k, a[k]; print "request 121: " last}' "$1/guide-01o-burst.txt"
sleep 65
echo "after one minute ($(date -u +%H:%M:%SZ)): $(curl -s -o /dev/null -w '%{http_code}' "$U")"
