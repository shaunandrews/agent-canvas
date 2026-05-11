#!/usr/bin/env node

const MCP_PROTOCOL_VERSION = "2025-06-18";
const SERVER_VERSION = "0.1.0";
const controlBaseUrl = normalizeControlBaseUrl(process.env.AGENT_CANVAS_CONTROL_URL || "http://127.0.0.1:8787");

const tools = [
  {
    name: "agent_canvas_health",
    title: "Check Agent Canvas Control Server",
    description: "Check whether the local Agent Canvas control server is running and whether a browser canvas is connected.",
    inputSchema: objectSchema({})
  },
  {
    name: "agent_canvas_get_snapshot",
    title: "Get Canvas Snapshot",
    description: "Read the latest canvas document, viewport, selection, and agent context published by the browser.",
    inputSchema: objectSchema({})
  },
  {
    name: "agent_canvas_get_context",
    title: "Get Agent Canvas Context",
    description: "Read the compact context summary for the current canvas.",
    inputSchema: objectSchema({})
  },
  {
    name: "agent_canvas_apply_operations",
    title: "Apply Canvas Operations",
    description: "Apply raw CanvasOperation records to the live canvas.",
    inputSchema: objectSchema(
      {
        operations: { type: "array", items: { type: "object" }, description: "CanvasOperation records to apply." },
        label: { type: "string", description: "Short label shown in the demo operation log." },
        detail: { type: "string", description: "Detailed operation log message." }
      },
      ["operations"]
    )
  },
  {
    name: "agent_canvas_create_text_node",
    title: "Create Text Node",
    description: "Create a short text node on the live canvas.",
    inputSchema: nodeCreationSchema({
      text: { type: "string", description: "Text content for the node." },
      tone: { type: "string", enum: ["note", "heading", "code"], description: "Text presentation tone." }
    }, ["text"])
  },
  {
    name: "agent_canvas_create_document_node",
    title: "Create Document Node",
    description: "Create a markdown document node on the live canvas.",
    inputSchema: nodeCreationSchema({
      markdown: { type: "string", description: "Markdown content for the document." },
      status: { type: "string", enum: ["editing", "complete"], description: "Optional visible editing status." },
      progress: { type: "number", description: "Optional generation progress from 0 to 100." }
    }, ["markdown"])
  },
  {
    name: "agent_canvas_create_section",
    title: "Create Section",
    description: "Create a section container that other nodes can be parented into.",
    inputSchema: nodeCreationSchema(
      {
        label: { type: "string", description: "Visible section label." },
        description: { type: "string", description: "Short section description for agents and users." },
        clip: { type: "boolean", description: "Whether consumers should clip section children." }
      },
      []
    )
  },
  {
    name: "agent_canvas_update_node",
    title: "Update Node",
    description: "Patch an existing canvas node by id.",
    inputSchema: objectSchema(
      {
        id: { type: "string", description: "Node id to update." },
        patch: { type: "object", description: "Partial CanvasNode patch." },
        label: { type: "string", description: "Short label shown in the demo operation log." },
        detail: { type: "string", description: "Detailed operation log message." }
      },
      ["id", "patch"]
    )
  },
  {
    name: "agent_canvas_set_node_parent",
    title: "Set Node Parent",
    description: "Move a node into or out of a section while optionally preserving its page position.",
    inputSchema: objectSchema(
      {
        id: { type: "string", description: "Node id to reparent." },
        parentId: { type: "string", description: "Section id to parent into. Omit to move to the root canvas." },
        preservePagePosition: { type: "boolean", description: "Keep the node visually in place while changing parent. Defaults to true." },
        label: { type: "string", description: "Short label shown in the demo operation log." },
        detail: { type: "string", description: "Detailed operation log message." }
      },
      ["id"]
    )
  },
  {
    name: "agent_canvas_stream_document",
    title: "Stream Document Content",
    description: "Create or update a document node while marking it as editing/complete, useful for realtime generation.",
    inputSchema: objectSchema(
      {
        id: { type: "string", description: "Stable node id." },
        title: { type: "string", description: "Node title." },
        markdown: { type: "string", description: "Current markdown content." },
        progress: { type: "number", description: "Generation progress from 0 to 100." },
        status: { type: "string", enum: ["editing", "complete"], description: "Generation status." },
        streamLabel: { type: "string", description: "Short visible status label." },
        createIfMissing: { type: "boolean", description: "Create the document if it does not already exist. Defaults to true." },
        x: { type: "number" },
        y: { type: "number" },
        width: { type: "number" },
        height: { type: "number" },
        placement: placementSchema()
      },
      ["id", "markdown"]
    )
  },
  {
    name: "agent_canvas_layout_nodes",
    title: "Layout Nodes",
    description: "Lay out existing nodes as a row, column, list, or grid.",
    inputSchema: objectSchema(
      {
        ids: { type: "array", items: { type: "string" }, description: "Node ids to lay out." },
        mode: { type: "string", enum: ["row", "column", "list", "grid"], description: "Layout mode." },
        gap: { type: "number", description: "Gap between nodes in canvas units." },
        columns: { type: "number", description: "Grid column count." },
        tidy: { type: "boolean", description: "Use tidyNodes instead of layoutNodes." }
      },
      ["ids", "mode"]
    )
  },
  {
    name: "agent_canvas_layout_section",
    title: "Layout Section",
    description: "Lay out the direct child nodes inside a section.",
    inputSchema: objectSchema(
      {
        id: { type: "string", description: "Section id." },
        mode: { type: "string", enum: ["row", "column", "list", "grid"], description: "Layout mode." },
        gap: { type: "number", description: "Gap between child nodes in canvas units." },
        columns: { type: "number", description: "Grid column count." },
        origin: {
          type: "object",
          properties: { x: { type: "number" }, y: { type: "number" } },
          additionalProperties: false,
          description: "Optional origin relative to the section."
        }
      },
      ["id", "mode"]
    )
  },
  {
    name: "agent_canvas_focus_node",
    title: "Focus Node",
    description: "Select and focus a node in the live browser canvas.",
    inputSchema: objectSchema({ id: { type: "string", description: "Node id to focus." } }, ["id"])
  },
  {
    name: "agent_canvas_watch_operations",
    title: "Watch Canvas Operations",
    description: "Wait for the next operation event from the live canvas control stream.",
    inputSchema: objectSchema({
      timeoutSeconds: { type: "number", description: "Maximum wait time. Defaults to 120 seconds." }
    })
  }
];

