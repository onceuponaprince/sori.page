"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import Link from "next/link";

const STATUSES = [
  "all",
  "proposed",
  "under_review",
  "pending_consensus",
  "canonized",
] as const;

type Status = (typeof STATUSES)[number];

interface Concept {
  id: string;
  name: string;
  description: string;
  status: string;
  depth_score: number;
  confidence: number;
  node_type?: string;
}

export default function ConceptsPage() {
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<Status>("all");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creating, setCreating] = useState(false);

  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newStatus, setNewStatus] = useState("proposed");
  const [newDepthScore, setNewDepthScore] = useState("1");

  const fetchConcepts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (searchQuery) params.set("q", searchQuery);
      const res = await fetch(`/api/admin/concepts?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setConcepts(data.results || data);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [statusFilter, searchQuery]);

  useEffect(() => {
    fetchConcepts();
  }, [fetchConcepts]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await fetch("/api/admin/concepts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName,
          description: newDescription,
          status: newStatus,
          depth_score: parseInt(newDepthScore),
        }),
      });
      if (res.ok) {
        setNewName("");
        setNewDescription("");
        setNewStatus("proposed");
        setNewDepthScore("1");
        setShowCreateForm(false);
        fetchConcepts();
      }
    } catch {
      // handle error
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 p-8">
      <div className="flex items-center justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2" style={{ fontFamily: "var(--font-body)", fontSize: "0.78rem", color: "#8A857E" }}>
            <Link href="/admin" className="underline underline-offset-2 hover:text-foreground transition-colors">
              Admin
            </Link>
            <span>/</span>
            <span>Concepts</span>
          </div>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: "1.5rem", fontWeight: 500 }} className="text-foreground">
            Concept Management
          </h1>
        </div>
        <Button onClick={() => setShowCreateForm(!showCreateForm)}>
          {showCreateForm ? "Cancel" : "New Concept"}
        </Button>
      </div>

      {showCreateForm && (
        <form
          onSubmit={handleCreate}
          className="border border-border bg-card flex flex-col gap-4 p-6"
        >
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: "1rem", fontWeight: 500 }} className="text-foreground">Create New Concept</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label style={{ fontFamily: "var(--font-body)", fontSize: "0.78rem", fontWeight: 500 }}>Name</label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Hero's Journey"
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label style={{ fontFamily: "var(--font-body)", fontSize: "0.78rem", fontWeight: 500 }}>Status</label>
              <select
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value)}
                style={{ fontFamily: "var(--font-body)", fontSize: "0.78rem" }}
                className="flex h-10 w-full border border-border bg-transparent px-3 py-2 text-foreground focus-visible:outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/35"
              >
                <option value="proposed">Proposed</option>
                <option value="under_review">Under Review</option>
                <option value="pending_consensus">Pending Consensus</option>
                <option value="canonized">Canonized</option>
              </select>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label style={{ fontFamily: "var(--font-body)", fontSize: "0.78rem", fontWeight: 500 }}>Description</label>
            <Textarea
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="Describe this narrative concept..."
              rows={3}
              required
            />
          </div>
          <div className="flex flex-col gap-1.5 max-w-[200px]">
            <label style={{ fontFamily: "var(--font-body)", fontSize: "0.78rem", fontWeight: 500 }}>Depth Score</label>
            <Input
              type="number"
              min="1"
              max="10"
              value={newDepthScore}
              onChange={(e) => setNewDepthScore(e.target.value)}
            />
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={creating}>
              {creating ? "Creating..." : "Create Concept"}
            </Button>
          </div>
        </form>
      )}

      <div className="flex flex-col md:flex-row gap-3">
        <Input
          placeholder="Search concepts..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="md:max-w-xs"
        />
        <div className="flex gap-1 flex-wrap">
          {STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              style={{ fontFamily: "var(--font-body)", fontSize: "0.68rem" }}
              className={`px-3 py-1.5 font-medium transition-colors border cursor-pointer ${
                statusFilter === s
                  ? "bg-foreground text-background border-foreground"
                  : "bg-transparent text-muted-foreground border-border hover:border-foreground hover:text-foreground"
              }`}
            >
              {s === "all" ? "All" : s.replace(/_/g, " ")}
            </button>
          ))}
        </div>
      </div>

      <div className="border border-border bg-card divide-y divide-border">
        {loading ? (
          <div className="p-6 text-center" style={{ fontFamily: "var(--font-body)", fontSize: "0.78rem", color: "#8A857E" }}>
            Loading concepts...
          </div>
        ) : concepts.length === 0 ? (
          <div className="p-6 text-center" style={{ fontFamily: "var(--font-body)", fontSize: "0.78rem", color: "#8A857E" }}>
            No concepts found. Create one above or adjust your filters.
          </div>
        ) : (
          concepts.map((concept) => (
            <div
              key={concept.id}
              className="flex flex-col justify-between gap-2 p-4 transition-colors hover:bg-secondary/50 md:flex-row md:items-center"
            >
              <div className="flex flex-col gap-0.5">
                <span style={{ fontFamily: "var(--font-body)", fontWeight: 500 }} className="text-foreground">{concept.name}</span>
                <span style={{ fontFamily: "var(--font-body)", fontSize: "0.68rem", color: "#8A857E" }} className="line-clamp-1">
                  {concept.description}
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs shrink-0">
                <StatusBadge status={concept.status} />
                <span style={{ color: "#8A857E" }}>
                  depth: {concept.depth_score}
                </span>
                <span style={{ color: "#8A857E" }}>
                  conf: {(concept.confidence * 100).toFixed(0)}%
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    proposed: "border-foreground/20 text-foreground",
    under_review: "border-accent/40 text-accent",
    pending_consensus: "border-accent/30 text-accent/80",
    canonized: "border-foreground bg-foreground text-background",
  };
  return (
    <span
      style={{ fontFamily: "var(--font-body)", fontSize: "0.6rem", letterSpacing: "0.1em", textTransform: "uppercase" }}
      className={`px-2 py-0.5 border font-medium ${colors[status] || "border-border text-muted-foreground"}`}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}
