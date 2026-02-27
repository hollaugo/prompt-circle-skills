---
name: crm-inbound-orchestrator
description: Hourly CRM inbound orchestrator for three inboxes using Notion-synced SOP, strict business-lead filtering, Supabase persistence, and actionable-only Slack reporting.
homepage: https://docs.openclaw.ai/automation/cron-jobs
metadata:
  {
    "openclaw":
      {
        "emoji": "📥",
        "requires":
          {
            "bins": ["tsx", "gog"],
            "env":
              [
                "NOTION_API_KEY",
                "CRM_SOP_PAGE_ID",
                "CRM_MONITORED_EMAILS",
                "CRM_POLL_QUERY",
                "CRM_POLL_OVERLAP_MINUTES",
                "SUPABASE_URL",
                "SUPABASE_SECRET_KEY",
              ],
          },
      },
  }
---

# CRM Inbound Orchestrator

Use this skill for hourly polling CRM workflows across:

- `pat.ugosuji@gmail.com`
- `info@promptcircle.com`
- `ugo@promptcircle.com`

The source-of-truth SOP is synced from Notion page `CRM_SOP_PAGE_ID` every run.

## Runtime Env Contract

Required:

- `NOTION_API_KEY`
- `CRM_SOP_PAGE_ID` (default: `31288fb313488013924ade7bf704ab6f`)
- `CRM_MONITORED_EMAILS` (comma-separated)
- `CRM_POLL_QUERY` (default: `in:inbox is:unread -in:spam -in:trash -category:promotions -category:social -category:updates -category:forums`)
- `CRM_POLL_OVERLAP_MINUTES` (default: `120`)
- `SUPABASE_URL`
- `SUPABASE_SECRET_KEY`

Optional:

- `CRM_POLL_MAX_RESULTS` (default: `200`)
- `CRM_POLL_MAX_AGE_HOURS` (default: `36`)
- `CRM_SOP_CACHE_FILE` (default: `/tmp/crm-inbound-sop-cache.json`)
- `CRM_POLL_STATE_TABLE` (default: `crm_poll_state`)
- `CRM_CONTACTS_TABLE` (default: `crm_contacts`)
- `CRM_ACTIVITIES_TABLE` (default: `crm_activities`)
- `CRM_DRAFTS_TABLE` (default: `crm_drafts`)
- `CRM_ACCOUNTING_TABLE` (default: `accounting_entries`)
- `CRM_JOB_RUNS_TABLE` (default: `crm_job_runs`)
- `GOG_ACCOUNT` (fallback sender account for approvals)
- `CRM_OUTSTANDING_LOOKBACK_DAYS` (default: `7`)
- `CRM_OUTSTANDING_STALE_HOURS` (default: `24`)
- `CRM_OUTSTANDING_NOTIFY_EMPTY` (default: `false`)
- `CRM_CLASSIFIER_MODEL` (default: `gpt-5-nano`)
- `CRM_REPLY_MODEL` (default: `gpt-5.2`)
- `CRM_USE_MODEL_CLASSIFIER` (default: `true`)
- `CRM_USE_MODEL_REPLY_WRITER` (default: `true`)
- `OPENAI_API_KEY` (required to use model classifier/reply writer)
- `CRM_GMAIL_LABEL_APPLY` (default: `true`)
- `CRM_GMAIL_LABEL_LEAD` (default: `CRM/Lead`)

## Deterministic Command Surface

### 1) Fetch Notion SOP

```bash
tsx {baseDir}/scripts/fetch-sop.ts fetch_sop
```

Optional flags:

- `--page-id <id>`
- `--cache-file <path>`
- `--output <path>`

### 2) Poll Inboxes Hourly

```bash
tsx {baseDir}/scripts/poll-inboxes.ts poll_inboxes
```

Optional flags:

- `--accounts <csv>`
- `--query <gmail-query>`
- `--overlap-minutes <n>`
- `--max-age-hours <n>`
- `--output <path>`

### 3) Classify + Route + Persist

```bash
tsx {baseDir}/scripts/process-inbound.ts process_inbound \
  --poll-file /tmp/crm-poll.json
```

Optional flags:

- `--sop-file <path>`
- `--output <path>`

### 4) Approval Actions

```bash
tsx {baseDir}/scripts/approval-action.ts approval_action \
  --action approve \
  --draft-id <draft_id> \
  --approved-by "U052337J8QH"
```

Also supported:

- `--action revise --notes "<feedback>"`
- `--action reject --reason "<reason>"`

