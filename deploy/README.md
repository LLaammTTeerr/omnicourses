# Deploying OmniCourse

Two environments on one Linux host, behind Cloudflare:

| Environment | Address | Branch | Deploys when |
| --- | --- | --- | --- |
| production | https://omnicourses.lamter.cc | `main` | CI passes on a merge to `main` |
| staging | https://stag-omnicourses.lamter.cc | `staging` | anything is pushed or merged to `staging` |

`staging` is a shared playground: anyone with write access may merge into it. **Every other day at 02:00 Vietnam time it is reset to `main`** (`.github/workflows/reset-staging.yml`) and redeployed, so a change survives only if it also reaches `main` through a normal PR. The reset touches code only: the staging database keeps its data and gets `main`'s migrations.

Why `stag-omnicourses` and not `stag.omnicourses`: Cloudflare's free certificate covers one level under `lamter.cc`.

## How a deploy runs

```text
GitHub Actions (deploy.yml)                         host
  pick environment + commit                   
  ssh omnicourse@host <commit>  ──── forced-command key ────▶ omnicourse-deploy <env>
                                                              commit on the env's branch? else refuse
                                                              build once: git archive, npm ci, npm run build
                                                              pg_dump  → /var/backups/omnicourse (14 kept)
                                                              db:migrate, db:seed
                                                              switch current → restart → /api/health (status=ok & database=up)
                                                              unhealthy → switch back, fail the job
```

- Each GitHub environment (`production`, `staging`) has its own SSH key. On the host, the key is pinned to its environment by `command="/usr/local/bin/omnicourse-deploy <env>",restrict`: it can't open a shell, and it only deploys commits already on that environment's branch.
- The environments' secrets are `DEPLOY_SSH_KEY`, `DEPLOY_KNOWN_HOSTS` and `DEPLOY_HOST`. The host address stays out of this public repository: it is also qhhoj.com's origin.
- GitHub only lets `production` deploy from `main`, and `staging` from `staging`.
- Health check requires HTTP 200 **and** `{"status":"ok","database":"up"}` from `/api/health`; if PostgreSQL is unreachable or degraded, the deploy automatically rolls back the `current` symlink and restarts the previous release.
- A rollback restores the previous code, not the database. Restore a backup by hand if a migration was the problem.

## The host

`deploy/server/setup.sh` (as root) sets everything up and can be re-run safely:

