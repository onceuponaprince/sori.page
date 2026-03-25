import type {
  ApiBranchResponse,
  ApiCommitResponse,
  ChoiceIntent,
  MultiverseState,
} from "@/types/multiverse";

interface RequestOptions {
  method?: "GET" | "POST";
  body?: unknown;
  cache?: RequestCache;
}

export interface ContextEngineClientOptions {
  baseUrl: string;
  apiKey?: string;
  tenantId?: string;
}

export interface StartSimulationRequest {
  story_uid: string;
  scene_goal: string;
  character_ids: [string, string];
  state_snapshot_id: string | null;
  parent_node_id: string | null;
}

export interface StartSimulationResponse {
  taskId: string;
  nodeId: string;
}

export interface BranchRequest {
  source_node_id: string;
  choice_label: string;
  intent: ChoiceIntent;
  state_snapshot_id: string;
}

export interface CommitRequest {
  node_id: string;
  story_uid: string;
}

interface GraphSearchResponse {
  results: Array<{
    uid: string;
    name: string;
    description: string;
    depth_score: number;
    confidence: number;
    relevance_score: number;
    type: string;
  }>;
  source: string;
}

export function createContextEngineClient(options: ContextEngineClientOptions) {
  const baseUrl = options.baseUrl.replace(/\/$/, "");

  async function request<T>(path: string, requestOptions: RequestOptions = {}): Promise<T> {
    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };
    if (options.apiKey) {
      headers["X-API-Key"] = options.apiKey;
    }
    if (options.tenantId) {
      headers["X-Tenant-Id"] = options.tenantId;
    }

    const response = await fetch(`${baseUrl}${path}`, {
      method: requestOptions.method ?? "GET",
      headers,
      cache: requestOptions.cache,
      body: requestOptions.body ? JSON.stringify(requestOptions.body) : undefined,
    });

    if (!response.ok) {
      const errorPayload = await response.json().catch(() => ({}));
      const message =
        errorPayload?.error || errorPayload?.detail || `HTTP ${response.status}`;
      throw new Error(message);
    }
    return (await response.json()) as T;
  }

  return {
    searchConcepts(query: string, limit = 10) {
      const encoded = encodeURIComponent(query);
      return request<GraphSearchResponse>(
        `/api/graph/concepts/search/?q=${encoded}&limit=${limit}`,
        { method: "GET", cache: "no-store" },
      );
    },

    analyzeOutline(payload: {
      outline: string;
      title?: string;
      story_uid?: string;
      enrich?: boolean;
    }) {
      return request<Record<string, unknown>>("/api/retrieval/analyze/", {
        method: "POST",
        body: payload,
      });
    },

    getMultiverseTree(storyUid: string) {
      return request<Pick<MultiverseState, "rootNodeId" | "nodes">>(
        `/api/agent/multiverse/${storyUid}/`,
      );
    },

    startSimulation(payload: StartSimulationRequest) {
      return request<StartSimulationResponse>("/api/agent/simulate/", {
        method: "POST",
        body: payload,
      });
    },

    getSimulationStatus(taskId: string) {
      return request<{ state: string; data: any; error: string | null }>(
        `/api/agent/simulate/${taskId}/status/`,
      );
    },

    createBranch(payload: BranchRequest) {
      return request<ApiBranchResponse>("/api/agent/branch/", {
        method: "POST",
        body: payload,
      });
    },

    commitBranch(payload: CommitRequest) {
      return request<ApiCommitResponse>("/api/agent/commit/", {
        method: "POST",
        body: payload,
      });
    },
  };
}
