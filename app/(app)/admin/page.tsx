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
    <div className="rounded-lg border border-input bg-background p-6 flex flex-col gap-1 hover:bg-accent/50 transition-colors">
      <span className="text-3xl font-bold tabular-nums">{value}</span>
      <span className="text-sm text-muted-foreground">{label}</span>
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
    <div className="p-8 max-w-5xl mx-auto flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Admin Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage the Neo4j knowledge graph
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-yellow-300 bg-yellow-50 dark:bg-yellow-950/20 px-4 py-3 text-sm text-yellow-800 dark:text-yellow-200">
          {error}
        </div>
      )}

      {/* Stat cards */}
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

      {/* Quick actions */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Quick Actions</h2>
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

      {/* Recent activity placeholder */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Recent Activity</h2>
        <div className="rounded-lg border border-input divide-y divide-input">
          {loading ? (
            <div className="p-4 text-sm text-muted-foreground">
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
        <span className="font-medium">{action}</span>
        <span className="text-muted-foreground text-xs">{detail}</span>
      </div>
      <span className="text-muted-foreground text-xs whitespace-nowrap">
        {time}
      </span>
    </div>
  );
}
