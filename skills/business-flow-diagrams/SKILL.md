---
name: business-flow-diagrams
description: >
  Create professional, presentation-ready Excalidraw diagrams for business flows,
  system architectures, pipelines, and process maps using the official
  excalidraw/excalidraw-mcp server. Use this skill whenever the user asks to draw,
  diagram, visualize, map, or create any kind of flowchart, architecture, process flow,
  pipeline, or workflow. Default output is the interactive Excalidraw MCP result and a
  shareable/openable Excalidraw link when the server or client surfaces one.
---

# Business Flow Diagrams

This skill uses the official [`excalidraw/excalidraw-mcp`](https://github.com/excalidraw/excalidraw-mcp)
server as the default path for diagram work.

Primary goal:
- Produce the diagram through the MCP app server, not by hand-writing `.excalidraw` JSON.
- Return the interactive Excalidraw result in chat and include a shareable/openable link when available.
- Do not create PowerPoint files unless the user explicitly asks for one.

Read:
- `references/design-system.md` for colors, spacing, grouping, and visual quality.
- `references/prompt-patterns.md` for prompt shapes that reliably produce good diagrams.

Do not default to `references/tool-reference.md`. That file is for the older multi-tool canvas workflow and is now fallback-only.

---

## Default Behavior

Always prefer the official remote MCP server:
- Server: `https://mcp.excalidraw.com`
- Upstream repo: `https://github.com/excalidraw/excalidraw-mcp`

Normal workflow:
1. Understand the requested system/process clearly.
2. Translate it into a concise, structured diagram prompt.
3. Send that prompt to the Excalidraw MCP app.
4. Let the MCP app generate the diagram.
5. Return the rendered app result and a link if one is exposed by the server/client.

Default deliverable:
- Interactive Excalidraw diagram via MCP app
- Excalidraw link if available

Do not:
- Generate PowerPoint decks by default
- Hand-author raw Excalidraw JSON by default
- Fall back to a different Excalidraw MCP server unless the official one is unavailable or the user explicitly asks

---

## Output Policy

Preferred outputs, in order:
1. MCP app-rendered diagram in chat
2. Shareable/openable Excalidraw link
3. `.excalidraw` or raw JSON only if the user explicitly asks, or if MCP output is unavailable

If the client/server exposes a direct Excalidraw link, include it plainly in the response.

If the MCP app renders inline but does not expose a portable link, say that directly and do not invent one.

---

## Expected Output

The expected output is not merely "a diagram exists." It must be visually clean enough to present.

For a good final result, the diagram should:
- read clearly in 3-5 seconds
- avoid crossed lines unless absolutely unavoidable
- avoid overlapping elements
- keep all text fully inside its boxes
- use a small number of strong visual groupings
- separate shared infrastructure from flow-specific steps

When the system contains multiple independent flows:
- prefer a single clean overview diagram plus separate per-flow diagrams when clarity benefits
- if the flows need to be compared directly, prefer side-by-side columns
- if each flow has a clear progression, prefer top-to-bottom reading inside each flow

For architecture diagrams with multiple automations, the preferred output shape is:
1. overview architecture diagram
2. optional per-flow detail diagrams

Do not force everything into one dense canvas if splitting the story creates a cleaner result.

---

## Prompting Rules

When sending a request to the MCP app, structure the prompt with:
- Diagram type
- Actors/systems
- Flow direction
- Main stages
- Shared infrastructure
- Style constraints

Use compact, explicit language. Example template:

```text
Draw a clean Excalidraw architecture diagram for [NAME].

Type: [business flow | system architecture | pipeline | swimlane]
Flow direction: [left-to-right | top-to-bottom | swimlane]
Actors/systems:
- ...

Main steps:
1. ...
2. ...
3. ...

Shared infrastructure:
- ...

Style:
- presentation-ready
- clearly grouped containers
- distinct colors for each major flow
- labeled arrows
- separate shared-infrastructure section
```

Keep prompts specific enough to avoid missing components, but avoid over-specifying pixel-level coordinates unless the user asks for exact layout.

---

## Visual Standards

Apply the design language from `references/design-system.md`:
- Distinct container per major flow
- Consistent spacing and alignment
- Color-code flows, not every individual node
- Label arrows with the meaning of the flow
- Separate owned systems from external/shared infrastructure
- Keep diagrams presentation-ready and readable at a glance

Layout preference order:
- top-to-bottom for automated workflows, processing pipelines, and trigger-to-outcome stories
- side-by-side top-to-bottom columns when there are multiple independent flows
- layered overview when showing triggers, orchestration, and shared infrastructure together
- left-to-right only when the story is truly linear and remains uncluttered

For architecture diagrams:
- Put shared services in a dedicated zone
- Keep triggers/input surfaces visually distinct from processing stages
- Prefer a layered overview with shared services in a bottom or side band
- Use side-by-side flow columns when comparing multiple automations
- Minimize diagonal cross-zone arrows

For business workflows:
- Prefer top-to-bottom for sequential automations
- Prefer swimlanes when multiple teams or actors hand work off between lanes

For multi-flow automation systems:
- use one container per flow
- keep the internal flow direction consistent across all flows
- use a shared infrastructure band only for systems reused by multiple flows
- do not label every cross-flow relationship if the layout already makes the relationship obvious

---

## Recommended MCP Setup

The upstream README currently recommends the remote server:
- `https://mcp.excalidraw.com`

If the client supports custom MCP connectors, configure:

```json
{
  "mcpServers": {
    "excalidraw": {
      "url": "https://mcp.excalidraw.com"
    }
  }
}
```

The upstream repo also documents a local build path, but remote is the default and preferred route for this skill.

---

## Fallback Rules

Use fallback behavior only when necessary:

1. If the official MCP server is available:
   - Use it
   - Return the app result and link if available

2. If the official MCP server is unavailable but the user still needs a diagram:
   - Explain that the preferred server path is unavailable
   - Offer a fallback `.excalidraw` file or JSON only if the user agrees or explicitly asked for it

3. If the user explicitly requests iterative canvas editing or low-level element control:
   - Use the `yctimlin/mcp_excalidraw` canvas workflow as the refinement path
   - Say clearly that this is a refinement/fallback path

4. If the one-shot diagram is structurally correct but visually messy:
   - Switch to iterative refinement
   - Rebuild the layout rather than polishing a bad structure
   - Prefer fewer arrows, more whitespace, and stronger grouping

---

## Response Rules

When the diagram succeeds through the MCP app:
- Keep the response short
- Point the user to the rendered result
- Include the Excalidraw link if present

When the server does not provide a link:
- Say that the diagram rendered through the MCP app
- Say that no portable link was surfaced in the response

When blocked:
- State whether the issue is server availability, missing MCP configuration, or client limitations
- Do not silently switch to another output type

---

## Quality Gate

Do not stop after the first diagram if it fails obvious visual checks.

Before treating the output as complete, verify:
- text fits inside every box
- no arrows cross through unrelated shapes
- no labels sit on top of arrows or neighboring boxes
- no part of the diagram feels crowded or noisy
- the reading order is obvious without explanation

If the first pass fails:
1. simplify the structure
2. switch to top-to-bottom or side-by-side layout if that improves clarity
3. split one diagram into overview + detail diagrams if needed
4. only then deliver the result

When browser or canvas inspection is available, use it to critique the actual rendered output rather than trusting the prompt alone.

---

## Examples

Example architecture request:

> Draw a clean Excalidraw architecture diagram for an automated tax preparation system.
> Type: system architecture
> Flow direction: left-to-right
> Main flows:
> 1. Invoice ingestion and classification
> 2. Stripe transaction sync
> 3. On-demand tax report generation
> Shared infrastructure:
> - Supabase
> - OpenAI API
> - Slack bot
> Style:
> - top-to-bottom side-by-side columns for the 3 flows
> - distinct colors per flow
> - labeled containers
> - minimal arrows
> - separate shared infrastructure section
> - presentation-ready

Example business workflow request:

> Draw a swimlane Excalidraw diagram for invoice approval.
> Actors: employee, finance, approver, ERP
> Steps: submit invoice, validate, request approval, post to ERP, notify employee
> Style: clean, modern, readable, labeled handoffs

Example expected-output instruction:

> If the overview becomes cluttered, produce one overview diagram and three separate flow diagrams. Prioritize clarity over squeezing everything into one image.

---

## Notes

Official source used for this skill:
- [excalidraw/excalidraw-mcp](https://github.com/excalidraw/excalidraw-mcp)
- [yctimlin/mcp_excalidraw](https://github.com/yctimlin/mcp_excalidraw) for iterative refinement and canvas-level cleanup

As of the current upstream README, the recommended installation path is the remote server at:
- `https://mcp.excalidraw.com`
