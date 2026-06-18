# prompt-circle-private-skills

Private paid Prompt Circle skills repository.

## Layout
- `skills/<slug>/`: Source skill folder (SKILL.md + resources)
- `packages/<slug>/`: Distributable zip packages (auto-generated)
- `manifests/skills.json`: Programmatic catalog of available skills and package checksums (auto-generated)
- `scripts/`: Automation and utility scripts
- `.github/workflows/`: CI/CD pipelines

## Current Skills
- `accounting-reconciliation` (published)
- `business-flow-diagrams` (published)
- `mcp-app-builder` (published)
- `openclaw-manager` (published)
- `openclaw-shopify` (published)
- `plugin-skill-marketplace-publisher` (draft)
- `website-manager` (published)

## Quick Start

### Adding a New Skill

1. Create a new skill directory:
   ```bash
   mkdir -p skills/my-new-skill
   ```

2. Add a `SKILL.md` file with frontmatter metadata:
   ```markdown
   ---
   name: My New Skill
   slug: my-new-skill
   description: A brief description
   version: 0.1.0
   status: draft
   author: Your Name
   ---
   ```

3. Add documentation in `references/` and scripts in `scripts/` as needed.

4. Generate the manifest:
   ```bash
   python scripts/generate_manifest.py
   ```

### Packaging a Skill

To create a distributable package:
```bash
cd skills/my-new-skill
zip -r ../../packages/my-new-skill/my-new-skill-skill.zip .
```

Then update the manifest:
```bash
python scripts/generate_manifest.py
```

## Scripts

| Script | Description |
|--------|-------------|
| `scripts/generate_manifest.py` | Generate `manifests/skills.json` from skill directories |

## Development

See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed guidelines on:
- Skill development
- Scripting standards
- Testing
- Versioning and releasing

## License

This repository is licensed under the MIT License. See [LICENSE](LICENSE) for details.
