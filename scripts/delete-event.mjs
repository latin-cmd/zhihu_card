import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

function loadEnvFile(path = ".env") {
  if (!existsSync(path)) {
    return;
  }

  const lines = readFileSync(path, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
      continue;
    }

    const index = trimmed.indexOf("=");
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, "");
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function readArg(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) {
    return "";
  }
  return process.argv[index + 1] ?? "";
}

loadEnvFile();

const slug = process.argv.find((arg, index) => index > 1 && !arg.startsWith("--"));
const baseUrl =
  readArg("--base-url") ||
  process.env.WORKER_URL ||
  "https://communist-activity-web.m937746825.workers.dev";
const token = process.env.BACKOFFICE_API_TOKEN;

if (!slug) {
  console.error("Usage: npm run event:delete -- <slug> [--base-url https://worker.example]");
  process.exit(1);
}

if (!token) {
  console.error("BACKOFFICE_API_TOKEN is required in .env or the shell environment.");
  process.exit(1);
}

const url = `${baseUrl.replace(/\/$/, "")}/api/admin/events/${encodeURIComponent(slug)}`;
const origin = new URL(baseUrl).origin;
async function deleteWithFetch() {
  const response = await fetch(url, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
      Origin: origin
    }
  });

  const text = await response.text();
  return {
    status: response.status,
    ok: response.ok,
    text
  };
}

function deleteWithPowerShell() {
  const powershell =
    process.env.SystemRoot
      ? `${process.env.SystemRoot}\\System32\\WindowsPowerShell\\v1.0\\powershell.exe`
      : "powershell.exe";
  const script = [
    "$ErrorActionPreference='Stop'",
    "$headers = @{ Authorization = \"Bearer $env:BACKOFFICE_API_TOKEN\"; Origin = $env:DELETE_EVENT_ORIGIN }",
    "try {",
    "  $response = Invoke-WebRequest -UseBasicParsing -Method Delete -Uri $env:DELETE_EVENT_URL -Headers $headers",
    "  \"STATUS:$($response.StatusCode)\"",
    "  $response.Content",
    "} catch {",
    "  $status = $_.Exception.Response.StatusCode.value__",
    "  \"STATUS:$status\"",
    "  if ($_.ErrorDetails.Message) { $_.ErrorDetails.Message }",
    "  exit 0",
    "}"
  ].join("; ");

  const child = spawnSync(powershell, ["-NoProfile", "-Command", script], {
    encoding: "utf8",
    env: {
      ...process.env,
      DELETE_EVENT_URL: url,
      DELETE_EVENT_ORIGIN: origin
    }
  });

  if (child.error) {
    throw child.error;
  }

  const output = `${child.stdout ?? ""}${child.stderr ?? ""}`.trim();
  const match = output.match(/STATUS:(\d+)/);
  if (!match) {
    throw new Error(output || "PowerShell request failed");
  }

  return {
    status: Number(match[1]),
    ok: Number(match[1]) >= 200 && Number(match[1]) < 300,
    text: output.replace(/STATUS:\d+\s*/, "").trim()
  };
}

let result;
try {
  result = await deleteWithFetch();
} catch (error) {
  if (process.platform !== "win32") {
    throw error;
  }
  result = deleteWithPowerShell();
}

let body = result.text;
try {
  body = JSON.stringify(JSON.parse(result.text), null, 2);
} catch {
  // Keep the raw response text for non-JSON upstream errors.
}

console.log(`DELETE ${url}`);
console.log(`Status: ${result.status}`);
console.log(body);

if (!result.ok) {
  process.exit(1);
}
