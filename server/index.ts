import dotenv from "dotenv";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createDeepSeekCaller } from "./provider.js";
import { getScenario, scenarios } from "./scenarios.js";
import { runExperiment } from "../src/experiment.js";
import type { CandidateCategory } from "../src/core.js";

dotenv.config({ path: ".env.local" });
dotenv.config();

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const port = Number(process.env.PORT || 8787);
const model = process.env.DEEPSEEK_MODEL || "deepseek-flash";
const complete = createDeepSeekCaller();

function sendJson(response: import("node:http").ServerResponse, status: number, value: unknown) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  response.end(JSON.stringify(value));
}

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
    if (request.method === "GET" && url.pathname === "/api/scenarios") return sendJson(response, 200, { scenarios: scenarios.map(({ paths: _paths, catalog: _catalog, ...scenario }) => scenario) });
    if (request.method === "GET" && url.pathname === "/api/config") return sendJson(response, 200, { model, hasApiKey: Boolean(process.env.DEEPSEEK_API_KEY) });
    if (request.method === "POST" && url.pathname === "/api/run") {
      let raw = "";
      for await (const chunk of request) raw += chunk;
      const body = JSON.parse(raw) as { scenarioId?: string; category?: CandidateCategory; task?: string };
      const category = body.category || "skill";
      const scenario = getScenario(body.scenarioId || scenarios[0]!.id, category, body.task);
      if (!scenario.task.trim()) return sendJson(response, 400, { error: "Task cannot be empty." });
      const result = await runExperiment({ scenario, task: scenario.task, model, complete });
      return sendJson(response, 200, result);
    }
    if (request.method === "GET") {
      const distRoot = join(root, "dist");
      const assetPath = url.pathname === "/" ? "index.html" : url.pathname.replace(/^\//, "");
      let filePath = join(distRoot, assetPath);
      const distPrefix = `${distRoot}${process.platform === "win32" ? "\\" : "/"}`;
      if (filePath !== join(distRoot, "index.html") && !filePath.startsWith(distPrefix)) {
        sendJson(response, 404, { error: "Not found" }); return;
      }
      try {
        const content = await readFile(filePath);
        const extension = filePath.split(".").pop();
        const contentType = extension === "html" ? "text/html" : extension === "js" ? "text/javascript" : extension === "css" ? "text/css" : extension === "svg" ? "image/svg+xml" : "application/octet-stream";
        response.writeHead(200, { "Content-Type": `${contentType}; charset=utf-8` }); response.end(content); return;
      } catch {
        try {
          await readFile(join(distRoot, "index.html"));
          filePath = join(distRoot, "index.html");
        } catch { filePath = join(root, "index.html"); }
        try {
          const content = await readFile(filePath);
          response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }); response.end(content); return;
        } catch { sendJson(response, 404, { error: "Not found" }); return; }
      }
    }
    sendJson(response, 404, { error: "Not found" });
  } catch (error) {
    sendJson(response, 500, { error: error instanceof Error ? error.message : "Unexpected server error." });
  }
});

server.listen(port, "127.0.0.1", () => console.log(`Jev demo server listening on http://127.0.0.1:${port}`));