### 5) Morning Outstanding Check (Actionable-Only Report)

```bash
tsx {baseDir}/scripts/check-outstanding.ts check_outstanding
```

Optional flags:

- `--lookback-days <n>` (default: `7`)
- `--stale-hours <n>` (default: `24`)
- `--output <path>`

## Slack Output Contract (Non-Technical Friendly)

For each actionable lead, post a simple Slack card containing only:

- Mailbox
- Subject
- Message received
- When it was sent
- Suggested response

Approval/revision happens in the Slack thread, not via command strings in the main message.

## Workflow Rules

1. Poll hourly from all configured inboxes.
2. Deduplicate by `account_email:message_id`.
3. Classify with `gpt-5-nano` into `receipt|sales|support|ignore` (fallback to heuristics only if model call fails).
4. Pull classification policy dynamically from Notion SOP sections (`classification`, `lead`, `inbound`, `routing`, `qualification`) and inject it into the classifier prompt.
5. Deterministic lead override: expert-network, consulting, sponsorship, partnership, and creator-collaboration outreach is forced to `sales` when business ask is explicit.
6. Apply Gmail label `CRM/Lead` (or `CRM_GMAIL_LABEL_LEAD`) to `sales` threads.
7. Deterministic hard-ignore override: newsletter/digest/vendor-blast patterns (`view in browser`, `unsubscribe`, `manage preferences`, roundup-style blasts, Gmail promotional categories) are forced to `ignore` unless explicit lead criteria are met.
8. Notification gate: only explicit business leads can create drafts and Slack notifications; model-only `sales` guesses are downgraded to `ignore`.
9. Sales path:
   - upsert contact
   - log activity
   - apply SOP context from Notion snapshot
   - create draft only for human, direct business inquiries (consulting/sponsorship/partnership intent)
   - craft suggested response with `gpt-5.2`
10. Accounting path:
   - parse vendor/date/amount/currency
   - upsert accounting entry
11. No send side effects until manual approval in Slack thread.
12. Slack reporting policy:
   - no hourly heartbeat/status spam
   - hourly posts only when actionable
   - morning 9:20 post provides outstanding summary (including "none" when empty)

## Notion SOP Structure (Recommended)

Use clear headings in your Notion page so policy extraction stays deterministic:

1. `Business Context`
   - what Prompt Circle does
   - ideal inbound opportunities
2. `Lead Classification Rules`
   - **Lead (`sales`)**: person/company reaching out for consulting, sponsorship, partnerships, affiliate opportunities, expert-network interviews, or any paid advisory call
   - **Ignore**: newsletters, product updates, system/vendor notifications, job alerts, hiring spam, social digests
   - **Support**: requests for help with your product/service
   - **Receipt**: invoices/payment confirmations
3. `Lead Qualification Checklist`
   - commercial intent present
   - human sender (not no-reply/automated digest)
   - asks for a call/brief/proposal/timeline/budget or paid expertise
4. `Response Playbook`
   - tone
   - what to ask for next (brief, timeline, deliverables, budget)
   - when to decline
5. `Out-of-Scope`
   - examples you never want treated as leads

Reference template:

```bash
cat {baseDir}/references/notion-inbound-sop-template.md
```

## Data Contract

Tables:

- `crm_contacts`
- `crm_activities`
- `crm_drafts`
- `accounting_entries`
- `crm_job_runs`
- `crm_poll_state`

Reference DDL:

```bash
cat {baseDir}/references/supabase-schema.sql
```

## Hourly Cron Setup (No Hourly Announce Spam)

```bash
openclaw cron add \
  --name "CRM hourly polling" \
  --cron "0 * * * *" \
  --tz "America/New_York" \
  --session isolated \
  --message "Run crm-inbound-orchestrator hourly polling cycle. Use skill crm-inbound-orchestrator. Run fetch_sop, poll_inboxes, process_inbound. Only report actionable items."
```

## Morning 9:20 Outstanding Sweep

```bash
openclaw cron add \
  --name "CRM morning outstanding check" \
  --cron "20 9 * * *" \
  --tz "America/Toronto" \
  --session isolated \
  --message "Run crm-inbound-orchestrator outstanding review. Use skill crm-inbound-orchestrator. Run check_outstanding for last 7 days and post a concise summary to Slack."
```

## Safety

- Do not log secrets or tokens.
- If Notion fetch fails, use cached SOP and report `degraded`.
- If one inbox fails, continue others and report partial failure.
- Keep outbound email behind explicit approval action.