const resourceDefinitions = [
  {
    uri: "canvas://current/snapshot",
    name: "current-snapshot",
    title: "Current Canvas Snapshot",
    description: "Latest CanvasDocument, viewport, selection, and context from the live browser.",
    mimeType: "application/json"
  },
  {
    uri: "canvas://current/context",
    name: "current-context",
    title: "Current Agent Context",
    description: "Compact context summary for the current canvas.",
    mimeType: "application/json"
  }
];

const resourceTemplates = [
  {
    uriTemplate: "canvas://nodes/{id}",
    name: "node-by-id",
    title: "Canvas Node By ID",
    description: "Read a single CanvasNode from the latest snapshot.",
    mimeType: "application/json"
  }
];

const prompts = [
  {
    name: "inspect_canvas",
    title: "Inspect Canvas",
    description: "Read the current canvas context before deciding what to change."
  },
  {
    name: "create_artifact",
    title: "Create Artifact",
    description: "Create a new canvas artifact using the native node schema.",
    arguments: [{ name: "goal", description: "What artifact should be created?", required: true }]
  },
  {
    name: "stream_artifact",
    title: "Stream Artifact",
    description: "Create a document shell, mark it editing, then stream updates into it.",
    arguments: [{ name: "nodeId", description: "Stable node id for the streamed artifact.", required: true }]
  }
];

