import { json, registry } from "../../../lib/a2a-registry";

export function GET() {
  return json(registry);
}
