/** Action schema returned by GET /api/schema */
export interface ActionSchema {
  name: string;
  label: string;
  category: string;
  description: string;
  triggers: string[];
  confirm: boolean;
  timeout: number;
  roles: string[];
  params: Record<string, ParamSchema>;
}

export interface ParamSchema {
  type: string;
  required?: boolean;
  whitelist?: boolean;
  min?: number;
  max?: number;
  default?: string | number;
  enum?: string[];
  pattern?: string;
}

export interface SchemaResponse {
  actions: Record<string, ActionSchema>;
}

export interface ActionResult {
  ok: boolean;
  output: string;
  error: string;
  data: Record<string, unknown>;
}