let inputBuffer = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  inputBuffer += chunk;
  const lines = inputBuffer.split("\n");
  inputBuffer = lines.pop() || "";

  for (const line of lines) {
    if (line.trim()) handleMessageLine(line.trim());
  }
});
process.stdin.on("end", () => process.exit(0));

async function handleMessageLine(line) {
  let message;
  try {
    message = JSON.parse(line);
  } catch (error) {
    writeError(null, -32700, "Parse error", error instanceof Error ? error.message : undefined);
    return;
  }

  if (Array.isArray(message)) {
    await Promise.all(message.map((item) => handleMessage(item)));
    return;
  }

  await handleMessage(message);
}

async function handleMessage(message) {
  if (!message || message.jsonrpc !== "2.0" || typeof message.method !== "string") {
    if (message?.id !== undefined) writeError(message.id, -32600, "Invalid Request");
    return;
  }

  const isNotification = message.id === undefined;

  try {
    const result = await routeRequest(message.method, message.params || {});
    if (!isNotification) writeMessage({ jsonrpc: "2.0", id: message.id, result });
  } catch (error) {
    if (!isNotification) {
      writeError(
        message.id,
        error instanceof JsonRpcError ? error.code : -32603,
        error instanceof Error ? error.message : "Internal error",
        error instanceof JsonRpcError ? error.data : undefined
      );
    }
  }
}

async function routeRequest(method, params) {
  if (method === "initialize") return initialize(params);
  if (method === "notifications/initialized") return undefined;
  if (method === "ping") return {};
  if (method === "tools/list") return { tools };
  if (method === "tools/call") return callTool(params);
  if (method === "resources/list") return { resources: resourceDefinitions };
  if (method === "resources/templates/list") return { resourceTemplates };
  if (method === "resources/read") return readResource(params);
  if (method === "prompts/list") return { prompts };
  if (method === "prompts/get") return getPrompt(params);

  throw new JsonRpcError(-32601, `Method not found: ${method}`);
}

function initialize(params) {
  const requestedVersion = typeof params.protocolVersion === "string" ? params.protocolVersion : MCP_PROTOCOL_VERSION;
  return {
    protocolVersion: requestedVersion === MCP_PROTOCOL_VERSION ? MCP_PROTOCOL_VERSION : MCP_PROTOCOL_VERSION,
    capabilities: {
      tools: { listChanged: false },
      resources: { listChanged: false },
      prompts: { listChanged: false }
    },
    serverInfo: {
      name: "agent-canvas",
      title: "Agent Canvas",
      version: SERVER_VERSION
    },
    instructions:
      "Use Agent Canvas tools to read the current canvas context and apply typed CanvasOperation records. Sections are node containers: create them with agent_canvas_create_section, then set node parentId values with agent_canvas_set_node_parent. Start the browser control bridge with `agent-canvas-control` or `npm run control` before calling write tools."
  };
}

async function callTool(params) {
  const name = readString(params, "name");
  const args = params.arguments && typeof params.arguments === "object" ? params.arguments : {};

  try {
    if (name === "agent_canvas_health") return toolResult(await fetchControlJson("/health"));
    if (name === "agent_canvas_get_snapshot") return toolResult(await getSnapshot());
    if (name === "agent_canvas_get_context") return toolResult(await getContext());
    if (name === "agent_canvas_apply_operations") return toolResult(await applyOperations(args.operations, args));
    if (name === "agent_canvas_create_text_node") return toolResult(await createTextNode(args));
    if (name === "agent_canvas_create_document_node") return toolResult(await createDocumentNode(args));
    if (name === "agent_canvas_create_section") return toolResult(await createSection(args));
    if (name === "agent_canvas_update_node") return toolResult(await updateNode(args));
    if (name === "agent_canvas_set_node_parent") return toolResult(await setNodeParent(args));
    if (name === "agent_canvas_stream_document") return toolResult(await streamDocument(args));
    if (name === "agent_canvas_layout_nodes") return toolResult(await layoutNodes(args));
    if (name === "agent_canvas_layout_section") return toolResult(await layoutSection(args));
    if (name === "agent_canvas_focus_node") return toolResult(await applyOperations([{ type: "focus", id: readString(args, "id") }], { label: "Focus node" }));
    if (name === "agent_canvas_watch_operations") return toolResult(await watchOperations(args));

    throw new JsonRpcError(-32602, `Unknown tool: ${name}`);
  } catch (error) {
    if (error instanceof JsonRpcError) throw error;
    return toolError(error instanceof Error ? error.message : "Tool failed");
  }
}