- user `omnicourse`, with no sudo except `omnicourse-root restart|dump <env>`;
- Node 22.22.1 and npm 11.21.1 in `/opt/omnicourse/node`, the host's own Node untouched;
- PostgreSQL 18.6 in Docker (`omnicourse-db`, `127.0.0.1:5433`), one database and role per environment;
- `/etc/omnicourse/<env>.env` (generated passwords never leave the host; staging's adds `API_DOCS=true`, so only staging serves `/api/docs`);
- systemd `omnicourse@prod` (port 3101) and `omnicourse@stag` (port 3102): 1 GB memory, cores 0–1, hardened;
- systemd timers `omnicourse-backup.timer` (nightly database dumps at `20:00 UTC` / `03:00` Vietnam time) and `omnicourse-cloudflare-ips.timer` (weekly refresh of `/etc/nginx/conf.d/omnicourse-cloudflare-origin.conf`, staged via a temp file and checked with `nginx -t` before reloading);
- nginx sites that accept only Cloudflare and serve the SPA plus `/api` with HSTS, Permissions-Policy and a hash-pinned CSP.

Other sites share the host. Keep OmniCourse inside these limits, and never touch their services.

First-time steps after `setup.sh`:

1. `deploy/server/add-deploy-key.sh <prod|stag> '<public key>'` for each environment's key.
2. With both DNS names proxied to the host: `certbot certonly --nginx -d <host>` for each, then re-run `setup.sh` to turn on HTTPS.

## Backups and restore rehearsal

OmniCourse maintains two separate local backup pools per environment (`chmod 640`, owned by `root:omnicourse` inside `root:omnicourse 750` directories so `omnicourse` can read dumps without planting symlinks), plus an optional off-host replication hook:

- **Pre-deploy dumps**: `/var/backups/omnicourse/<env>-<YYYYMMDDTHHMMSSZ>.sql.gz` — written automatically before every deploy migration, retaining the 14 newest per environment.
- **Nightly dumps**: `/var/backups/omnicourse/daily/<env>-<YYYY-MM-DD>.sql.gz` — written daily at `20:00 UTC` (`03:00` Vietnam time) by `omnicourse-backup.timer` (`Persistent=true`), retaining the 14 newest daily dumps per environment independently of deploy frequency.
- **Off-host replication**: if `/etc/omnicourse/backup-sync.sh` exists and is executable by `root` (install with `install -o root -g root -m 700`), `omnicourse-root nightly-dump <env>` invokes `/etc/omnicourse/backup-sync.sh <dump-path>` after each daily dump so it can push encrypted copies to object storage or a remote host (`rclone`, `rsync`, `aws s3 cp`, …).

### Non-destructive restore rehearsal (recommended monthly)

Verify backup integrity into an isolated scratch database inside `omnicourse-db` without touching `omnicourse_prod` or `omnicourse_stag`:

```bash
# 1. Pick the latest nightly production dump and verify gzip integrity
dump="$(ls -1t /var/backups/omnicourse/daily/prod-*.sql.gz | head -n 1)"
gzip -t "$dump"

# 2. Load into a disposable rehearsal database and verify schema + key tables
docker exec -i omnicourse-db psql -U postgres -v ON_ERROR_STOP=1 \
  -c "DROP DATABASE IF EXISTS omnicourse_rehearsal; CREATE DATABASE omnicourse_rehearsal;"
gunzip -c "$dump" | docker exec -i omnicourse-db psql -U postgres -v ON_ERROR_STOP=1 -d omnicourse_rehearsal
docker exec omnicourse-db psql -U postgres -d omnicourse_rehearsal \
  -c "SELECT count(*) AS migrations FROM migrations; SELECT count(*) AS courses FROM courses;"

# 3. Drop the rehearsal database
docker exec omnicourse-db psql -U postgres -c "DROP DATABASE omnicourse_rehearsal;"
```

### Emergency in-place restore

If a bad migration or operator error requires restoring an environment (`prod` or `stag`):

```bash
env=prod   # or stag (port 3102)
dump="/var/backups/omnicourse/daily/prod-YYYY-MM-DD.sql.gz"   # or a pre-deploy dump in /var/backups/omnicourse/

systemctl stop "omnicourse@$env"
/usr/local/sbin/omnicourse-root dump "$env"   # snapshot current state before overwriting
docker exec -i omnicourse-db psql -U postgres -v ON_ERROR_STOP=1 -d "omnicourse_$env" \
  -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public AUTHORIZATION omnicourse_$env;"
gunzip -c "$dump" | docker exec -i omnicourse-db psql -U "omnicourse_$env" -v ON_ERROR_STOP=1 -d "omnicourse_$env"
systemctl start "omnicourse@$env"
curl -fsS http://127.0.0.1:3101/api/health
```

## By hand

```bash
gh workflow run deploy.yml --ref main -f environment=production            # redeploy production
gh workflow run deploy.yml --ref staging -f environment=staging            # redeploy staging
gh workflow run reset-staging.yml                                         # reset staging to main now
gh workflow run deploy.yml --ref main -f environment=production -f build_tag=B1   # deploy and tag a build
```

On the host: `sudo -u omnicourse omnicourse-deploy <prod|stag> <commit>`, `systemctl list-timers 'omnicourse-*'`, `journalctl -u omnicourse@prod -u omnicourse-backup.service`, backups in `/var/backups/omnicourse` and `/var/backups/omnicourse/daily`.
