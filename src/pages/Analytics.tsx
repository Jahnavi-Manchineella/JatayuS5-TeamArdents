import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Activity, MessageSquare, FileText, Users, Search, ThumbsUp, ThumbsDown, Clock, DollarSign, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
interface AuditLog {
  id: string;
  query: string;
  category: string | null;
  created_at: string | null;
  user_id: string | null;
  response?: string | null;
  retrieved_chunks?: any;
  feedback?: string | null;
}

// Tunable ROI constants
const MINUTES_SAVED_PER_DEFLECTION = 8;
const HOURLY_RATE_USD = 35;

const COLORS = [
  "hsl(175, 65%, 45%)",
  "hsl(45, 90%, 55%)",
  "hsl(260, 60%, 55%)",
  "hsl(340, 65%, 55%)",
];

export default function Analytics() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [search, setSearch] = useState("");
  const [docCount, setDocCount] = useState(0);
  const [ticketUserIds, setTicketUserIds] = useState<Record<string, number>>({});
  const [profileMap, setProfileMap] = useState<Record<string, string>>({});
  const [expandedAudit, setExpandedAudit] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("audit_logs")
        .select("id, query, category, created_at, user_id, response, retrieved_chunks, feedback")
        .order("created_at", { ascending: false })
        .limit(200);
      setLogs(data || []);

      const { count } = await supabase
        .from("documents")
        .select("id", { count: "exact", head: true });
      setDocCount(count || 0);

      // Tickets per user, for deflection %
      const { data: ticketRows } = await supabase
        .from("tickets")
        .select("user_id");
      const map: Record<string, number> = {};
      (ticketRows || []).forEach((t: any) => {
        if (!t.user_id) return;
        map[t.user_id] = (map[t.user_id] || 0) + 1;
      });
      setTicketUserIds(map);

      // Profile names
      const { data: profs } = await supabase.from("profiles").select("user_id, full_name");
      const pm: Record<string, string> = {};
      (profs || []).forEach((p: any) => {
        pm[p.user_id] = p.full_name || "";
      });
      setProfileMap(pm);
    };
    load();
  }, []);

  // Category breakdown
  const catCounts: Record<string, number> = {};
  logs.forEach((l) => {
    const cat = l.category || "General Operations";
    catCounts[cat] = (catCounts[cat] || 0) + 1;
  });
  const pieData = Object.entries(catCounts).map(([name, value]) => ({ name, value }));

  // Daily query counts (last 7 days)
  const dailyCounts: Record<string, number> = {};
  const now = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    dailyCounts[d.toLocaleDateString("en-US", { weekday: "short" })] = 0;
  }
  logs.forEach((l) => {
    if (!l.created_at) return;
    const d = new Date(l.created_at);
    const key = d.toLocaleDateString("en-US", { weekday: "short" });
    if (key in dailyCounts) dailyCounts[key]++;
  });
  const barData = Object.entries(dailyCounts).map(([day, count]) => ({ day, count }));

  // Unique users
  const uniqueUsers = new Set(logs.map((l) => l.user_id).filter(Boolean)).size;

  const filteredLogs = logs.filter((l) =>
    l.query.toLowerCase().includes(search.toLowerCase())
  );

  // ===== ROI =====
  const roi = useMemo(() => {
    const perUser: Record<string, { queries: number; tickets: number }> = {};
    logs.forEach((l) => {
      if (!l.user_id) return;
      if (!perUser[l.user_id]) perUser[l.user_id] = { queries: 0, tickets: 0 };
      perUser[l.user_id].queries += 1;
    });
    Object.entries(ticketUserIds).forEach(([uid, count]) => {
      if (!perUser[uid]) perUser[uid] = { queries: 0, tickets: 0 };
      perUser[uid].tickets = count;
    });
    const rows = Object.entries(perUser).map(([uid, v]) => {
      const deflected = Math.max(0, v.queries - v.tickets);
      const rate = v.queries > 0 ? deflected / v.queries : 0;
      const hours = (deflected * MINUTES_SAVED_PER_DEFLECTION) / 60;
      return {
        uid,
        name: profileMap[uid] || uid.slice(0, 8) + "…",
        queries: v.queries,
        tickets: v.tickets,
        deflected,
        rate,
        hours,
      };
    });
    rows.sort((a, b) => b.queries - a.queries);
    const totals = rows.reduce(
      (acc, r) => {
        acc.queries += r.queries;
        acc.tickets += r.tickets;
        acc.deflected += r.deflected;
        acc.hours += r.hours;
        return acc;
      },
      { queries: 0, tickets: 0, deflected: 0, hours: 0 },
    );
    const overallRate = totals.queries > 0 ? totals.deflected / totals.queries : 0;
    return { rows, totals, overallRate, costSaved: totals.hours * HOURLY_RATE_USD };
  }, [logs, ticketUserIds, profileMap]);

  return (
    <div className="p-6 h-[calc(100vh-64px)] overflow-y-auto">
      <h1 className="text-xl font-bold text-foreground mb-6">Analytics Dashboard</h1>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="roi">ROI</TabsTrigger>
          <TabsTrigger value="audit">Audit Explorer</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
      {/* Stats cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total Queries", value: logs.length, icon: MessageSquare, color: "text-primary" },
          { label: "Documents", value: docCount, icon: FileText, color: "text-accent" },
          { label: "Active Users", value: uniqueUsers, icon: Users, color: "text-chart-3" },
          { label: "Categories", value: Object.keys(catCounts).length, icon: Activity, color: "text-chart-4" },
        ].map((stat) => (
          <div key={stat.label} className="glass-panel rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">{stat.label}</span>
              <stat.icon className={`w-4 h-4 ${stat.color}`} />
            </div>
            <p className="text-2xl font-bold text-foreground">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="glass-panel rounded-xl p-4">
          <h3 className="text-sm font-medium text-foreground mb-4">Queries (Last 7 Days)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={barData}>
              <XAxis dataKey="day" tick={{ fill: "hsl(215, 15%, 55%)", fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "hsl(215, 15%, 55%)", fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{
                  background: "hsl(222, 40%, 10%)",
                  border: "1px solid hsl(222, 25%, 18%)",
                  borderRadius: "8px",
                  color: "hsl(210, 20%, 92%)",
                }}
              />
              <Bar dataKey="count" fill="hsl(175, 65%, 45%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="glass-panel rounded-xl p-4">
          <h3 className="text-sm font-medium text-foreground mb-4">Query Categories</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={4}
                dataKey="value"
              >
                {pieData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: "hsl(222, 40%, 10%)",
                  border: "1px solid hsl(222, 25%, 18%)",
                  borderRadius: "8px",
                  color: "hsl(210, 20%, 92%)",
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-2 mt-2 justify-center">
            {pieData.map((d, i) => (
              <span key={d.name} className="text-xs flex items-center gap-1">
                <span className="w-2 h-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                <span className="text-muted-foreground">{d.name} ({d.value})</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Audit log table */}
      <div className="glass-panel rounded-xl overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h3 className="text-sm font-medium text-foreground">Audit Log</h3>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search queries..."
              className="pl-10 h-8 text-sm bg-secondary/50 border-border/50"
            />
          </div>
        </div>
        <div className="max-h-64 overflow-y-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="px-4 py-2 text-xs text-muted-foreground font-medium">Query</th>
                <th className="px-4 py-2 text-xs text-muted-foreground font-medium">Category</th>
                <th className="px-4 py-2 text-xs text-muted-foreground font-medium">Time</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map((log) => (
                <tr key={log.id} className="border-b border-border/50 hover:bg-secondary/30">
                  <td className="px-4 py-2 text-foreground truncate max-w-xs">{log.query}</td>
                  <td className="px-4 py-2">
                    <span className="text-xs px-1.5 py-0.5 rounded bg-accent/15 text-accent">
                      {log.category || "General"}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-muted-foreground text-xs">
                    {log.created_at ? new Date(log.created_at).toLocaleString() : "-"}
                  </td>
                </tr>
              ))}
              {filteredLogs.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">
                    No audit logs yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
        </TabsContent>

        <TabsContent value="roi">
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="glass-panel rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground">Total Deflected</span>
                <Activity className="w-4 h-4 text-emerald-400" />
              </div>
              <p className="text-2xl font-bold text-foreground">{roi.totals.deflected}</p>
              <p className="text-[11px] text-muted-foreground mt-1">queries answered without a ticket</p>
            </div>
            <div className="glass-panel rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground">Deflection Rate</span>
                <ThumbsUp className="w-4 h-4 text-primary" />
              </div>
              <p className="text-2xl font-bold text-foreground">{(roi.overallRate * 100).toFixed(1)}%</p>
              <p className="text-[11px] text-muted-foreground mt-1">{roi.totals.queries} total queries</p>
            </div>
            <div className="glass-panel rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground">Hours Saved</span>
                <Clock className="w-4 h-4 text-accent" />
              </div>
              <p className="text-2xl font-bold text-foreground">{roi.totals.hours.toFixed(1)}</p>
              <p className="text-[11px] text-muted-foreground mt-1">{MINUTES_SAVED_PER_DEFLECTION} min × deflected</p>
            </div>
            <div className="glass-panel rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground">Est. Cost Saved</span>
                <DollarSign className="w-4 h-4 text-amber-400" />
              </div>
              <p className="text-2xl font-bold text-foreground">${roi.costSaved.toFixed(0)}</p>
              <p className="text-[11px] text-muted-foreground mt-1">at ${HOURLY_RATE_USD}/hr</p>
            </div>
          </div>

          <div className="glass-panel rounded-xl overflow-hidden">
            <div className="p-4 border-b border-border">
              <h3 className="text-sm font-medium text-foreground">Per-user ROI</h3>
            </div>
            <div className="max-h-[60vh] overflow-y-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="px-4 py-2 font-medium">User</th>
                    <th className="px-4 py-2 font-medium text-right">Queries</th>
                    <th className="px-4 py-2 font-medium text-right">Tickets</th>
                    <th className="px-4 py-2 font-medium text-right">Deflected</th>
                    <th className="px-4 py-2 font-medium text-right">Deflection %</th>
                    <th className="px-4 py-2 font-medium text-right">Hours saved</th>
                  </tr>
                </thead>
                <tbody>
                  {roi.rows.slice(0, 50).map((r) => (
                    <tr key={r.uid} className="border-b border-border/50 hover:bg-secondary/30">
                      <td className="px-4 py-2 text-foreground truncate max-w-[200px]">{r.name}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{r.queries}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{r.tickets}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-emerald-400">{r.deflected}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{(r.rate * 100).toFixed(0)}%</td>
                      <td className="px-4 py-2 text-right tabular-nums">{r.hours.toFixed(1)}</td>
                    </tr>
                  ))}
                  {roi.rows.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                        No user data yet
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="audit">
          <div className="glass-panel rounded-xl overflow-hidden">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h3 className="text-sm font-medium text-foreground">Audit Explorer</h3>
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search queries..."
                  className="pl-10 h-8 text-sm bg-secondary/50 border-border/50"
                />
              </div>
            </div>
            <div className="max-h-[65vh] overflow-y-auto divide-y divide-border/50">
              {filteredLogs.map((log) => {
                const open = expandedAudit === log.id;
                const chunks = Array.isArray(log.retrieved_chunks) ? log.retrieved_chunks : [];
                return (
                  <div key={log.id} className="px-4 py-3">
                    <button
                      onClick={() => setExpandedAudit(open ? null : log.id)}
                      className="w-full flex items-start gap-3 text-left"
                    >
                      <ChevronDown
                        className={`w-4 h-4 mt-0.5 text-muted-foreground transition-transform ${open ? "rotate-180" : "-rotate-90"}`}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground truncate">{log.query}</p>
                        <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground">
                          <span className="px-1.5 py-0.5 rounded bg-accent/15 text-accent">
                            {log.category || "General"}
                          </span>
                          <span>{log.created_at && new Date(log.created_at).toLocaleString()}</span>
                          <span>{chunks.length} chunks</span>
                          {log.feedback === "up" && <ThumbsUp className="w-3 h-3 text-emerald-400" />}
                          {log.feedback === "down" && <ThumbsDown className="w-3 h-3 text-red-400" />}
                        </div>
                      </div>
                    </button>

                    {open && (
                      <div className="mt-3 ml-7 space-y-3">
                        {log.response && (
                          <div>
                            <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">Final answer</p>
                            <div className="text-xs text-foreground/90 whitespace-pre-wrap rounded-md bg-secondary/30 border border-border/60 p-2">
                              {log.response}
                            </div>
                          </div>
                        )}
                        <div>
                          <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">Retrieved chunks</p>
                          <div className="space-y-2">
                            {chunks.map((c: any, i: number) => (
                              <div key={i} className="rounded-md border border-border/60 bg-secondary/30 p-2">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-primary/20 text-primary">
                                    Source {i + 1}
                                  </span>
                                  <span className="text-[11px] text-muted-foreground truncate ml-2">
                                    {c.source}{c.score != null ? ` · ${(c.score * 100).toFixed(1)}%` : ""}
                                  </span>
                                </div>
                                <p className="text-[11px] text-muted-foreground/90 leading-relaxed">
                                  {c.section ? <span className="text-foreground/80">{c.section}: </span> : null}
                                  {c.content}
                                </p>
                              </div>
                            ))}
                            {chunks.length === 0 && (
                              <p className="text-[11px] text-muted-foreground italic">No chunks retrieved</p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              {filteredLogs.length === 0 && (
                <div className="px-4 py-8 text-center text-muted-foreground text-sm">No audit logs</div>
              )}
            </div>
          </div>
        </TabsContent>

      </Tabs>
    </div>
  );
}