async function readResource(params) {
  const uri = readString(params, "uri");
  const snapshot = await getSnapshot();

  if (uri === "canvas://current/snapshot") {
    return resourceResult(uri, snapshot);
  }

  if (uri === "canvas://current/context") {
    return resourceResult(uri, extractContext(snapshot));
  }

  if (uri.startsWith("canvas://nodes/")) {
    const id = decodeURIComponent(uri.slice("canvas://nodes/".length));
    const node = snapshot.snapshot.document.nodes.find((item) => item.id === id);
    if (!node) throw new JsonRpcError(-32602, `Node not found: ${id}`);
    return resourceResult(uri, node);
  }

  throw new JsonRpcError(-32602, `Unknown resource: ${uri}`);
}

function getPrompt(params) {
  const name = readString(params, "name");
  const args = params.arguments && typeof params.arguments === "object" ? params.arguments : {};

  if (name === "inspect_canvas") {
    return {
      description: "Inspect the current Agent Canvas state.",
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: "Read canvas://current/context and canvas://current/snapshot. Summarize the selected nodes, visible nodes, and any obvious next operation."
          }
        }
      ]
    };
  }

  if (name === "create_artifact") {
    return {
      description: "Create a new canvas artifact.",
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Goal: ${args.goal || "Create a useful artifact."}\n\nRead the current canvas context, choose a native Agent Canvas node type, then create a non-overlapping node using the Agent Canvas tools.`
          }
        }
      ]
    };
  }

  if (name === "stream_artifact") {
    return {
      description: "Stream document content into a canvas node.",
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Use agent_canvas_stream_document with node id ${args.nodeId || "a stable id"}. First create an editing shell, then send incremental markdown updates, and finally mark the node complete.`
          }
        }
      ]
    };
  }

  throw new JsonRpcError(-32602, `Unknown prompt: ${name}`);
}

async function createTextNode(args) {
  const id = args.id || `agent-text-${Date.now()}`;
  const node = {
    id,
    type: "text",
    x: readNumber(args, "x", 160),
    y: readNumber(args, "y", 160),
    width: readNumber(args, "width", 360),
    height: readNumber(args, "height", 180),
    ...(typeof args.parentId === "string" ? { parentId: args.parentId } : {}),
    title: args.title || "Agent note",
    tags: ["agent-created", ...(Array.isArray(args.tags) ? args.tags.filter((tag) => typeof tag === "string") : [])],
    content: {
      tone: args.tone || "note",
      text: readString(args, "text")
    }
  };

  return applyOperations(buildCreateOperations(node, args), {
    label: args.label || "Create text node",
    detail: args.detail || `Created ${id} through MCP.`
  });
}

