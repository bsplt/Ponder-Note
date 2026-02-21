# Figma MCP

## Endpoint

- URL: `http://127.0.0.1:3845/mcp`
- Server type: Streamable HTTP (SSE responses)
- Every request is an HTTP POST
- The `Accept: application/json, text/event-stream` header is required

## Session handshake

1. Initialize

```http
POST http://127.0.0.1:3845/mcp
Content-Type: application/json
Accept: application/json, text/event-stream

{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"agent","version":"1.0"}},"id":1}
```

2. Send initialized notification

```http
POST http://127.0.0.1:3845/mcp
Content-Type: application/json
Accept: application/json, text/event-stream
mcp-session-id: <value from step 1>

{"jsonrpc":"2.0","method":"notifications/initialized"}
```

3. Call a tool

```http
POST http://127.0.0.1:3845/mcp
Content-Type: application/json
Accept: application/json, text/event-stream
mcp-session-id: <value from step 1>

{"jsonrpc":"2.0","method":"tools/call","params":{"name":"get_metadata","input":{}},"id":2}
```

## Response parsing

Responses are Server-Sent Events. Read the `data:` line and JSON-parse the payload.

```
event: message
data: {"result":{...},"jsonrpc":"2.0","id":2}
```

## Tools

- `get_metadata` returns the XML structure; use `nodeId: "0:1"` for the full page
- `get_screenshot` returns a base64 PNG image
- `get_design_context` returns React + Tailwind code with design details
- `get_variable_defs` returns design tokens/variables

If a tool supports `nodeId`, pass it to avoid manual selection. Note: `get_design_context`
can still require an active selection even with `nodeId` (MCP/Figma quirk). If it returns
"Nothing is selected", tell the user to select the target frame in Figma and re-run the
same request with the same `nodeId`.

## Required flow

1. Run `get_metadata` with `nodeId: "0:1"` to find frame IDs and hierarchy.
2. Run `get_design_context` with `nodeId` on the target node. If it returns
   "Nothing is selected", instruct the user to select the frame and retry.
3. Run `get_screenshot` with `nodeId` on the same node for visual validation.
4. Optionally run `get_variable_defs` with `nodeId` for tokens.
5. Implement using project conventions (tokens, components, typography).
6. Validate against the screenshot for 1:1 fidelity.
