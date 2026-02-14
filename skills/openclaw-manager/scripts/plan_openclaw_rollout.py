#!/usr/bin/env python3
"""Generate a provider-aware OpenClaw rollout checklist."""

from __future__ import annotations

import argparse
from datetime import datetime, timezone
from pathlib import Path

PROVIDER_LINKS = {
    "fly": "https://docs.openclaw.ai/install/fly",
    "render": "https://docs.openclaw.ai/install/render",
    "railway": "https://docs.openclaw.ai/install/railway",
    "hetzner": "https://docs.openclaw.ai/install/hetzner",
    "gcp": "https://docs.openclaw.ai/install/gcp",
}

CHANNEL_LINKS = {
    "telegram": "https://docs.openclaw.ai/channels/telegram",
    "discord": "https://docs.openclaw.ai/channels/discord",
    "slack": "https://docs.openclaw.ai/channels/slack",
}


def parse_channels(raw: str) -> list[str]:
    channels = [c.strip().lower() for c in raw.split(",") if c.strip()]
    invalid = [c for c in channels if c not in CHANNEL_LINKS]
    if invalid:
        raise ValueError(f"Unsupported channels: {', '.join(invalid)}")
    return channels


def render(provider: str, channels: list[str], environment: str) -> str:
    now = datetime.now(timezone.utc).isoformat()
    provider_url = PROVIDER_LINKS[provider]

    lines = [
        "# OpenClaw Rollout Plan",
        "",
        f"- Generated: {now}",
        f"- Provider: {provider}",
        f"- Environment: {environment}",
        "",
        "## 1. Preflight",
        "- [ ] Confirm deployment scope and rollback owner.",
        "- [ ] Validate `.env` with `scripts/validate_openclaw_env.py`.",
        "- [ ] Confirm secure secret storage in provider dashboard/CLI.",
        "",
        "## 2. Deployment",
        f"- [ ] Follow official provider guide: {provider_url}",
        "- [ ] Configure persistent state storage before first traffic.",
        "- [ ] Deploy and capture app URL + health checks.",
        "- [ ] Verify logs show healthy startup without secret leakage.",
        "",
        "## 3. Channels",
    ]

    if channels:
        for channel in channels:
            lines.append(f"- [ ] Configure {channel}: {CHANNEL_LINKS[channel]}")
            lines.append(f"- [ ] Send {channel} smoke-test message and verify response path.")
    else:
        lines.append("- [ ] No channels selected for this rollout.")

    lines.extend(
        [
            "",
            "## 4. Agent + Memory",
            "- [ ] Confirm agent behavior constraints align with intended use.",
            "- [ ] Confirm memory persistence and restart behavior.",
            "",
            "## 5. Security",
            "- [ ] Apply references/openclaw-security-checklist.md and mark pass/fail.",
            "- [ ] Verify gateway protection and token rotation plan.",
            "",
            "## 6. Handover",
            "- [ ] Record deployment details, risks, and follow-ups.",
            "- [ ] Share operator runbook and escalation path.",
            "",
        ]
    )

    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate OpenClaw rollout checklist")
    parser.add_argument("--provider", required=True, choices=sorted(PROVIDER_LINKS))
    parser.add_argument("--channels", default="", help="Comma-separated channels: telegram,discord,slack")
    parser.add_argument("--environment", default="prod", help="Environment label (dev/staging/prod)")
    parser.add_argument("--output", required=True, help="Output markdown file")
    args = parser.parse_args()

    try:
        channels = parse_channels(args.channels) if args.channels else []
    except ValueError as err:
        print(f"[ERROR] {err}")
        return 1

    content = render(args.provider, channels, args.environment)
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(content)

    print(f"[OK] Wrote rollout plan: {output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
