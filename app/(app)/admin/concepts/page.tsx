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

  // New concept form
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
      // silently fail — empty state shows
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
    <div className="p-8 max-w-5xl mx-auto flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <Link href="/admin" className="hover:underline">
              Admin
            </Link>
            <span>/</span>
            <span>Concepts</span>
          </div>
          <h1 className="text-2xl font-bold">Concept Management</h1>
        </div>
        <Button onClick={() => setShowCreateForm(!showCreateForm)}>
          {showCreateForm ? "Cancel" : "New Concept"}
        </Button>
      </div>

      {/* Create form */}
      {showCreateForm && (
        <form
          onSubmit={handleCreate}
          className="rounded-lg border border-input p-6 flex flex-col gap-4"
        >
          <h2 className="font-semibold">Create New Concept</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Name</label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Hero's Journey"
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Status</label>
              <select
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="proposed">Proposed</option>
                <option value="under_review">Under Review</option>
                <option value="pending_consensus">Pending Consensus</option>
                <option value="canonized">Canonized</option>
              </select>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Description</label>
            <Textarea
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="Describe this narrative concept..."
              rows={3}
              required
            />
          </div>
          <div className="flex flex-col gap-1.5 max-w-[200px]">
            <label className="text-sm font-medium">Depth Score</label>
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

      {/* Filters */}
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
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                statusFilter === s
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
              }`}
            >
              {s === "all" ? "All" : s.replace(/_/g, " ")}
            </button>
          ))}
        </div>
      </div>

      {/* Concept list */}
      <div className="rounded-lg border border-input divide-y divide-input">
        {loading ? (
          <div className="p-6 text-sm text-muted-foreground text-center">
            Loading concepts...
          </div>
        ) : concepts.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground text-center">
            No concepts found. Create one above or adjust your filters.
          </div>
        ) : (
          concepts.map((concept) => (
            <div
              key={concept.id}
              className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-2 hover:bg-accent/30 transition-colors"
            >
              <div className="flex flex-col gap-0.5">
                <span className="font-medium">{concept.name}</span>
                <span className="text-muted-foreground text-xs line-clamp-1">
                  {concept.description}
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs shrink-0">
                <StatusBadge status={concept.status} />
                <span className="text-muted-foreground">
                  depth: {concept.depth_score}
                </span>
                <span className="text-muted-foreground">
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
    proposed: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
    under_review:
      "bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300",
    pending_consensus:
      "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300",
    canonized:
      "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
  };
  return (
    <span
      className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[status] || "bg-muted text-muted-foreground"}`}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}
