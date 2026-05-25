export interface CharacterFrontmatter {
  id: string;
  name: string;
  tags?: string[];
  role_hint?: string;
  voice?: string;
  knowledge?: string[];
}

export interface PlaygroundCharacter {
  id: string;
  name: string;
  roleHint: string | null;
  aliases: string[];
  virtualPath: string;
  sourceType: "md" | "react" | "analyzer";
  draftRevision: number;
  publishedAt: string | null;
  publishedRevision: number;
  reviewStatus: "none" | "pending" | "approved" | "rejected";
  tags: string[];
  isPublished: boolean;
  draftSource?: string;
  publishedSource?: string;
  /** ISO timestamp when available from the API; used for sort. */
  updatedAt?: string | null;
}
