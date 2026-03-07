# MCP Tool Reference — yctimlin/mcp_excalidraw (26 Tools)

Quick reference for all tools. Always call `read_diagram_guide` first to get
the server's own best-practices guide before drawing.

---

## Element CRUD

### create_element
Create a single element on the canvas.
```json
{
  "type": "rectangle" | "ellipse" | "diamond" | "arrow" | "line" | "text" | "freedraw",
  "x": number,
  "y": number,
  "width": number,
  "height": number,
  "strokeColor": "#hex",
  "backgroundColor": "#hex",
  "fillStyle": "solid" | "hachure" | "cross-hatch" | "dots",
  "strokeWidth": 1 | 2 | 4,
  "strokeStyle": "solid" | "dashed" | "dotted",
  "roughness": 0 | 1 | 2,
  "opacity": 0-100,
  "text": "string",          // for text elements
  "fontSize": number,
  "fontFamily": 1 | 2 | 3,  // 1=Virgil, 2=Helvetica, 3=Cascadia
  "textAlign": "left" | "center" | "right",
  "roundness": { "type": 1|2|3 } | null,
  "startArrowhead": "arrow" | "bar" | "dot" | null,
  "endArrowhead": "arrow" | "bar" | "dot" | null
}
```
Returns: `{ id: string, ...element }`

### batch_create_elements
Create multiple elements in one call. Preserves IDs for subsequent updates.
```json
{
  "elements": [ ...element objects ]
}
```
Returns: `{ elements: [{ id, ...}] }`
**Always use this for 3+ elements. Much faster than individual calls.**

### get_element
```json
{ "id": "element-id" }
```

### update_element
```json
{ "id": "element-id", "updates": { ...partial element } }
```

### delete_element
```json
{ "id": "element-id" }
```

### query_elements
Find elements by property:
```json
{ "filter": { "type": "rectangle" } }
// or
{ "filter": { "strokeColor": "#1a1a2e" } }
```

### duplicate_elements
```json
{ "ids": ["id1", "id2"], "offsetX": 20, "offsetY": 20 }
```

---

## Layout Tools

### align_elements
```json
{
  "ids": ["id1", "id2", "id3"],
  "alignment": "left" | "right" | "top" | "bottom" | "centerX" | "centerY"
}
```

### distribute_elements
```json
{
  "ids": ["id1", "id2", "id3"],
  "distribution": "horizontal" | "vertical"
}
```

### group_elements
```json
{ "ids": ["id1", "id2", "id3"] }
```
Returns: `{ groupId: string }`

### ungroup_elements
```json
{ "groupId": "group-id" }
```

### lock_elements / unlock_elements
```json
{ "ids": ["id1", "id2"] }
```

---

## Scene Awareness

### describe_scene
Returns structured text description of all elements (positions, types, text, IDs).
No parameters. Use this to audit the canvas before making targeted edits.

### get_canvas_screenshot
Returns PNG image of current canvas state. No parameters.
**Use after every major phase to visually verify layout.**
Requires browser to have canvas open at localhost:3000.

---

## File I/O

### export_scene
```json
{ "filename": "my-diagram.excalidraw" }
```
Returns: Full `.excalidraw` JSON.

### import_scene
```json
{ "scene": { ...excalidraw JSON } }
```

### export_to_image
```json
{ "filename": "my-diagram.png", "background": true }
```
Requires browser open. Returns PNG data.

### export_to_excalidraw_url
No parameters. Encrypts scene and uploads to excalidraw.com.
Returns: `{ url: "https://excalidraw.com/#json=..." }`
**Use this as the primary export — generates shareable link.**

### create_from_mermaid
```json
{ "mermaid": "graph TD\n  A --> B" }
```
Converts Mermaid syntax to Excalidraw elements. Good starting point for flow diagrams.
**Tip: Generate Mermaid first, then import, then style to match design system.**

---

## State Management

### clear_canvas
No parameters. Clears all elements. Use after snapshotting.

### snapshot_scene
```json
{ "name": "before-refactor" }
```
Returns: `{ snapshotId: string }`

### restore_snapshot
```json
{ "snapshotId": "snapshot-id" }
```

---

## Viewport

### set_viewport
```json
// Fit all content:
{ "scrollToContent": true }

// Zoom to specific element:
{ "scrollToElementId": "element-id", "zoom": 1.5 }

// Manual:
{ "zoom": 0.8, "scrollX": 100, "scrollY": 50 }
```
**Always call with `scrollToContent: true` before taking final screenshot.**

---

## Design Guide & Resources

### read_diagram_guide
No parameters. Returns the server's built-in best practices for colors, sizing,
layout patterns, and anti-patterns. **Call this FIRST before every diagram.**

### get_resource
```json
{ "name": "resource-name" }
```

---

## Arrow Connection Pattern

To connect arrows to specific elements (critical for clean diagrams):
```json
{
  "type": "arrow",
  "x": 300, "y": 200,
  "width": 150, "height": 0,
  "startBinding": {
    "elementId": "source-box-id",
    "focus": 0,
    "gap": 8
  },
  "endBinding": {
    "elementId": "target-box-id",
    "focus": 0,
    "gap": 8
  },
  "text": "JWT Token Auth",
  "strokeColor": "#1a1a2e",
  "strokeWidth": 2,
  "endArrowhead": "arrow"
}
```

---

## Official Excalidraw MCP (Remote, mcp.excalidraw.com)

Simpler API — single tool call approach:
- Connect to: `https://mcp.excalidraw.com`
- No setup required
- Prompts render inline in Claude chat
- Use for quick one-shot diagrams
- Does NOT support iterative refinement or element-level CRUD
