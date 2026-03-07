# Design System — Excalidraw Business Diagrams

This document defines the visual language for all business flow diagrams and architectures.
Always apply these rules. They are what separates professional diagrams from amateur ones.

---

## Color Palette

### Zone Backgrounds (use for swimlane/layer containers)
| Zone type | backgroundColor | strokeColor | Usage |
|---|---|---|---|
| Client / User facing | `#d1fae5` (light green) | `#1a1a2e` | Top layer, what users see |
| Application / Logic | `#bfdbfe` (light blue) | `#1a1a2e` | Middle layer, business logic |
| Infrastructure / Server | `#bfdbfe` (light blue, slightly darker) | `#1a1a2e` | Compute, hosting |
| Database / Storage | `#ddd6fe` (light purple) | `#1a1a2e` | Persistence layer |
| External / 3rd Party | `#fef9c3` (light yellow) | `#92400e` | Services you don't own |
| Warning / Decision | `#fef3c7` (amber) | `#92400e` | Decision points, alerts |
| Success / Output | `#dcfce7` (bright green) | `#166534` | Completed states |

### Element Fill Colors (use for boxes inside zones)
| Element type | backgroundColor | strokeColor |
|---|---|---|
| Primary service | `#ffffff` | `#1a1a2e` |
| Sub-component | `#f8fafc` | `#64748b` |
| External service | `#fffbeb` | `#d97706` |
| Decision diamond | `#fef3c7` | `#92400e` |
| User/Actor | `#f0f9ff` | `#0369a1` |
| Database | `#f5f3ff` | `#7c3aed` |

### Arrow / Connector Colors
| Flow type | strokeColor | style |
|---|---|---|
| Primary data flow | `#1a1a2e` | solid, arrow end |
| Auth / Security flow | `#dc2626` | solid |
| Optional / async | `#64748b` | dashed |
| Bidirectional | `#1a1a2e` | arrows both ends |
| Callback / response | `#0369a1` | curved, dashed |

---

## Typography

| Element | fontSize | fontFamily | fontStyle |
|---|---|---|---|
| Zone/layer title | 20 | 1 (Virgil/handwritten) | bold |
| Component name | 16 | 1 | normal |
| Sub-component | 14 | 1 | normal |
| Arrow label | 14 | 1 | italic |
| Annotation/note | 12 | 1 | normal |

fontFamily values: `1` = Virgil (Excalidraw default handwritten), `2` = Helvetica, `3` = Cascadia

---

## Stroke Widths

| Element | strokeWidth |
|---|---|
| Zone containers | 2 |
| Primary service boxes | 2 |
| Sub-component boxes | 1 |
| Primary arrows | 2 |
| Secondary / annotation arrows | 1 |
| Dashed borders (external) | 1 |

---

## Border Radius / Shape

| Element | type | roundness |
|---|---|---|
| Zone containers | `rectangle` | `{ type: 3 }` (fully rounded) |
| Service boxes | `rectangle` | `{ type: 3 }` |
| Sub-component boxes | `rectangle` | `{ type: 1 }` (slightly rounded) |
| Decisions | `diamond` | null |
| Actors | `ellipse` | null |
| Databases | `ellipse` | null |
| Connectors | `arrow` | `{ type: 2 }` (curved) |

---

## Sizing Standards

### Zone Containers
```
Client zone:      { width: 900, height: 160 }
App layer zone:   { width: 900, height: 260 }
Server zone:      { width: 680, height: 400 }
Side panel:       { width: 200, height: match adjacent }
Full-width zone:  { width: canvas_width - 120 }
```

### Boxes (inside zones)
```
Large feature box:    { width: 220, height: 80 }
Standard service box: { width: 180, height: 70 }
Small component box:  { width: 140, height: 55 }
Label-only text:      { width: auto, height: 30 }
```

### Vertical spacing between zones: 40px
### Horizontal spacing between siblings: 30–40px
### Inner padding from zone edge to first child: 30px

---

## Layout Patterns

### 1. Layered Architecture (top-down)
```
[y=60]   Client Zone (full width)
[y=280]  Application Zone (full width)
[y=600]  Server Zone (left 70%) | Side Panel (right 25%)
[y=1050] Database Zone (left 70%)
```

### 2. Left-to-Right Business Flow
```
[x=60]  Trigger/Input Zone
[x=380] Processing Zone 1
[x=700] Processing Zone 2
[x=1020] Output/Archive Zone
Arrows run horizontally between zones with labeled midpoints
```

### 3. Swimlane (horizontal bands by actor)
```
[y=60]   Actor 1 lane (full width, height 180)
[y=260]  Actor 2 lane (full width, height 180)
[y=460]  Actor 3 lane (full width, height 180)
Vertical arrows cross lanes to show handoffs
```

### 4. Hub-and-Spoke (for routers/orchestrators)
```
Center: Router/Orchestrator box
Spokes radiating to services at equal angles
Use for: LLM routers, API gateways, message brokers
```

---

## Anti-Patterns (Never Do These)

- ❌ White backgrounds on zone containers (invisible borders)
- ❌ Arrows without labels (reader can't understand flow)
- ❌ All elements same size (no visual hierarchy)
- ❌ More than 5 colors in one diagram (visual noise)
- ❌ Text smaller than 12px (unreadable in exports)
- ❌ Overlapping elements (always check coordinates)
- ❌ Floating arrows not connected to elements
- ❌ Zones with no padding around children
- ❌ Using black fill (`#000000`) for backgrounds

---

## Reference: HR App Architecture Style

The diagram you provided uses:
- Green top zone (client features)
- Blue middle zones (application and server layers)
- White boxes with dark borders for individual components
- Right-side panel for Reverse Proxy (separate vertical zone)
- Arrows with descriptive labels: "JWT Token Auth", "Request/Response", "Inference", "DB Operations"
- Title text in handwritten Excalidraw font
- 2px stroke width throughout
- Nested boxes inside zones (e.g., Ollama containing model boxes)

Replicate this pattern for all architecture diagrams.