async function createDocumentNode(args) {
  const id = args.id || `agent-document-${Date.now()}`;
  const progress = typeof args.progress === "number" ? args.progress : undefined;
  const status = args.status || (progress !== undefined && progress < 100 ? "editing" : undefined);
  const node = {
    id,
    type: "document",
    x: readNumber(args, "x", 160),
    y: readNumber(args, "y", 160),
    width: readNumber(args, "width", 460),
    height: readNumber(args, "height", 320),
    ...(typeof args.parentId === "string" ? { parentId: args.parentId } : {}),
    title: args.title || "Agent document",
    tags: ["agent-created", ...(Array.isArray(args.tags) ? args.tags.filter((tag) => typeof tag === "string") : [])],
    metadata: status ? streamMetadata(status, progress, args.streamLabel) : undefined,
    content: { markdown: readString(args, "markdown") }
  };

  return applyOperations(buildCreateOperations(node, args), {
    label: args.label || "Create document node",
    detail: args.detail || `Created ${id} through MCP.`
  });
}

async function createSection(args) {
  const id = args.id || `agent-section-${Date.now()}`;
  const label = args.label || args.title || "Agent section";
  const section = {
    id,
    type: "section",
    x: readNumber(args, "x", 120),
    y: readNumber(args, "y", 120),
    width: readNumber(args, "width", 960),
    height: readNumber(args, "height", 640),
    ...(typeof args.parentId === "string" ? { parentId: args.parentId } : {}),
    title: args.title || label,
    description: typeof args.description === "string" ? args.description : undefined,
    tags: ["agent-created", "section", ...(Array.isArray(args.tags) ? args.tags.filter((tag) => typeof tag === "string") : [])],
    content: {
      label,
      ...(typeof args.description === "string" ? { description: args.description } : {}),
      ...(typeof args.clip === "boolean" ? { clip: args.clip } : {})
    }
  };

  return applyOperations(
    [
      {
        type: "createSection",
        section,
        placement: args.placement || { mode: "avoid-overlap", gap: 32, gridSize: 24 }
      },
      ...(args.focus ? [{ type: "focus", id }] : []),
      ...(args.select ? [{ type: "select", ids: [id] }] : [])
    ],
    {
      label: args.label || "Create section",
      detail: args.detail || `Created ${id} section through MCP.`
    }
  );
}

async function updateNode(args) {
  return applyOperations([{ type: "updateNode", id: readString(args, "id"), patch: readObject(args, "patch") }], {
    label: args.label || "Update node",
    detail: args.detail || `Updated ${args.id} through MCP.`
  });
}

async function setNodeParent(args) {
  const id = readString(args, "id");
  const parentId = typeof args.parentId === "string" && args.parentId ? args.parentId : undefined;
  return applyOperations(
    [
      {
        type: "setNodeParent",
        id,
        ...(parentId ? { parentId } : {}),
        preservePagePosition: args.preservePagePosition !== false
      }
    ],
    {
      label: args.label || "Set node parent",
      detail: args.detail || `${parentId ? `Moved ${id} into ${parentId}` : `Moved ${id} to the root canvas`}.`
    }
  );
}

async function streamDocument(args) {
  const id = readString(args, "id");
  const markdown = readString(args, "markdown");
  const progress = readNumber(args, "progress", undefined);
  const status = args.status || (progress === 100 ? "complete" : "editing");
  const snapshot = await getSnapshot().catch(() => undefined);
  const exists = Boolean(snapshot?.snapshot?.document?.nodes?.some((node) => node.id === id));
  const createIfMissing = args.createIfMissing !== false;
  const metadata = streamMetadata(status, progress, args.streamLabel);

  if (exists) {
    return applyOperations(
      [
        {
          type: "updateNode",
          id,
          patch: {
            ...(args.title ? { title: args.title } : {}),
            ...(typeof args.parentId === "string" ? { parentId: args.parentId } : {}),
            metadata,
            content: { markdown }
          }
        }
      ],
      {
        label: args.label || "Stream document",
        detail: args.detail || `Streamed markdown into ${id}.`
      }
    );
  }

  if (!createIfMissing) {
    throw new Error(`Node not found: ${id}`);
  }

  return createDocumentNode({
    ...args,
    id,
    markdown,
    status,
    progress,
    streamLabel: args.streamLabel,
    title: args.title || "Streaming document",
    label: args.label || "Create streamed document",
    detail: args.detail || `Created ${id} for streamed markdown.`
  });
}

