---
name: plugin-skill-marketplace-publisher
description: Create either a Claude Code plugin package or an Agent Skills-spec skill, publish it into the Prompt Circle marketplace structure, and sync listing metadata into Prompt Circle website database seed data. Use when a user asks to add, update, or publish marketplace skills/plugins with database alignment.
---

# Plugin + Skill Marketplace Publisher

## Overview
Ship one of two deliverables:
1. Claude plugin package (`plugins/<plugin-name>/...`) with installable marketplace metadata.
2. Agent Skills-spec/Codex skill source (`docs/product/skills/<skill-name>/...`) with marketplace-ready metadata.

Always finish by:
1. syncing website seed metadata in `/Users/uosuji/prompt-circle-phoenix/prompt-circle-website/supabase/seed.sql`
2. publishing distributable skill artifacts to `hollaugo/prompt-circle-private-skills`

Hard rule:
- This repo is the source authoring workspace.
- `hollaugo/prompt-circle-private-skills` is the distribution source for skill ingestion/download.

Load references only when needed:
- Claude plugin details: `references/claude-plugins.md`
- Agent Skills format details: `references/agent-skills-spec.md`

## Decide Deliverable Type
Choose exactly one path before writing files.

Use **Plugin path** when user asks for:
- Claude plugin installability (`/plugin install ...`)
- multi-skill package distribution
- plugin marketplace listing updates

Use **Skill path** when user asks for:
- a standalone `SKILL.md`
- Codex/Agent Skills distribution without plugin packaging
- internal/public skill publishing only

## Workflow A: Claude Plugin Package
1. Gather: plugin name, version, description, author, license, entrypoint, and whether skills are public or internal.
2. Create plugin folder under marketplace repo shape:
   - `plugins/<plugin-name>/.claude-plugin/config.json`
   - `plugins/<plugin-name>/skills/<skill-name>/SKILL.md` (for each bundled skill)
3. Add plugin manifest fields required by Claude plugin spec (`name`, `version`, `description`, `author`, `license`, `entrypoint`).
4. Update plugin marketplace manifest (`.claude-plugin/marketplace.json`) with the plugin `name`, `version`, `description`, and `source`.
5. Validate locally with Claude plugin commands:
   - `/plugin validate .`
   - `/plugin marketplace add <source>`
   - `/plugin install <plugin-name>@<source>`
6. Ensure plugin skills are discoverable and install instructions are copy-ready.

## Workflow B: Agent Skills-spec / Codex Skill
1. Normalize skill slug to lowercase-hyphen format.
2. Create `SKILL.md` with required frontmatter fields only:
   - `name`
   - `description` (must include trigger scenarios)
3. Place source in this repo at `docs/product/skills/<skill-name>/`.
4. Add concise workflow instructions and reference files only when needed.
5. Publish to private repo using:
   - `scripts/ops/publish_skill_to_private_repo.sh --skill-slug <slug> --private-repo-path <path> --version <version> --status draft`
6. Validate structure and naming before publish.

## Sync Prompt Circle Website Database
After plugin or skill files are complete, update `/Users/uosuji/prompt-circle-phoenix/prompt-circle-website/supabase/seed.sql`:
1. Add or update the `skills` row (slug, name, description, content, source metadata).
2. Set `source_type`, `source_url`, `author_name`, `author_url`, `license`.
3. Set discovery fields: `platform_targets`, `topics`, `difficulty_level`, `use_cases`.
4. Keep internal-only entries unpublished (`is_published = FALSE`).

Then verify:
1. `npm run db:migrate:dev`
2. `npm run build:web`
3. Review `/skills` for public content only and plugin listing correctness.
4. Confirm private repo manifest/package hash updates for the published skill.

## Output Contract
When executing this skill, always return:
1. What was created: plugin package or standalone skill.
2. Exact files changed.
3. Install/use commands (copy-paste ready).
4. Database seed sync status.
5. Validation results and any unresolved follow-ups.
