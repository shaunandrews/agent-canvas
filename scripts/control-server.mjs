#!/usr/bin/env node

import http from "node:http";

const host = process.env.AGENT_CANVAS_HOST || "127.0.0.1";
const port = Number(process.env.AGENT_CANVAS_PORT || 8787);
const clients = new Set();
let latestSnapshot = undefined;
let sequence = 0;

const server = http.createServer(async (request, response) => {
  setCorsHeaders(response);

  if (request.method === "OPTIONS") {
    response.writeHead(204);
    response.end();
    return;
  }

  if (request.method === "GET" && request.url === "/health") {
    sendJson(response, 200, {
      ok: true,
      clients: clients.size,
      hasSnapshot: Boolean(latestSnapshot),
      snapshotUpdatedAt: latestSnapshot?.updatedAt,
      operationsUrl: `http://${host}:${port}/operations`,
      eventsUrl: `http://${host}:${port}/events`,
      snapshotUrl: `http://${host}:${port}/snapshot`
    });
    return;
  }

  if (request.method === "GET" && request.url === "/snapshot") {
    if (!latestSnapshot) {
      sendJson(response, 404, {
        ok: false,
        error: "No canvas snapshot has been published yet. Open the demo or host app with the control bridge enabled."
      });
      return;
    }

    sendJson(response, 200, { ok: true, snapshot: latestSnapshot });
    return;
  }

  if ((request.method === "PUT" || request.method === "POST") && request.url === "/snapshot") {
    try {
      const body = await readRequestBody(request);
      latestSnapshot = parseSnapshotPayload(body);
      sendJson(response, 200, { ok: true, snapshotUpdatedAt: latestSnapshot.updatedAt });
    } catch (error) {
      sendJson(response, 400, {
        ok: false,
        error: error instanceof Error ? error.message : "Invalid snapshot payload"
      });
    }
    return;
  }

  if (request.method === "GET" && request.url === "/events") {
    connectEventStream(request, response);
    return;
  }

  if (request.method === "POST" && request.url === "/operations") {
    try {
      const body = await readRequestBody(request);
      const payload = parseOperationPayload(body);
      const event = {
        id: `${Date.now()}-${++sequence}`,
        createdAt: new Date().toISOString(),
        label: payload.label || "Remote operation",
        detail: payload.detail || `Applied ${payload.operations.length} operation${payload.operations.length === 1 ? "" : "s"}.`,
        operations: payload.operations
      };

      broadcastOperations(event);
      sendJson(response, 200, { ok: true, clients: clients.size, event });
    } catch (error) {
      sendJson(response, 400, {
        ok: false,
        error: error instanceof Error ? error.message : "Invalid operation payload"
      });
    }
    return;
  }

  sendJson(response, 404, {
    ok: false,
    error: "Not found",
    routes: ["GET /health", "GET /events", "GET /snapshot", "PUT /snapshot", "POST /operations"]
  });
});

server.listen(port, host, () => {
  console.log(`Agent Canvas control server listening at http://${host}:${port}`);
  console.log(`POST CanvasOperation arrays to http://${host}:${port}/operations`);
});

function connectEventStream(request, response) {
  response.writeHead(200, {
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "Content-Type": "text/event-stream",
    "X-Accel-Buffering": "no"
  });
  response.write(`event: ready\ndata: ${JSON.stringify({ ok: true })}\n\n`);
  clients.add(response);

  request.on("close", () => {
    clients.delete(response);
  });
}

function broadcastOperations(event) {
  const data = JSON.stringify(event);
  for (const client of clients) {
    client.write(`event: operations\ndata: ${data}\n\n`);
  }
}

function parseOperationPayload(body) {
  const payload = JSON.parse(body || "{}");
  const operations = Array.isArray(payload)
    ? payload
    : Array.isArray(payload.operations)
      ? payload.operations
      : payload && typeof payload.type === "string"
        ? [payload]
        : undefined;

  if (!operations?.length) {
    throw new Error("Expected a CanvasOperation, a CanvasOperation array, or { operations }.");
  }

  for (const operation of operations) {
    if (!operation || typeof operation !== "object" || typeof operation.type !== "string") {
      throw new Error("Every operation must be an object with a string type.");
    }
  }

  return {
    operations,
    label: typeof payload.label === "string" ? payload.label : undefined,
    detail: typeof payload.detail === "string" ? payload.detail : undefined
  };
}

function parseSnapshotPayload(body) {
  const payload = JSON.parse(body || "{}");
  const snapshot = payload.snapshot && typeof payload.snapshot === "object" ? payload.snapshot : payload;

  if (!snapshot || typeof snapshot !== "object") {
    throw new Error("Expected a canvas snapshot object.");
  }

  if (!snapshot.document || typeof snapshot.document !== "object" || !Array.isArray(snapshot.document.nodes)) {
    throw new Error("Expected snapshot.document.nodes.");
  }

  return {
    ...snapshot,
    updatedAt: typeof snapshot.updatedAt === "string" ? snapshot.updatedAt : new Date().toISOString()
  };
}

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";

    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1024 * 1024) {
        request.destroy();
        reject(new Error("Request body is too large."));
      }
    });
    request.on("end", () => resolve(body));
    request.on("error", reject);
  });
}

function sendJson(response, status, payload) {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(`${JSON.stringify(payload, null, 2)}\n`);
}

function setCorsHeaders(response) {
  response.setHeader("Access-Control-Allow-Headers", "content-type");
  response.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,OPTIONS");
  response.setHeader("Access-Control-Allow-Origin", "*");
}
