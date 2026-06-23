// The gated tool descriptor — the model's ONLY way to act (CONTRACTS.md). The browser
// and codify factories both emit `{ name, def }` pairs; each consumer adapts them:
//   • harness:   makeBrowserTools(...).map(({name, def}) => defineTool(name, def))
//   • extension: makeBrowserTools(...).map(({name, def}) => ({ name, ...def }))

/** A tool result returned to the model: plain text, or a structured failure/denial. */
export type ToolResult =
  | string
  | { textResultForLlm: string; resultType: 'success' | 'failure' | 'denied' };

/** The definition half of a gated tool descriptor (description + JSON-Schema params + handler). */
export interface ToolDef {
  description: string;
  parameters: Record<string, unknown>;
  handler: (args: any) => ToolResult | Promise<ToolResult>;
  skipPermission?: boolean;
}

/** A named, gated tool — the unit the model's capability surface is built from. */
export interface ToolDescriptor {
  name: string;
  def: ToolDef;
}