async function layoutNodes(args) {
  const ids = readStringArray(args, "ids");
  return applyOperations(
    [
      {
        type: args.tidy ? "tidyNodes" : "layoutNodes",
        ids,
        layout: {
          mode: readString(args, "mode"),
          ...(typeof args.gap === "number" ? { gap: args.gap } : {}),
          ...(typeof args.columns === "number" ? { columns: args.columns } : {})
        }
      }
    ],
    {
      label: "Layout nodes",
      detail: `Applied ${args.mode} layout to ${ids.length} node${ids.length === 1 ? "" : "s"}.`
    }
  );
}

async function layoutSection(args) {
  const id = readString(args, "id");
  return applyOperations(
    [
      {
        type: "layoutSection",
        id,
        layout: {
          mode: readString(args, "mode"),
          ...(typeof args.gap === "number" ? { gap: args.gap } : {}),
          ...(typeof args.columns === "number" ? { columns: args.columns } : {}),
          ...(args.origin && typeof args.origin === "object" && !Array.isArray(args.origin) ? { origin: args.origin } : {})
        }
      }
    ],
    {
      label: "Layout section",
      detail: `Applied ${args.mode} layout inside ${id}.`
    }
  );
}

async function applyOperations(operations, args = {}) {
  if (!Array.isArray(operations) || !operations.length) throw new Error("Expected a non-empty operations array.");
  return fetchControlJson("/operations", {
    body: JSON.stringify({
      operations,
      label: args.label,
      detail: args.detail
    }),
    headers: { "content-type": "application/json" },
    method: "POST"
  });
}

async function getSnapshot() {
  return fetchControlJson("/snapshot");
}

async function getContext() {
  const snapshot = await getSnapshot();
  return extractContext(snapshot);
}

function extractContext(snapshotResponse) {
  const agentContext = snapshotResponse.snapshot.agentContext;
  if (agentContext && typeof agentContext === "object" && !Array.isArray(agentContext) && agentContext.context) {
    return agentContext.context;
  }

  return agentContext || {
    canvas: {
      id: snapshotResponse.snapshot.document.id,
      title: snapshotResponse.snapshot.document.title,
      viewport: snapshotResponse.snapshot.viewport
    },
    selectedNodeIds: snapshotResponse.snapshot.selectedNodeIds || [],
    nodeCount: snapshotResponse.snapshot.document.nodes.length
  };
}

async function watchOperations(args) {
  const timeoutSeconds = readNumber(args, "timeoutSeconds", 120);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.max(1, timeoutSeconds) * 1000);

  try {
    const response = await fetch(endpoint("/events"), { signal: controller.signal });
    if (!response.ok || !response.body) throw new Error(`Control stream returned HTTP ${response.status}.`);

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let eventName = "";
    let dataLines = [];

    for (;;) {
      const { done, value } = await reader.read();
      if (done) throw new Error("Control stream closed before an operation arrived.");

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line === "") {
          if (eventName === "operations" && dataLines.length) {
            controller.abort();
            return JSON.parse(dataLines.join("\n"));
          }
          eventName = "";
          dataLines = [];
          continue;
        }

        if (line.startsWith("event:")) eventName = line.slice(6).trim();
        if (line.startsWith("data:")) dataLines.push(line.slice(5).trimStart());
      }
    }
  } catch (error) {
    if (error?.name === "AbortError") throw new Error(`No operations arrived within ${timeoutSeconds} seconds.`);
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchControlJson(path, init) {
  const response = await fetch(endpoint(path), init);
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};

  if (!response.ok || data.ok === false) {
    throw new Error(data.error || `Agent Canvas control server returned HTTP ${response.status}.`);
  }

  return data;
}

