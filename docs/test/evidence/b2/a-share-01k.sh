#!/usr/bin/env bash
# TC-B2-SHARE-01k on staging, as the case gives it (Git Bash: bash, curl, openssl, tr). Prints status codes only.
U=https://stag-omnicourses.lamter.cc/api/shared-plans
date -u +%FT%TZ
for i in $(seq 1 121); do curl -s -o /dev/null -w "%{http_code}\n" $U/$(openssl rand -base64 32 | tr '+/' '-_' | tr -d '=') ; done | sort | uniq -c
date -u +%FT%TZ
echo "one more, curl -sI:"
curl -sI $U/$(openssl rand -base64 32 | tr '+/' '-_' | tr -d '=') | grep -iE '^HTTP|^x-robots-tag|^cache-control|^retry-after'
echo "after a minute:"
sleep 65
date -u +%FT%TZ
curl -s -o /dev/null -w "%{http_code}\n" $U/$(openssl rand -base64 32 | tr '+/' '-_' | tr -d '=')
