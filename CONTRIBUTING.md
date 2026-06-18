# Contributing to Prompt Circle Skills

Thank you for contributing to the Prompt Circle Skills repository! This document outlines guidelines for adding, modifying, and maintaining skills.

## Repository Structure

```
prompt-circle-skills/
├── skills/
│   └── <skill-slug>/
│       ├── SKILL.md          # Required: Skill definition
│       ├── scripts/          # Optional: Automation scripts
│       └── references/       # Optional: Documentation
├── packages/
│   └── <skill-slug>/         # Auto-generated: Distributable packages
│       └── <skill-slug>-skill.zip
├── manifests/
│   └── skills.json           # Auto-generated: Skill catalog with checksums
└── docs/                     # Additional documentation
```

## Adding a New Skill

1. **Create the skill folder**:
   ```bash
   mkdir -p skills/<your-skill-slug>
   ```

2. **Add `SKILL.md`**:
   - Required frontmatter fields:
     ```markdown
     ---
     name: Your Skill Name
     description: Brief description of what the skill does
     version: 0.1.0
     author: Your Name
     status: draft  # or published
     ---
     ```

3. **Add documentation** in `references/` (optional but recommended):
   - Tool references
   - Prompt patterns
   - Setup playbooks

4. **Add scripts** in `scripts/` (optional):
   - Use Python 3.10+
   - Include type hints
   - Use `argparse` for CLI interfaces
   - Add shebang: `#!/usr/bin/env python3`

5. **Update the manifest** (or run `scripts/generate_manifest.py`):
   ```bash
   python scripts/generate_manifest.py
   ```

## Skill Metadata (SKILL.md)

Every skill must have a `SKILL.md` file with the following structure:

```markdown
---
name: Skill Name
slug: skill-slug  # lowercase, hyphen-separated
description: Detailed description of the skill's purpose and capabilities
version: 0.1.0   # Semantic versioning
status: draft     # draft, published, deprecated
author: Author Name
tags:
  - tag1
  - tag2
requires:
  - requirement1
  - requirement2
---

## Skill Description

Detailed description of what the skill does, its use cases, and any prerequisites.

## Usage

Instructions on how to use the skill.

## Configuration

Any configurable options or environment variables.

## Examples

Example prompts or workflows.
```

## Scripting Guidelines

### Python Scripts

- **Style**: Follow PEP 8
- **Type Hints**: Use Python type hints for all functions
- **Error Handling**: Wrap external API calls in try/except blocks
- **Logging**: Use the `logging` module instead of `print()`
- **Dependencies**: Minimize external dependencies; use standard library when possible

### Shared Utilities

Place reusable code in `scripts/utils/`:
- `http.py`: Unified HTTP client
- `config.py`: Shared configurations
- `logging.py`: Logging setup

## Testing

- Add unit tests in a `tests/` directory
- Use `pytest` as the test runner
- Test core logic, not just CLI parsing

## Versioning

- Use [Semantic Versioning](https://semver.org/): `MAJOR.MINOR.PATCH`
- `MAJOR`: Breaking changes
- `MINOR`: Backwards-compatible new features
- `PATCH`: Backwards-compatible bug fixes

## Releasing a Skill

1. Update the version in `SKILL.md`
2. Run the packaging script:
   ```bash
   python scripts/package_skill.py <skill-slug>
   ```
3. Update `manifests/skills.json`:
   ```bash
   python scripts/generate_manifest.py
   ```
4. Commit changes and open a PR

## Code Review Process

1. Open a draft PR with your changes
2. Ensure all CI checks pass
3. Request review from maintainers
4. Address feedback and update the PR
5. Once approved, the PR will be merged

## Reporting Issues

- Use GitHub Issues to report bugs or request features
- Include:
  - Clear description of the issue
  - Steps to reproduce
  - Expected vs. actual behavior
  - Relevant logs or error messages
