# Agent request signature protocol

Agent-authorized requests carry these headers:

- `X-Agent-Card-Id`: active Agent Card ID.
- `X-Agent-Key-Id`: active Agent signing-key ID returned by claim.
- `X-Agent-Timestamp`: current Unix time in seconds, accepted within five minutes.
- `X-Agent-Nonce`: a unique 16–200 character base64url-style value.
- `X-Agent-Signature`: base64url-encoded ES256 signature.

Sign this UTF-8 canonical value with the Agent's P-256 private key:

```text
METHOD
PATH_WITH_QUERY
TIMESTAMP
NONCE
BASE64URL_SHA256_BODY
```

The method is uppercase. `PATH_WITH_QUERY` begins with `/`. Hash the exact transmitted body bytes. Never reuse a nonce. The server checks the active Agent Card, bound key, requested scope, signature, timestamp, nonce, Space ownership, and Card version.
