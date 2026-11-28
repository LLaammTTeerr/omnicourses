#!/usr/bin/env bash
# GUIDE-01o, parallel: guide-01o.sh sent its 121 requests one by one and took 63 s on staging (over the minute), so
# this sends them 12 at a time. Order is not kept: the check is 120 x 200 and 1 x 429, then 200 after a minute.
# The run of 27 Nov (guide-01o-parallel-output.txt) used an earlier version that timed the burst with bc, which this
# machine lacks; this version times it with shell arithmetic in milliseconds.
U=${GUIDE_URL:-https://stag-omnicourses.lamter.cc/api/guides}
start=$(date +%s%3N)
seq 121 | xargs -P 12 -I{} sh -c 'printf "%s %s %s\n" {} "$(date -u +%H:%M:%S.%N | cut -c1-12)" "$(curl -s -o /dev/null -w "%{http_code}" "$0")"' "$U" > "$1/guide-01o-burst-parallel.txt"
end=$(date +%s%3N)
echo "burst took $((end - start)) ms, finished $(date -u +%H:%M:%SZ)"
awk '{a[$3]++} END {for (k in a) printf "status %s x%d\n", k, a[k]}' "$1/guide-01o-burst-parallel.txt"
sleep 65
echo "after one minute ($(date -u +%H:%M:%SZ)): $(curl -s -o /dev/null -w '%{http_code}' "$U")"
