# Figma MCP Examples

## Discover component variants

```http
POST http://127.0.0.1:3845/mcp
Content-Type: application/json
Accept: application/json, text/event-stream
mcp-session-id: <value from initialize>

{"jsonrpc":"2.0","method":"tools/call","params":{"name":"get_metadata","input":{"nodeId":"0:1"}},"id":1}
```

Metadata reveals the component tree and variant node IDs.

```http
POST http://127.0.0.1:3845/mcp
Content-Type: application/json
Accept: application/json, text/event-stream
mcp-session-id: <value from initialize>

{"jsonrpc":"2.0","method":"tools/call","params":{"name":"get_design_context","input":{"nodeId":"1:319"}},"id":2}
```

```http
POST http://127.0.0.1:3845/mcp
Content-Type: application/json
Accept: application/json, text/event-stream
mcp-session-id: <value from initialize>

{"jsonrpc":"2.0","method":"tools/call","params":{"name":"get_screenshot","input":{"nodeId":"1:319"}},"id":3}
```
