#!/usr/bin/env node

import path from "node:path";
import { fileURLToPath } from "node:url";

const endpoint = process.env.AGENT_CANVAS_CONTROL_URL || "http://127.0.0.1:8787/operations";
const [command, ...args] = process.argv.slice(2);

try {
  if (command === "mcp-config") {
    printMcpConfig(args);
    process.exit(0);
  }

  const payload = buildPayload(command, args);
  const result = await postOperations(payload);
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error(error instanceof Error ? error.message : "Agent Canvas CLI failed.");
  printUsage();
  process.exitCode = 1;
}

function buildPayload(commandName, commandArgs) {
  if (commandName === "send") {
    const raw = commandArgs.join(" ");
    if (!raw) throw new Error("Missing JSON operation payload.");
    const payload = JSON.parse(raw);
    return Array.isArray(payload) || (payload && typeof payload.type === "string")
      ? { operations: Array.isArray(payload) ? payload : [payload] }
      : payload;
  }

  if (commandName === "create-text") {
    const options = parseOptions(commandArgs);
    const id = getOption(options, "id") || `agent-note-${Date.now()}`;
    const title = getOption(options, "title") || "Agent note";
    const text = getOption(options, "text") || "Created from the Agent Canvas CLI.";
    const node = {
      id,
      type: "text",
      x: readNumber(options, "x", 160),
      y: readNumber(options, "y", 160),
      width: readNumber(options, "width", 360),
      height: readNumber(options, "height", 180),
      ...(getOption(options, "parent-id") ? { parentId: getOption(options, "parent-id") } : {}),
      title,
      tags: readTags(options),
      content: {
        tone: getOption(options, "tone") || "note",
        text
      }
    };
    const createOperation = {
      type: "createNode",
      node,
      placement: readPlacement(options)
    };
    const operations = [createOperation];

    if (options.has("focus")) operations.push({ type: "focus", id });
    if (options.has("select")) operations.push({ type: "select", ids: [id] });

    return {
      label: getOption(options, "label") || "Create text node",
      detail: getOption(options, "detail") || `Created ${id} from the Agent Canvas CLI.`,
      operations
    };
  }

  if (commandName === "create-section") {
    const options = parseOptions(commandArgs);
    const id = getOption(options, "id") || `agent-section-${Date.now()}`;
    const label = getOption(options, "section-label") || getOption(options, "title") || "Agent section";
    const section = {
      id,
      type: "section",
      x: readNumber(options, "x", 120),
      y: readNumber(options, "y", 120),
      width: readNumber(options, "width", 960),
      height: readNumber(options, "height", 640),
      ...(getOption(options, "parent-id") ? { parentId: getOption(options, "parent-id") } : {}),
      title: getOption(options, "title") || label,
      description: getOption(options, "description"),
      tags: [...new Set([...readTags(options), "section"])],
      content: {
        label,
        ...(getOption(options, "description") ? { description: getOption(options, "description") } : {}),
        ...(options.has("clip") ? { clip: true } : {})
      }
    };
    const operations = [
      {
        type: "createSection",
        section,
        placement: readPlacement(options)
      }
    ];

    if (options.has("focus")) operations.push({ type: "focus", id });
    if (options.has("select")) operations.push({ type: "select", ids: [id] });

    return {
      label: getOption(options, "label") || "Create section",
      detail: getOption(options, "detail") || `Created ${id} from the Agent Canvas CLI.`,
      operations
    };
  }

  if (commandName === "set-parent") {
    const [id, parentId] = commandArgs;
    if (!id) throw new Error("Missing node id.");
    return {
      label: "Set node parent",
      detail: parentId ? `Moved ${id} into ${parentId} from the Agent Canvas CLI.` : `Moved ${id} to the root canvas from the Agent Canvas CLI.`,
      operations: [{ type: "setNodeParent", id, ...(parentId ? { parentId } : {}), preservePagePosition: true }]
    };
  }

  if (commandName === "layout-section") {
    const [id, ...optionArgs] = commandArgs;
    if (!id) throw new Error("Missing section id.");
    const options = parseOptions(optionArgs);
    const mode = getOption(options, "mode") || "grid";
    return {
      label: "Layout section",
      detail: `Applied ${mode} layout inside ${id} from the Agent Canvas CLI.`,
      operations: [
        {
          type: "layoutSection",
          id,
          layout: {
            mode,
            gap: readNumber(options, "gap", 28),
            ...(getOption(options, "columns") ? { columns: readNumber(options, "columns", 3) } : {})
          }
        }
      ]
    };
  }

  if (commandName === "update-node") {
    const [id, ...patchParts] = commandArgs;
    if (!id) throw new Error("Missing node id.");
    const patchJson = patchParts.join(" ");
    if (!patchJson) throw new Error("Missing JSON node patch.");

    return {
      label: "Update node",
      detail: `Updated ${id} from the Agent Canvas CLI.`,
      operations: [{ type: "updateNode", id, patch: JSON.parse(patchJson) }]
    };
  }

  throw new Error(`Unknown command: ${commandName || "(none)"}`);
}

