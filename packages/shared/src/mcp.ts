/** Model Context Protocol (MCP) client contracts. */

/** A configured MCP server (stdio spawn, or streamable HTTP when `url` is set). */
export interface McpServerConfig {
  id: string;
  name: string;
  /** Executable to spawn, e.g. "npx". Ignored when `url` is set. */
  command: string;
  /** Arguments, e.g. ["-y", "@modelcontextprotocol/server-filesystem", "/path"]. */
  args: string[];
  /** Streamable-HTTP MCP endpoint (e.g. a NekkoMCP gateway). When set, we connect over HTTP instead of spawning. */
  url?: string;
  /** Bearer token sent as `Authorization: Bearer <token>` on HTTP requests. */
  token?: string;
  enabled: boolean;
}

/** A tool exposed by an MCP server. */
export interface McpToolInfo {
  name: string;
  description?: string;
}

/** A running NekkoMCP daemon (github.com/nekko-labs/nekko-mcp) discovered on this machine. */
export interface NekkoMcpInfo {
  /** Streamable-HTTP gateway endpoint (one URL for every managed server). */
  url: string;
  /** Gateway bearer token. */
  token?: string;
  /** The daemon's management web UI. */
  uiUrl?: string;
  /** Managed server count. */
  servers: number;
  version: string;
}

/** Live connection status for an MCP server. */
export interface McpServerStatus {
  id: string;
  name: string;
  connected: boolean;
  tools: McpToolInfo[];
  error?: string;
}
