# Agent Canvas MCP

Agent Canvas can expose a live browser canvas to AI agents through MCP.

The integration has two moving pieces:

1. `agent-canvas-control`: a local HTTP/SSE bridge for the browser canvas.
2. `agent-canvas-mcp`: a stdio MCP server for AI agents.

The browser publishes its latest snapshot to the control bridge. Agents use MCP tools to read that state and apply typed `CanvasOperation[]` records back to the live canvas.

## Local Development

From this repository, start the demo and control bridge:

```bash
npm run dev
npm run control
```

The demo runs on Vite, and the control bridge listens on `http://127.0.0.1:8787`.

Print the Codex MCP config:

```bash
npm run mcp:config
```

That prints:

```toml
[mcp_servers.agent-canvas]
command = "node"
args = ["/absolute/path/to/agent-canvas/scripts/mcp-server.mjs"]
env = { AGENT_CANVAS_CONTROL_URL = "http://127.0.0.1:8787" }
```

Add that block to `~/.codex/config.toml`, then restart Codex. The MCP server is loaded when a new Codex session starts; it is not hot-added to an already running session.

For clients that expect JSON MCP config, run:

```bash
npm run agent -- mcp-config --local --json
```

## Installed Package

When consuming the package from another project, install it and use the package bins:

```bash
npm install @agent-canvas/react
npx agent-canvas-control
```

For Codex, use this MCP server block:

```toml
[mcp_servers.agent-canvas]
command = "npx"
args = ["-y", "-p", "@agent-canvas/react", "agent-canvas-mcp"]
env = { AGENT_CANVAS_CONTROL_URL = "http://127.0.0.1:8787" }
```

For clients that expect JSON, use this server config:

```json
{
  "mcpServers": {
    "agent-canvas": {
      "command": "npx",
      "args": ["-y", "-p", "@agent-canvas/react", "agent-canvas-mcp"],
      "env": {
        "AGENT_CANVAS_CONTROL_URL": "http://127.0.0.1:8787"
      }
    }
  }
}
```

You can also print the Codex config:

```bash
npx agent-canvas mcp-config
```

## Host App Setup

Render `AgentCanvas` normally in the host app. The host app needs to either:

- Use the included demo bridge pattern, publishing snapshots to `PUT /snapshot` and listening to `GET /events`.
- Or implement equivalent routes against its own backend and point `AGENT_CANVAS_CONTROL_URL` at that service.

The control bridge routes are:

- `GET /health`: status, connected browsers, snapshot availability.
- `GET /events`: SSE stream for browser-bound operation events.
- `POST /operations`: accepts a `CanvasOperation`, `CanvasOperation[]`, or `{ operations, label, detail }`.
- `GET /snapshot`: returns the latest browser-published snapshot.
- `PUT /snapshot`: accepts `{ document, selectedNodeIds, viewport, agentContext }`.

## MCP Tools

The MCP server exposes these tools:

- `agent_canvas_health`: check the control bridge.
- `agent_canvas_get_snapshot`: read the latest canvas snapshot.
- `agent_canvas_get_context`: read compact agent context.
- `agent_canvas_apply_operations`: apply raw `CanvasOperation[]`.
- `agent_canvas_create_text_node`: create a text node.
- `agent_canvas_create_document_node`: create a markdown document node.
- `agent_canvas_create_section`: create a section container.
- `agent_canvas_update_node`: patch a node.
- `agent_canvas_set_node_parent`: move a node into or out of a section.
- `agent_canvas_stream_document`: create or update a document node while marking it editing or complete.
- `agent_canvas_layout_nodes`: lay out or tidy nodes as row, column, list, or grid.
- `agent_canvas_layout_section`: lay out the direct child nodes inside a section.
- `agent_canvas_focus_node`: select and focus a node.
- `agent_canvas_watch_operations`: wait for the next control-stream operation.

## MCP Resources

Agents can read:

- `canvas://current/snapshot`
- `canvas://current/context`
- `canvas://nodes/{id}`

## MCP Prompts

The server also exposes prompt templates:

- `inspect_canvas`
- `create_artifact`
- `stream_artifact`

## Example Agent Requests

After connecting the MCP server, ask your agent:

```text
Use Agent Canvas to inspect the current canvas and add a non-overlapping note summarizing what is selected.
```

```text
Create a document node called "Launch Plan", stream the first draft into it, then mark it complete.
```

```text
Lay out the generated nodes as a tidy grid.
```

```text
Create a section called "Design Screens", move the Home and Fam Wall nodes into it, then lay out that section as a row.
```

## Security Notes

The included control bridge is a local development tool. It binds to `127.0.0.1` by default and has no authentication. Do not expose it on a public network without adding authentication, origin checks, and authorization around write operations.
