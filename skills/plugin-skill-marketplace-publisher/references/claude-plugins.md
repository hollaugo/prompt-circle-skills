# Claude Plugins Reference

Source docs:
- https://code.claude.com/docs/en/plugins
- https://code.claude.com/docs/en/plugins/create-a-plugin
- https://code.claude.com/docs/en/plugins/plugin-marketplaces
- https://code.claude.com/docs/en/plugins/discover-plugins

## Core Concepts
- Claude plugins are installable packages that can bundle skills, commands, and hooks.
- Local plugin config and metadata are stored under `.claude-plugin/`.
- Marketplace distribution supports GitHub, local path, tarball, and URL sources.

## Required Plugin Metadata
For plugin config (`.claude-plugin/config.json`), include:
- `name`
- `version`
- `description`
- `author`
- `license`
- `entrypoint`

Keep plugin names stable and semantic-versioned.

## Key Claude Commands
- `/plugin create` to scaffold.
- `/plugin validate .` to check structure.
- `/plugin install .` for local install.
- `/plugin install <name>@<source>` for marketplace install.
- `/plugin marketplace add <source>` to register a marketplace.
- `/plugin marketplace remove <source>` to remove one.

## Marketplace JSON Shape
`marketplace.json` plugin entries include:
- `name`
- `version`
- `description`
- `source`

Use repository-relative source paths and keep each plugin entry aligned with plugin folder names.
