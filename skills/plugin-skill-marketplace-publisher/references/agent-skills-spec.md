# Agent Skills Spec Reference

Source docs:
- https://agentskills.io/home
- https://agentskills.io/specification

## Required `SKILL.md` Frontmatter
Agent Skills-spec files require YAML frontmatter with:
- `name`
- `description`

The `description` is the trigger contract. Include concrete "when to use" conditions.

## Skill File Shape
Minimum:
1. Frontmatter (`name`, `description`)
2. Markdown body with actionable instructions

Recommended:
- Keep core workflow in `SKILL.md`.
- Move detailed docs into `references/`.
- Add scripts only for deterministic repeated operations.

## Prompt Circle Conventions
- Public shared skills: `Codex Skills/<skill-name>/SKILL.md`
- Internal-only skills: `Codex Skills/internal/<skill-name>/SKILL.md` or `internal-` slug prefix
- Avoid mixing internal workflows with public catalog listings.
