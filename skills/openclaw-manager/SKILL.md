---
name: openclaw-manager
description: Deploy, harden, and operate OpenClaw across Fly.io, Render, Railway, Hetzner, and GCP with production-safe defaults, channel setup guidance (Telegram/Discord/Slack), and troubleshooting workflows grounded in official OpenClaw documentation. Use when users need to install OpenClaw, migrate providers, configure channels, secure internet exposure, manage memory/agent behavior, or resolve ambiguous deployment/runtime issues.
---

# OpenClaw Manager

## Overview
Build and run a production-grade OpenClaw environment with secure defaults and predictable operations. Use this skill to plan, deploy, validate, and maintain OpenClaw across supported cloud providers while minimizing security and reliability risks.

Read references as needed:
- Deployment + product docs map: `references/openclaw-doc-map.md`
- Security hardening checklist: `references/openclaw-security-checklist.md`

Use scripts for repeatable checks:
- `scripts/validate_openclaw_env.py`
- `scripts/plan_openclaw_rollout.py`

## Workflow

### 1) Intake and Scope Lock
Collect:
- Target provider: `fly`, `render`, `railway`, `hetzner`, or `gcp`
- Domain model: direct internet exposure vs protected gateway
- Channels needed: `telegram`, `discord`, `slack`
- Required integrations: email/calendar and any external APIs
- Environment tier: `dev`, `staging`, `prod`

Output a concise scope summary before deployment work.

### 2) Build the Deployment Plan
Generate a provider-aware checklist first:

```bash
python3 scripts/plan_openclaw_rollout.py \
  --provider fly \
  --channels telegram,slack \
  --environment prod \
  --output /tmp/openclaw-rollout.md
```

Use that plan as the execution backbone and adjust only when user constraints require it.

### 3) Validate Secrets and Config Before Deploy
Always validate `.env` before touching infrastructure:

```bash
python3 scripts/validate_openclaw_env.py \
  --env-file .env \
  --require OPENCLAW_GATEWAY_TOKEN \
  --require OPENAI_API_KEY
```

Block deployment if any of the following occur:
- Missing required keys
- Placeholder secrets (`changeme`, `todo`, `your-key-here`, etc.)
- Duplicate env keys
- Malformed env lines

### 4) Deploy with Provider-Specific Playbook
Open the corresponding official install page from `references/openclaw-doc-map.md` and follow current provider instructions.

For Fly.io workflows, reuse proven patterns from existing Prompt Circle deployment automation when available.

Minimum deployment outputs:
- Service URL and health endpoint status
- Runtime logs check summary
- Persistence/storage configuration summary
- Secrets sync status summary

### 5) Configure Channels Safely
For each enabled channel (Telegram/Discord/Slack):
- Configure channel credentials through env-based secrets, never hardcoded values
- Verify webhook/token wiring with minimal test events
- Confirm auth boundaries between channel ingress and OpenClaw gateway

Document channel status as:
- `configured`
- `pending credentials`
- `blocked`

### 6) Configure Agent + Memory
Use official OpenClaw concept docs for:
- Agent behavior boundaries and expected actions
- Memory mode and persistence choices

Decide and record:
- Memory persistence strategy
- Data retention expectations
- Recovery behavior after restart

### 7) Security Hardening Pass (Mandatory)
Run the checklist in `references/openclaw-security-checklist.md` and produce a pass/fail table.

Never skip:
- Secret rotation plan
- Principle of least privilege for tokens/keys
- Web exposure hardening and gateway protection
- Log review for sensitive data leakage
- Dependency/image update posture

### 8) Ambiguity Resolution Protocol
When behavior is unclear or docs are ambiguous:
1. Reproduce the issue with exact provider/channel context.
2. Open the exact official docs page for the active component.
3. Compare current config against documented required settings.
4. Form a minimal hypothesis and test one change at a time.
5. Record: symptom, root cause, fix, and preventive guardrail.

Do not patch blindly. Always anchor fixes to documented behavior or explicit runtime evidence.

## Output Contract
Always return:
1. Deployment/provider status summary
2. Security checklist results
3. Channel setup matrix
4. Agent + memory config summary
5. Follow-up actions (if any) ordered by risk
