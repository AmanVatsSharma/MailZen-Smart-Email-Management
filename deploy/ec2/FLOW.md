# MailZen EC2 Deployment Flows

This file documents the operational flowcharts for the EC2 Docker deployment
module.

## 1) First launch flow (recommended)

```mermaid
flowchart TD
  Start[Operator runs launch.sh] --> Setup[setup.sh]
  Setup --> EnvOK{env valid?}
  EnvOK -- no --> FixEnv[Fix env inputs/placeholders]
  FixEnv --> Setup
  EnvOK -- yes --> DnsCheck[dns-check.sh]
  DnsCheck --> SslCheck[ssl-check.sh]
  SslCheck --> PortsCheck[ports-check.sh]
  PortsCheck --> Preflight[preflight.sh]
  Preflight --> ComposeConfig{compose config ok?}
  ComposeConfig -- no --> FixConfig[Fix env or compose file]
  FixConfig --> Preflight
  ComposeConfig -- yes --> Deploy[deploy.sh]
  Deploy --> Verify[verify.sh]
  Verify --> VerifyOK{smoke checks pass?}
  VerifyOK -- no --> Logs[logs.sh + status.sh troubleshooting]
  Logs --> FixAndRedeploy[update.sh or deploy.sh --force-recreate]
  FixAndRedeploy --> Verify
  VerifyOK -- yes --> Done[Deployment complete]
```

## 2) Update flow

```mermaid
flowchart TD
  UpdateStart[Operator runs update.sh] --> Preflight[preflight.sh]
  Preflight --> DeployPull[deploy.sh --pull --force-recreate]
  DeployPull --> Verify[verify.sh]
  Verify --> UpdateDone[Update complete]
```

## 3) Database recovery flow

```mermaid
flowchart TD
  BackupStart[backup-db.sh] --> BackupFile[Compressed SQL backup in deploy/ec2/backups]
  BackupFile --> Incident{Need rollback/recovery?}
  Incident -- no --> KeepBackup[Retain backup]
  Incident -- yes --> Restore[rollback-latest.sh or restore-db.sh backup.sql.gz]
  Restore --> Confirm[Type RESTORE confirmation]
  Confirm --> RecreateDB[Drop + recreate database]
  RecreateDB --> ImportDump[Import SQL dump]
  ImportDump --> VerifyApp[Run verify.sh]
```

## 4) Operational guardrails

- Always run `preflight.sh` before deploy/update.
- Prefer `verify.sh` immediately after deploy/update.
- Take a fresh `backup-db.sh` before risky changes.
- Periodically run `backup-prune.sh` to enforce backup retention.
- Run `env-audit.sh` whenever secrets/domains are updated.
- Run `doctor.sh` and share report output during incident triage.
- Run `support-bundle.sh` to package diagnostics for escalation/support.
- Use `rotate-app-secrets.sh` for controlled JWT/OAuth/platform key rotation.
- Run `pipeline-check.sh` for CI/config-only deployment validation.
- Use `self-check.sh` after editing deployment scripts.
