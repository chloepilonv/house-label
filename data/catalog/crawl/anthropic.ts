/**
 * The one place the catalog side constructs an Anthropic client.
 * Org-scoped keys get a 400 unless the request names a workspace, so
 * ANTHROPIC_WORKSPACE_ID is sent as a header when set (as in engine/providers.ts).
 */

import Anthropic from "@anthropic-ai/sdk";

export const anthropic = () =>
  new Anthropic(
    process.env.ANTHROPIC_WORKSPACE_ID
      ? { defaultHeaders: { "anthropic-workspace-id": process.env.ANTHROPIC_WORKSPACE_ID } }
      : {},
  );
