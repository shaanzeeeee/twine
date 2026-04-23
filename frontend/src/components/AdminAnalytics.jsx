import React, { useEffect, useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import api from '../services/api';

const panelClass = 'rounded-2xl sm:rounded-3xl border border-white/10 bg-[#111111]/90 p-4 sm:p-5 shadow-[0_0_40px_rgba(0,0,0,0.35)]';
const chartColors = ['#e11d48', '#f59e0b', '#22c55e', '#3b82f6', '#a855f7', '#14b8a6'];

const StatCard = ({ label, value, tone = 'text-white' }) => (
  <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
    <p className="text-[10px] uppercase tracking-widest text-zinc-500">{label}</p>
    <p className={`mt-2 text-2xl font-black ${tone}`}>{value}</p>
  </div>
);

const AdminAnalytics = ({ refreshToken = 0, syncStatus = 'idle', syncMessage = '' }) => {
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState(null);
  const [deepDive, setDeepDive] = useState(null);
  const [topicTrends, setTopicTrends] = useState(null);
  const [regression, setRegression] = useState(null);
  const [alerts, setAlerts] = useState(null);
  const [newAlert, setNewAlert] = useState({
    name: 'Fallback Spike',
    metric_key: 'quality.fallback_response_rate',
    comparator: '>=',
    threshold: 20,
  });
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [actionNotice, setActionNotice] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  const setTimedNotice = (message) => {
    setActionNotice(message);
    window.clearTimeout(window.__analytics_notice_timer);
    window.__analytics_notice_timer = window.setTimeout(() => setActionNotice(''), 2200);
  };

  const fetchAnalytics = async (options = {}) => {
    const { silent = false } = options;
    if (silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const [overview, deep, trends, regressionData, alertData] = await Promise.all([
        api.get('/admin/analytics/overview', { params: { days } }),
        api.get('/admin/analytics/deep-dive', { params: { days } }),
        api.get('/admin/analytics/topic-trends', { params: { days, top_n: 5 } }),
        api.get('/admin/analytics/regression', { params: { days: Math.min(days, 30) } }),
        api.get('/admin/analytics/alerts', { params: { days } }),
      ]);
      setData(overview.data);
      setDeepDive(deep.data);
      setTopicTrends(trends.data);
      setRegression(regressionData.data);
      setAlerts(alertData.data);
    } catch (error) {
      console.error('Failed to fetch analytics', error);
      setTimedNotice('Analytics refresh failed');
    } finally {
      if (silent) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchAnalytics({ silent: false });
  }, [days, refreshToken]);

  useEffect(() => {
    if (!autoRefresh) return undefined;
    const id = window.setInterval(() => fetchAnalytics({ silent: true }), 15000);
    return () => window.clearInterval(id);
  }, [autoRefresh, days]);

  const createAlert = async () => {
    try {
      await api.post('/admin/analytics/alerts', {
        ...newAlert,
        threshold: Number(newAlert.threshold),
      });
      setTimedNotice('Alert rule created');
      await fetchAnalytics({ silent: true });
    } catch (error) {
      console.error('Failed to create alert', error);
      setTimedNotice('Failed to create alert rule');
    }
  };

  const deleteAlert = async (ruleId) => {
    try {
      await api.delete(`/admin/analytics/alerts/${ruleId}`);
      setTimedNotice('Alert rule deleted');
      await fetchAnalytics({ silent: true });
    } catch (error) {
      console.error('Failed to delete alert', error);
      setTimedNotice('Failed to delete alert rule');
    }
  };

  const downloadReport = async (format) => {
    try {
      setIsExporting(true);
      setActionNotice('Preparing export...');
      const response = await api.get('/admin/analytics/report', {
        params: { days, format },
        responseType: 'blob',
      });

      const contentDisposition = response.headers['content-disposition'] || '';
      const fileNameMatch = contentDisposition.match(/filename=([^;]+)/i);
      const fileName = fileNameMatch ? fileNameMatch[1].replace(/"/g, '') : `analytics-${days}d.${format}`;

      const url = URL.createObjectURL(response.data);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setTimedNotice(`Exported ${fileName}`);
    } catch (error) {
      console.error('Failed to download analytics report', error);
      setTimedNotice('Export failed');
    } finally {
      setIsExporting(false);
    }
  };

  const trendData = data?.daily_trends || [];
  const kpis = data?.kpis || {};

  const statusPie = useMemo(
    () => Object.entries(data?.status_distribution || {}).map(([name, value]) => ({ name, value })),
    [data]
  );

  const depthBars = useMemo(
    () => Object.entries(data?.depth_distribution || {}).map(([bucket, value]) => ({ bucket, value })),
    [data]
  );

  const topicSeries = useMemo(() => {
    if (!topicTrends?.series?.length) return [];
    return topicTrends.series;
  }, [topicTrends]);

  if (loading) {
    return (
      <div className="p-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {Array.from({ length: 12 }).map((_, idx) => (
          <div key={idx} className="h-28 rounded-xl border border-white/10 bg-zinc-900/60 animate-pulse" />
        ))}
      </div>
    );
  }

  if (!data) {
    return <div className="p-6 text-zinc-500">Analytics unavailable.</div>;
  }

  return (
    <div className="relative z-10 p-4 sm:p-6 space-y-6 overflow-y-auto bg-[radial-gradient(circle_at_top_right,rgba(225,29,72,0.18),transparent_42%),radial-gradient(circle_at_top_left,rgba(59,130,246,0.12),transparent_38%)]">
      {syncStatus !== 'idle' && (
        <div className={`rounded-2xl border px-4 py-3 text-[10px] uppercase tracking-widest font-black ${syncStatus === 'success' ? 'bg-emerald-900/30 text-emerald-200 border-emerald-700/40' : syncStatus === 'error' ? 'bg-red-900/30 text-red-200 border-red-700/40' : 'bg-zinc-900/80 text-zinc-100 border-white/10'}`}>
          {syncMessage}
        </div>
      )}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h3 className="text-sm uppercase tracking-[0.18em] font-black text-white">Analytics Command Center</h3>
          <p className="text-xs text-zinc-400 mt-1">Live operational intelligence for transcripts, quality, and risk.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="px-3 py-2 text-xs bg-[#111111] border border-white/10 rounded-2xl text-white"
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
          <button
            onClick={() => {
              setAutoRefresh((v) => !v);
              setTimedNotice(autoRefresh ? 'Live refresh disabled' : 'Live refresh enabled');
            }}
            className={`px-3 py-2 text-xs uppercase tracking-widest font-black border rounded-2xl ${autoRefresh ? 'bg-emerald-800/40 text-emerald-200 border-emerald-700/50' : 'bg-[#111111] text-zinc-200 border-white/10'}`}
          >
            Live {autoRefresh ? 'On' : 'Off'}
          </button>
          <button
            onClick={() => fetchAnalytics({ silent: true })}
            disabled={refreshing}
            className="px-3 py-2 text-xs uppercase tracking-widest font-black border rounded-2xl bg-[#111111] text-zinc-200 border-white/10 hover:border-red-600 disabled:opacity-50"
          >
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
          <button
            onClick={() => downloadReport('json')}
            disabled={isExporting}
            className="px-3 py-2 text-xs uppercase tracking-widest font-black border rounded-2xl bg-[#111111] text-zinc-200 border-white/10 hover:border-red-600 disabled:opacity-50"
          >
            Export JSON
          </button>
          <button
            onClick={() => downloadReport('csv')}
            disabled={isExporting}
            className="px-3 py-2 text-xs uppercase tracking-widest font-black border rounded-2xl bg-[#111111] text-zinc-200 border-white/10 hover:border-red-600 disabled:opacity-50"
          >
            Export CSV
          </button>
        </div>
      </div>

      {actionNotice && (
        <div className="text-[10px] uppercase tracking-widest font-black text-emerald-300">{actionNotice}</div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard label="Total Sessions" value={kpis.total_sessions || 0} />
        <StatCard label="Active Sessions" value={kpis.active_sessions || 0} tone="text-emerald-300" />
        <StatCard label="Archived Sessions" value={kpis.archived_sessions || 0} tone="text-amber-300" />
        <StatCard label="Total Messages" value={kpis.total_messages || 0} />
        <StatCard label="User Messages" value={kpis.user_messages || 0} tone="text-blue-300" />
        <StatCard label="Assistant Messages" value={kpis.assistant_messages || 0} tone="text-pink-300" />
        <StatCard label="Avg Messages / Session" value={kpis.avg_messages_per_session || 0} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className={panelClass}>
          <h4 className="text-[10px] uppercase tracking-widest font-black text-zinc-300 mb-3">Session And Message Velocity</h4>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis dataKey="date" tick={{ fill: '#a1a1aa', fontSize: 10 }} />
                <YAxis tick={{ fill: '#a1a1aa', fontSize: 10 }} />
                <Tooltip wrapperStyle={{ pointerEvents: 'none' }} contentStyle={{ background: '#09090b', border: '1px solid #3f3f46', fontSize: 11 }} />
                <Legend />
                <Line isAnimationActive={false} type="monotone" dataKey="sessions" stroke="#e11d48" strokeWidth={2} dot={false} />
                <Line isAnimationActive={false} type="monotone" dataKey="messages" stroke="#38bdf8" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className={panelClass}>
          <h4 className="text-[10px] uppercase tracking-widest font-black text-zinc-300 mb-3">Status Mix</h4>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie isAnimationActive={false} data={statusPie} dataKey="value" nameKey="name" outerRadius={96} innerRadius={56}>
                  {statusPie.map((entry, idx) => (
                    <Cell key={`${entry.name}-${idx}`} fill={chartColors[idx % chartColors.length]} />
                  ))}
                </Pie>
                <Tooltip wrapperStyle={{ pointerEvents: 'none' }} contentStyle={{ background: '#09090b', border: '1px solid #3f3f46', fontSize: 11 }} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className={panelClass}>
          <h4 className="text-[10px] uppercase tracking-widest font-black text-zinc-300 mb-3">Topic Trend Lines</h4>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={topicSeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis dataKey="date" tick={{ fill: '#a1a1aa', fontSize: 10 }} />
                <YAxis tick={{ fill: '#a1a1aa', fontSize: 10 }} />
                <Tooltip wrapperStyle={{ pointerEvents: 'none' }} contentStyle={{ background: '#09090b', border: '1px solid #3f3f46', fontSize: 11 }} />
                <Legend />
                {(topicTrends?.topics || []).map((topic, idx) => (
                  <Area
                    key={topic}
                    isAnimationActive={false}
                    type="monotone"
                    dataKey={topic}
                    stroke={chartColors[idx % chartColors.length]}
                    fill={chartColors[idx % chartColors.length]}
                    fillOpacity={0.12}
                    strokeWidth={2}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className={panelClass}>
          <h4 className="text-[10px] uppercase tracking-widest font-black text-zinc-300 mb-3">Depth Distribution</h4>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={depthBars}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis dataKey="bucket" tick={{ fill: '#a1a1aa', fontSize: 10 }} />
                <YAxis tick={{ fill: '#a1a1aa', fontSize: 10 }} />
                <Tooltip wrapperStyle={{ pointerEvents: 'none' }} contentStyle={{ background: '#09090b', border: '1px solid #3f3f46', fontSize: 11 }} />
                <Bar isAnimationActive={false} dataKey="value" fill="#f43f5e" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className={panelClass}>
          <h4 className="text-[10px] uppercase tracking-widest font-black text-zinc-300 mb-3">RAG Quality</h4>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between"><span className="text-zinc-400">Retrieval hit rate</span><span className="text-white font-bold">{deepDive?.rag_quality?.retrieval_hit_rate || 0}%</span></div>
            <div className="flex justify-between"><span className="text-zinc-400">Low context rate</span><span className="text-white font-bold">{deepDive?.rag_quality?.low_context_rate || 0}%</span></div>
            <div className="flex justify-between"><span className="text-zinc-400">Grounded responses</span><span className="text-white font-bold">{deepDive?.rag_quality?.estimated_grounded_responses || 0}</span></div>
          </div>
        </div>

        <div className={panelClass}>
          <h4 className="text-[10px] uppercase tracking-widest font-black text-zinc-300 mb-3">Queue Aging</h4>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between"><span className="text-zinc-400">Pending sessions</span><span className="text-white font-bold">{deepDive?.queue_aging?.pending_count || 0}</span></div>
            <div className="flex justify-between"><span className="text-zinc-400">Oldest pending</span><span className="text-white font-bold">{deepDive?.queue_aging?.oldest_pending_days || 0}d</span></div>
            <div className="flex justify-between"><span className="text-zinc-400">Avg pending age</span><span className="text-white font-bold">{deepDive?.queue_aging?.avg_pending_days || 0}d</span></div>
          </div>
        </div>

        <div className={panelClass}>
          <h4 className="text-[10px] uppercase tracking-widest font-black text-zinc-300 mb-3">Operations Throughput</h4>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between"><span className="text-zinc-400">Approved sessions</span><span className="text-white font-bold">{deepDive?.operations?.approved_sessions || 0}</span></div>
            <div className="flex justify-between"><span className="text-zinc-400">Discarded sessions</span><span className="text-white font-bold">{deepDive?.operations?.discarded_sessions || 0}</span></div>
            <div className="flex justify-between"><span className="text-zinc-400">Approval rate</span><span className="text-emerald-300 font-bold">{deepDive?.operations?.approval_rate || 0}%</span></div>
            <div className="flex justify-between"><span className="text-zinc-400">Discard rate</span><span className="text-amber-300 font-bold">{deepDive?.operations?.discard_rate || 0}%</span></div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className={panelClass}>
          <h4 className="text-[10px] uppercase tracking-widest font-black text-zinc-300 mb-3">Regression Monitor</h4>
          <div className="space-y-2">
            {Object.entries(regression?.deltas || {}).map(([key, value]) => (
              <div key={key} className="rounded-lg border border-white/10 bg-black/40 p-2">
                <div className="text-[10px] uppercase tracking-widest text-zinc-400">{key.replaceAll('_', ' ')}</div>
                <div className="text-xs text-zinc-300 mt-1">
                  Current {value.current} | Previous {value.previous} | Delta {value.absolute} ({value.percent}%)
                </div>
              </div>
            ))}
            {(regression?.regressions || []).length === 0 && <p className="text-xs text-emerald-300">No regressions detected.</p>}
            {(regression?.regressions || []).map((item) => (
              <div key={item} className="rounded-lg border border-red-700/40 bg-red-900/20 px-3 py-2 text-xs text-red-200">{item}</div>
            ))}
          </div>
        </div>

        <div className={panelClass}>
          <h4 className="text-[10px] uppercase tracking-widest font-black text-zinc-300 mb-3">Anomaly Detector</h4>
          <div className="space-y-2 max-h-72 overflow-y-auto pr-2">
            {(deepDive?.anomalies || []).length === 0 && <p className="text-xs text-zinc-500">No anomalies detected in current window.</p>}
            {(deepDive?.anomalies || []).map((anomaly, idx) => (
              <div key={`${anomaly.date}-${anomaly.type}-${idx}`} className="rounded-lg border border-amber-700/40 bg-amber-900/20 px-3 py-2">
                <div className="text-[10px] uppercase tracking-widest font-black text-amber-200">{anomaly.type.replace('_', ' ')}</div>
                <div className="text-xs text-zinc-300 mt-1">{anomaly.date} | value {anomaly.value} vs baseline {anomaly.baseline}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className={panelClass}>
        <h4 className="text-[10px] uppercase tracking-widest font-black text-zinc-300 mb-3">Alert Rules</h4>
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-2 mb-4">
          <input
            value={newAlert.name}
            onChange={(e) => setNewAlert((prev) => ({ ...prev, name: e.target.value }))}
            className="px-2 py-2 text-xs bg-zinc-900 border border-white/10 rounded-lg"
            placeholder="Rule name"
          />
          <select
            value={newAlert.metric_key}
            onChange={(e) => setNewAlert((prev) => ({ ...prev, metric_key: e.target.value }))}
            className="px-2 py-2 text-xs bg-zinc-900 border border-white/10 rounded-lg"
          >
            <option value="quality.fallback_response_rate">Fallback rate</option>
            <option value="quality.short_response_rate">Short response rate</option>
            <option value="rag.low_context_rate">Low context rate</option>
            <option value="queue.pending_count">Pending count</option>
            <option value="queue.oldest_pending_days">Oldest pending days</option>
          </select>
          <select
            value={newAlert.comparator}
            onChange={(e) => setNewAlert((prev) => ({ ...prev, comparator: e.target.value }))}
            className="px-2 py-2 text-xs bg-zinc-900 border border-white/10 rounded-lg"
          >
            <option value=">=">&gt;=</option>
            <option value=">">&gt;</option>
            <option value="<=">&lt;=</option>
            <option value="<">&lt;</option>
            <option value="==">==</option>
          </select>
          <input
            type="number"
            value={newAlert.threshold}
            onChange={(e) => setNewAlert((prev) => ({ ...prev, threshold: Number(e.target.value) }))}
            className="px-2 py-2 text-xs bg-zinc-900 border border-white/10 rounded-lg"
            placeholder="Threshold"
          />
          <button
            onClick={createAlert}
            className="px-3 py-2 text-xs uppercase tracking-widest font-black border rounded-lg bg-zinc-900 text-zinc-200 border-white/10 hover:border-red-600"
          >
            Add Alert
          </button>
        </div>

        <div className="space-y-2">
          {(alerts?.rules || []).length === 0 && <p className="text-xs text-zinc-500">No alert rules configured.</p>}
          {(alerts?.rules || []).map((rule) => (
            <div key={rule.id} className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 flex items-center justify-between gap-3">
              <div>
                <div className="text-[10px] uppercase tracking-widest font-black text-zinc-300">{rule.name}</div>
                <div className="text-xs text-zinc-400 mt-1">
                  {rule.metric_key} {rule.comparator} {rule.threshold} | current: {rule.current_value}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-1 text-[10px] uppercase tracking-widest font-black border rounded ${rule.triggered ? 'text-red-200 border-red-700/40 bg-red-900/30' : 'text-emerald-200 border-emerald-700/40 bg-emerald-900/30'}`}>
                  {rule.triggered ? 'Triggered' : 'Normal'}
                </span>
                <button
                  onClick={() => deleteAlert(rule.id)}
                  className="px-2 py-1 text-[10px] uppercase tracking-widest font-black border rounded border-white/10 text-zinc-300 hover:border-red-600"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AdminAnalytics;
