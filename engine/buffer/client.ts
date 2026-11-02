/**
 * One call to Buffer's own MCP server, https://mcp.buffer.com/mcp.
 * Its tools are never handed to the model as-is: the server also offers
 * `delete_post`, `execute_mutation` and `shareNow`. engine/buffer/tools.ts
 * wraps three of them with fixed arguments.
 *
 * Author: Chloe Bibiane Pilon Vaillancourt
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

export const BUFFER_MCP_URL = "https://mcp.buffer.com/mcp";

/** Where to get the key. Printed by `houselabel connect buffer`. */
export const BUFFER_KEY_URL = "https://publish.buffer.com/settings/api";

/** The Buffer MCP tools this repo ever calls. Everything else on the server
 *  stays unreachable — see the header. */
export type BufferToolName = "get_account" | "list_channels" | "list_posts" | "create_post";

/** The seam tests replace: name + arguments in, the tool's text out. */
export type BufferCall = (name: BufferToolName, args: Record<string, unknown>) => Promise<string>;

/** A caller bound to one API key. Opens a session per call: a campaign drafts
 *  a handful of posts, and a held-open session is one more thing to leak. */
export function bufferCaller(key: string): BufferCall {
  return async (name, args) => {
    const client = new Client({ name: "houselabel", version: "0.1.0" });
    const transport = new StreamableHTTPClientTransport(new URL(BUFFER_MCP_URL), {
      requestInit: { headers: { Authorization: `Bearer ${key}` } },
    });
    try {
      await client.connect(transport);
      const res = await client.callTool({ name, arguments: args });
      const text = (res.content as { type: string; text?: string }[])
        .filter((c) => c.type === "text")
        .map((c) => c.text ?? "")
        .join("\n");
      if (res.isError) throw new Error(text || `Buffer refused ${name}`);
      return text;
    } finally {
      await client.close().catch(() => {});
    }
  };
}
