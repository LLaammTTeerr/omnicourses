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
                                                              switch current → restart → /api/health
                                                              unhealthy → switch back, fail the job
```

- Each GitHub environment (`production`, `staging`) has its own SSH key. On the host, the key is pinned to its environment by `command="/usr/local/bin/omnicourse-deploy <env>",restrict`: it can't open a shell, and it only deploys commits already on that environment's branch.
- The environments' secrets are `DEPLOY_SSH_KEY`, `DEPLOY_KNOWN_HOSTS` and `DEPLOY_HOST`. The host address stays out of this public repository: it is also qhhoj.com's origin.
- GitHub only lets `production` deploy from `main`, and `staging` from `staging`.
- A rollback restores the previous code, not the database. Restore a backup by hand if a migration was the problem.

## The host

`deploy/server/setup.sh` (as root) sets everything up and can be re-run safely:

- user `omnicourse`, with no sudo except `omnicourse-root restart|dump <env>`;
- Node 22.22.1 and npm 11.21.1 in `/opt/omnicourse/node`, the host's own Node untouched;
- PostgreSQL 18.6 in Docker (`omnicourse-db`, `127.0.0.1:5433`), one database and role per environment;
- `/etc/omnicourse/<env>.env` (generated passwords never leave the host; staging's adds `API_DOCS=true`, so only staging serves `/api/docs`);
- systemd `omnicourse@prod` (port 3101) and `omnicourse@stag` (3102): 1 GB memory, cores 0–1, hardened;
- nginx sites that accept only Cloudflare and serve the SPA plus `/api`.

Other sites share the host. Keep OmniCourse inside these limits, and never touch their services.

First-time steps after `setup.sh`:

1. `deploy/server/add-deploy-key.sh <prod|stag> '<public key>'` for each environment's key.
2. With both DNS names proxied to the host: `certbot certonly --nginx -d <host>` for each, then re-run `setup.sh` to turn on HTTPS.

## By hand

```bash
gh workflow run deploy.yml --ref main -f environment=production            # redeploy production
gh workflow run deploy.yml --ref staging -f environment=staging            # redeploy staging
gh workflow run reset-staging.yml                                         # reset staging to main now
gh workflow run deploy.yml --ref main -f environment=production -f build_tag=B1   # deploy and tag a build
```

On the host: `sudo -u omnicourse omnicourse-deploy <prod|stag> <commit>`, `journalctl -u omnicourse@prod`, backups in `/var/backups/omnicourse`.
