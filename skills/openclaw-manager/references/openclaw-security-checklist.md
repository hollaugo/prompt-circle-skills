# OpenClaw Security Checklist

Use this checklist before considering production deployment complete.

## Secrets and Credentials
- [ ] Keep all secrets in environment variables or provider secret manager.
- [ ] Remove placeholder values (`changeme`, `todo`, test tokens).
- [ ] Scope tokens to least privilege.
- [ ] Document secret rotation cadence.

## Edge and Network Exposure
- [ ] Expose only required ports/routes.
- [ ] Protect gateway endpoints with strong auth tokens.
- [ ] Enforce HTTPS/TLS at edge.
- [ ] Restrict admin/debug endpoints from public internet.

## Channels (Telegram/Discord/Slack)
- [ ] Validate incoming signatures/tokens where supported.
- [ ] Separate channel auth secrets per environment.
- [ ] Confirm failed auth attempts are logged without leaking sensitive payloads.

## Runtime and Persistence
- [ ] Verify persistent storage mount/path and access rights.
- [ ] Confirm restart behavior does not corrupt memory/state.
- [ ] Encrypt backups and restrict backup access.

## Logging and Monitoring
- [ ] Redact secrets/tokens from logs.
- [ ] Capture startup + health + error signals.
- [ ] Configure alerting for repeated auth failures and gateway errors.

## Dependency and Supply Chain
- [ ] Use pinned container/image versions where possible.
- [ ] Track upstream security advisories.
- [ ] Rebuild and redeploy on critical vulnerabilities.

## Incident Readiness
- [ ] Document rollback steps.
- [ ] Document token revocation steps.
- [ ] Keep an operator runbook for common outage scenarios.
