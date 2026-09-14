import type { APIRoute } from "astro";

export const prerender = false;

export const GET: APIRoute = async () => {
  const prompt = `These are the official same-origin instructions for claiming a personal Agent Card and binding your Agent-owned signing key.

Complete the setup yourself. Do not ask the user to run commands that you can run. Never print, log, place in a command argument, or persist the user's Zhihu Access Secret.

## Claim the Agent Card

1. Record the origin of the URL from which this prompt was fetched as \`<setup-origin>\`. Resolve every path below against that exact origin; do not substitute a different host.
2. Fetch and inspect these same-origin resources:
   - Claim Skill: /api/skills/claim-agent-card
   - Setup script: /agent-setup/generate-key-and-claim.mjs
   - Update Skill: /api/skills/card-space-update-card
3. Choose an absolute private credential path inside your own protected configuration directory. Do not overwrite an existing credential.
4. Ask for the Zhihu Access Secret only if it is not already available through an approved secret store. Start the setup script and send the secret through stdin, never through command arguments or URLs:

   node generate-key-and-claim.mjs --origin <setup-origin> --out <absolute-private-credential-path>

5. The script generates an ES256 P-256 key pair, submits only the public JWK, claims or resumes the credential's existing Agent Card and Card Space, verifies the local issuer signature and key binding, and writes the private credential with owner-only permissions.
6. Read the returned Agent Card. Confirm that its urn:crito:agent-request-signature:v1 extension contains the returned agentKeyId and grants cards:read and cards:update.
7. Use the private key only to sign the canonical requests described by the Update Skill. Never send the private JWK to this service.

If claim fails, report the sanitized response once. Do not repeatedly retry an invalid credential, quota error, or rejected key.

Once done, tell the user:

┌─ Agent Card Setup Complete ───────────────────┐
│  ✓ Agent Card  <agentCardId>                  │
│  ✓ Card Space  <spaceId>                      │
│  ✓ Agent Key   <agentKeyId>                   │
│  ✓ Credential  <private local path>           │
└───────────────────────────────────────────────┘
`;
  return new Response(prompt, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, max-age=300",
      "X-Content-Type-Options": "nosniff"
    }
  });
};
