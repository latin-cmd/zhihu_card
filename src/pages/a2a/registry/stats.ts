import { json, registryStats } from "../../../lib/a2a-registry";

export function GET() {
  return json(registryStats());
}
