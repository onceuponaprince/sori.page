"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

interface GraphStats {
  total_concepts: number;
  total_functions: number;
  total_instances: number;
  total_gaps: number;
}

const FALLBACK_STATS: GraphStats = {
  total_concepts: 0,
  total_functions: 0,
  total_instances: 0,
  total_gaps: 0,
};

function StatCard({
  label,
  value,
  href,
}: {
  label: string;
  value: number;
  href?: string;
}) {
  const content = (
    <div className="border border-border bg-card flex flex-col gap-1 p-6 transition-colors hover:border-foreground">
      <span style={{ fontFamily: "var(--font-display)", fontSize: "1.5rem", fontWeight: 500 }} className="tabular-nums text-foreground">
        {value}
      </span>
      <span style={{ fontFamily: "var(--font-body)", fontSize: "0.78rem", color: "#8A857E" }}>{label}</span>
    </div>
  );
  if (href) return <Link href={href}>{content}</Link>;
  return content;
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<GraphStats>(FALLBACK_STATS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchStats() {
      try {
        const backendUrl =
          process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
        const res = await fetch(`${backendUrl}/api/backend/graph/stats/`);
        if (res.ok) {
          const data = await res.json();
          setStats(data);
        } else {
          setError("Backend returned an error. Showing defaults.");
        }
      } catch {
        setError("Backend not reachable. Showing defaults.");
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, []);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8 p-8">
      <div className="flex items-center justify-between">
        <div>
          <p className="sori-kicker">admin</p>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: "1.5rem", fontWeight: 500 }} className="mt-2 text-foreground">
            Admin Dashboard
          </h1>
          <p style={{ fontFamily: "var(--font-body)", fontSize: "0.78rem", color: "#8A857E" }} className="mt-1">
            Manage the Neo4j knowledge graph
          </p>
        </div>
      </div>

      {error && (
        <div className="border border-yellow-600/30 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Concepts"
          value={stats.total_concepts}
          href="/admin/concepts"
        />
        <StatCard label="Functions" value={stats.total_functions} />
        <StatCard label="Instances" value={stats.total_instances} />
        <StatCard label="Gaps" value={stats.total_gaps} href="/gaps" />
      </div>

      <div>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: "1.15rem", fontWeight: 500 }} className="mb-3 text-foreground">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          <Button asChild>
            <Link href="/admin/concepts">Manage Concepts</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/admin/upload">Upload Script</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/gaps">View Gaps</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/contribute">Contribute</Link>
          </Button>
        </div>
      </div>

      <div>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: "1.15rem", fontWeight: 500 }} className="mb-3 text-foreground">Recent Activity</h2>
        <div className="border border-border bg-card divide-y divide-border">
          {loading ? (
            <div className="p-4 text-sm" style={{ color: "#8A857E" }}>
              Loading...
            </div>
          ) : (
            <>
              <ActivityRow
                action="Dashboard loaded"
                detail={`${stats.total_concepts} concepts in graph`}
                time="just now"
              />
              <ActivityRow
                action="Graph stats fetched"
                detail={`${stats.total_functions} functions, ${stats.total_instances} instances`}
                time="just now"
              />
              <ActivityRow
                action="Gap detection"
                detail={`${stats.total_gaps} gaps pending resolution`}
                time="ongoing"
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ActivityRow({
  action,
  detail,
  time,
}: {
  action: string;
  detail: string;
  time: string;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3 text-sm">
      <div className="flex flex-col gap-0.5">
        <span style={{ fontFamily: "var(--font-body)", fontWeight: 500 }}>{action}</span>
        <span style={{ fontFamily: "var(--font-body)", fontSize: "0.68rem", color: "#8A857E" }}>{detail}</span>
      </div>
      <span style={{ fontFamily: "var(--font-body)", fontSize: "0.68rem", color: "#8A857E" }} className="whitespace-nowrap">
        {time}
      </span>
    </div>
  );
}