async function postOperations(payload) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  const text = await response.text();
  const result = text ? JSON.parse(text) : {};

  if (!response.ok || result.ok === false) {
    throw new Error(result.error || `Control server rejected the request with HTTP ${response.status}.`);
  }

  return result;
}

function parseOptions(args) {
  const options = new Map();

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg.startsWith("--")) {
      throw new Error(`Unexpected argument: ${arg}`);
    }

    const [rawKey, inlineValue] = arg.slice(2).split("=", 2);
    const key = rawKey.trim();
    const hasInlineValue = typeof inlineValue === "string";
    const nextValue = args[index + 1];
    const isBooleanFlag = ["avoid-overlap", "clip", "codex", "focus", "json", "local", "select", "snap-grid"].includes(key);
    const value = hasInlineValue ? inlineValue : isBooleanFlag ? "true" : nextValue;

    if (!key) throw new Error("Empty option name.");
    if (typeof value !== "string") throw new Error(`Missing value for --${key}.`);

    if (!hasInlineValue && !isBooleanFlag) index += 1;
    if (key === "tag") {
      options.set("tag", [...(options.get("tag") || []), value]);
    } else {
      options.set(key, value);
    }
  }

  return options;
}

function printMcpConfig(commandArgs) {
  const options = parseOptions(commandArgs);
  const controlUrl = getOption(options, "control-url") || "http://127.0.0.1:8787";
  const env = { AGENT_CANVAS_CONTROL_URL: controlUrl };
  const server = options.has("local")
    ? {
        command: "node",
        args: [path.join(path.dirname(fileURLToPath(import.meta.url)), "mcp-server.mjs")],
        env
      }
    : {
        command: "npx",
        args: ["-y", "-p", "@agent-canvas/react", "agent-canvas-mcp"],
        env
      };

  if (options.has("json")) {
    console.log(JSON.stringify({ mcpServers: { "agent-canvas": server } }, null, 2));
    return;
  }

  console.log(renderCodexMcpConfig("agent-canvas", server));
}

function renderCodexMcpConfig(name, server) {
  const env = Object.entries(server.env || {})
    .map(([key, value]) => `${key} = ${JSON.stringify(value)}`)
    .join(", ");

  return [
    `[mcp_servers.${name}]`,
    `command = ${JSON.stringify(server.command)}`,
    `args = ${JSON.stringify(server.args || [])}`,
    env ? `env = { ${env} }` : ""
  ]
    .filter(Boolean)
    .join("\n");
}

function getOption(options, key) {
  const value = options.get(key);
  return typeof value === "string" ? value : undefined;
}

function readNumber(options, key, fallback) {
  const value = getOption(options, key);
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`Expected --${key} to be a number.`);
  return parsed;
}

function readTags(options) {
  const tags = new Set(["agent-created"]);
  const inlineTags = getOption(options, "tags");
  const repeatedTags = options.get("tag") || [];

  if (inlineTags) {
    for (const tag of inlineTags.split(",")) {
      if (tag.trim()) tags.add(tag.trim());
    }
  }

  for (const tag of repeatedTags) {
    if (tag.trim()) tags.add(tag.trim());
  }

  return [...tags];
}

function readPlacement(options) {
  const explicitMode = getOption(options, "placement");
  const mode = explicitMode || (options.has("avoid-overlap") ? "avoid-overlap" : options.has("snap-grid") ? "snap-grid" : undefined);

  if (!mode) return undefined;

  return {
    mode,
    gap: readNumber(options, "gap", 28),
    gridSize: readNumber(options, "grid-size", 24),
    maxAttempts: readNumber(options, "max-attempts", 1200)
  };
}

function printUsage() {
  console.error(`
Usage:
  npm run agent -- send '<CanvasOperation | CanvasOperation[] | { "operations": [...] }>'
  npm run agent -- create-text --id note-1 --title "Agent note" --text "Hello" --avoid-overlap
  npm run agent -- create-section --id design --section-label "Design Screens" --avoid-overlap
  npm run agent -- set-parent home-screen design
  npm run agent -- layout-section design --mode row
  npm run agent -- update-node note-1 '{ "content": { "tone": "note", "text": "Updated" } }'
  npm run agent -- mcp-config --local
  npm run agent -- mcp-config --local --json

Environment:
  AGENT_CANVAS_CONTROL_URL=http://127.0.0.1:8787/operations
`);
}
