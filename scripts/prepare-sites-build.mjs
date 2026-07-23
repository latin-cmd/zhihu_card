import { copyFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const hostingSource = ".openai/hosting.json";
const hostingTarget = "dist/.openai/hosting.json";
const indexTarget = "dist/server/index.js";

await mkdir(dirname(hostingTarget), { recursive: true });
await copyFile(hostingSource, hostingTarget);

await writeFile(indexTarget, "export { default } from './entry.mjs';\n", "utf8");