function buildCreateOperations(node, args) {
  const operation = {
    type: "createNode",
    node,
    placement: args.placement || { mode: "avoid-overlap", gap: 28, gridSize: 24 }
  };
  const operations = [operation];

  if (args.focus) operations.push({ type: "focus", id: node.id });
  if (args.select) operations.push({ type: "select", ids: [node.id] });

  return operations;
}

function streamMetadata(status, progress, label) {
  return {
    demoStatus: status,
    ...(typeof progress === "number" ? { demoProgress: progress } : {}),
    ...(typeof label === "string" ? { demoStreamLabel: label } : {})
  };
}

function toolResult(data) {
  return {
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    structuredContent: data,
    isError: false
  };
}

function toolError(message) {
  return {
    content: [{ type: "text", text: message }],
    structuredContent: { ok: false, error: message },
    isError: true
  };
}

function resourceResult(uri, data) {
  return {
    contents: [
      {
        uri,
        mimeType: "application/json",
        text: JSON.stringify(data, null, 2)
      }
    ]
  };
}

function endpoint(path) {
  return `${controlBaseUrl}${path}`;
}

function normalizeControlBaseUrl(rawUrl) {
  const url = new URL(rawUrl);
  for (const suffix of ["/operations", "/events", "/snapshot", "/health"]) {
    if (url.pathname.endsWith(suffix)) {
      url.pathname = url.pathname.slice(0, -suffix.length) || "/";
      break;
    }
  }
  return url.toString().replace(/\/$/, "");
}

function objectSchema(properties, required = []) {
  return {
    type: "object",
    properties,
    required,
    additionalProperties: false
  };
}

function nodeCreationSchema(extraProperties, required = []) {
  return objectSchema(
    {
      id: { type: "string", description: "Stable node id. Generated if omitted." },
      title: { type: "string", description: "Node title." },
      x: { type: "number", description: "Preferred x position." },
      y: { type: "number", description: "Preferred y position." },
      width: { type: "number", description: "Node width." },
      height: { type: "number", description: "Node height." },
      parentId: { type: "string", description: "Optional parent section id." },
      tags: { type: "array", items: { type: "string" }, description: "Additional node tags." },
      placement: placementSchema(),
      focus: { type: "boolean", description: "Focus the node after creation." },
      select: { type: "boolean", description: "Select the node after creation without changing viewport." },
      label: { type: "string", description: "Operation log label." },
      detail: { type: "string", description: "Operation log detail." },
      ...extraProperties
    },
    required
  );
}

function placementSchema() {
  return {
    type: "object",
    properties: {
      mode: {
        type: "string",
        enum: ["freeform", "avoid-overlap", "snap-grid", "near-selection", "append-row", "append-column", "append-grid"]
      },
      gap: { type: "number" },
      gridSize: { type: "number" },
      columns: { type: "number" },
      maxAttempts: { type: "number" }
    },
    additionalProperties: true
  };
}

function readString(object, key) {
  const value = object?.[key];
  if (typeof value !== "string" || !value) throw new Error(`Expected ${key} to be a non-empty string.`);
  return value;
}

function readObject(object, key) {
  const value = object?.[key];
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`Expected ${key} to be an object.`);
  return value;
}

function readStringArray(object, key) {
  const value = object?.[key];
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) throw new Error(`Expected ${key} to be a string array.`);
  return value;
}

function readNumber(object, key, fallback) {
  const value = object?.[key];
  if (value === undefined) return fallback;
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`Expected ${key} to be a number.`);
  return value;
}

function writeMessage(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

function writeError(id, code, message, data) {
  writeMessage({
    jsonrpc: "2.0",
    id,
    error: {
      code,
      message,
      ...(data === undefined ? {} : { data })
    }
  });
}

class JsonRpcError extends Error {
  constructor(code, message, data) {
    super(message);
    this.code = code;
    this.data = data;
  }
}
