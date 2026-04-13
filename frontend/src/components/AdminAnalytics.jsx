import React, { useEffect, useMemo, useState } from 'react';
import api from '../services/api';

const cardClass = 'bg-zinc-900/80 border border-white/10 p-4';

const AdminAnalytics = () => {
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
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

  const fetchAnalytics = async () => {
    setLoading(true);
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
    } finally {
      setLoading(false);
    }
  };

  const createAlert = async () => {
    try {
      await api.post('/admin/analytics/alerts', {
        ...newAlert,
        threshold: Number(newAlert.threshold),
      });
      await fetchAnalytics();
    } catch (error) {
      console.error('Failed to create alert', error);
    }
  };

  const deleteAlert = async (ruleId) => {
    try {
      await api.delete(`/admin/analytics/alerts/${ruleId}`);
      await fetchAnalytics();
    } catch (error) {
      console.error('Failed to delete alert', error);
    }
  };

  const downloadReport = async (format) => {
    try {
      const response = await api.get('/admin/analytics/report', {
        params: { days, format },
      });

      if (format === 'json') {
        const blob = new Blob([JSON.stringify(response.data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `analytics-${days}d.json`;
        anchor.click();
        URL.revokeObjectURL(url);
        return;
      }

      const blob = new Blob([response.data.csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = response.data.filename || `analytics-${days}d.csv`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download analytics report', error);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [days]);

  useEffect(() => {
    if (!autoRefresh) return undefined;
    const id = window.setInterval(fetchAnalytics, 15000);
    return () => window.clearInterval(id);
  }, [autoRefresh, days]);

  const maxTrend = useMemo(() => {
    if (!data?.daily_trends?.length) return 1;
    return Math.max(...data.daily_trends.map((item) => item.sessions), 1);
  }, [data]);

  if (loading) {
    return (
      <div className="p-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, idx) => (
          <div key={idx} className="h-24 bg-zinc-900/60 border border-white/10 animate-pulse" />
        ))}
      </div>
    );
  }

  if (!data) {
    return <div className="p-6 text-zinc-500">Analytics unavailable.</div>;
  }

  const kpis = data.kpis || {};

  return (
    <div className="p-6 space-y-6 overflow-y-auto">
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <h3 className="text-xs uppercase tracking-widest font-black text-white">Analytics Command Center</h3>
        <div className="flex gap-2">
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="px-3 py-2 text-xs bg-zinc-900 border border-white/10"
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
          <button
            onClick={() => setAutoRefresh((v) => !v)}
            className={`px-3 py-2 text-xs uppercase tracking-widest font-black border ${autoRefresh ? 'bg-emerald-800/40 text-emerald-200 border-emerald-700/50' : 'bg-zinc-900 text-zinc-200 border-white/10'}`}
          >
            Live {autoRefresh ? 'On' : 'Off'}
          </button>
          <button
            onClick={() => downloadReport('json')}
            className="px-3 py-2 text-xs uppercase tracking-widest font-black border bg-zinc-900 text-zinc-200 border-white/10 hover:border-red-600"
          >
            Export JSON
          </button>
          <button
            onClick={() => downloadReport('csv')}
            className="px-3 py-2 text-xs uppercase tracking-widest font-black border bg-zinc-900 text-zinc-200 border-white/10 hover:border-red-600"
          >
            Export CSV
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className={cardClass}><p className="text-[10px] uppercase text-zinc-500">Total Sessions</p><p className="text-2xl font-black text-white">{kpis.total_sessions || 0}</p></div>
        <div className={cardClass}><p className="text-[10px] uppercase text-zinc-500">Active Sessions</p><p className="text-2xl font-black text-white">{kpis.active_sessions || 0}</p></div>
        <div className={cardClass}><p className="text-[10px] uppercase text-zinc-500">Archived Sessions</p><p className="text-2xl font-black text-white">{kpis.archived_sessions || 0}</p></div>
        <div className={cardClass}><p className="text-[10px] uppercase text-zinc-500">Total Messages</p><p className="text-2xl font-black text-white">{kpis.total_messages || 0}</p></div>
        <div className={cardClass}><p className="text-[10px] uppercase text-zinc-500">User Messages</p><p className="text-2xl font-black text-white">{kpis.user_messages || 0}</p></div>
        <div className={cardClass}><p className="text-[10px] uppercase text-zinc-500">Assistant Messages</p><p className="text-2xl font-black text-white">{kpis.assistant_messages || 0}</p></div>
        <div className={cardClass}><p className="text-[10px] uppercase text-zinc-500">Avg Messages / Session</p><p className="text-2xl font-black text-white">{kpis.avg_messages_per_session || 0}</p></div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className={cardClass}>
          <h4 className="text-[10px] uppercase tracking-widest font-black text-zinc-300 mb-3">Session Trend</h4>
          <div className="space-y-2 max-h-72 overflow-y-auto pr-2">
            {data.daily_trends.map((row) => (
              <div key={row.date}>
                <div className="flex justify-between text-[10px] text-zinc-400 mb-1">
                  <span>{row.date}</span>
                  <span>{row.sessions} sessions</span>
                </div>
                <div className="h-2 bg-zinc-800 border border-white/5">
                  <div
                    className="h-full bg-red-600"
                    style={{ width: `${Math.max((row.sessions / maxTrend) * 100, 2)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className={cardClass}>
          <h4 className="text-[10px] uppercase tracking-widest font-black text-zinc-300 mb-3">Status Distribution</h4>
          <div className="space-y-2">
            {Object.entries(data.status_distribution || {}).map(([key, value]) => (
              <div key={key} className="flex items-center justify-between border border-white/5 bg-zinc-950/60 px-3 py-2">
                <span className="text-[10px] uppercase tracking-widest font-black text-zinc-400">{key.replace('_', ' ')}</span>
                <span className="text-sm font-bold text-white">{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className={cardClass}>
          <h4 className="text-[10px] uppercase tracking-widest font-black text-zinc-300 mb-3">Topic Trends (Top 5)</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-[10px]">
              <thead>
                <tr className="text-zinc-500 uppercase tracking-widest">
                  <th className="text-left py-2">Date</th>
                  {(topicTrends?.topics || []).map((topic) => (
                    <th key={topic} className="text-right py-2">{topic}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(topicTrends?.series || []).slice(-10).map((row) => (
                  <tr key={row.date} className="border-t border-white/5 text-zinc-300">
                    <td className="py-2">{row.date}</td>
                    {(topicTrends?.topics || []).map((topic) => (
                      <td key={`${row.date}-${topic}`} className="text-right py-2">{row[topic] || 0}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className={cardClass}>
          <h4 className="text-[10px] uppercase tracking-widest font-black text-zinc-300 mb-3">Regression Monitor</h4>
          <div className="space-y-2">
            {Object.entries(regression?.deltas || {}).map(([key, value]) => (
              <div key={key} className="border border-white/5 bg-zinc-950/60 px-3 py-2">
                <div className="text-[10px] uppercase tracking-widest font-black text-zinc-400">{key.replaceAll('_', ' ')}</div>
                <div className="text-xs text-zinc-300 mt-1">
                  Current: {value.current} | Previous: {value.previous} | Delta: {value.absolute} ({value.percent}%)
                </div>
              </div>
            ))}
            {(regression?.regressions || []).length === 0 && <p className="text-xs text-emerald-300">No regressions detected.</p>}
            {(regression?.regressions || []).map((item) => (
              <div key={item} className="border border-red-700/40 bg-red-900/20 px-3 py-2 text-xs text-red-200">{item}</div>
            ))}
          </div>
        </div>
      </div>

      <div className={cardClass}>
        <h4 className="text-[10px] uppercase tracking-widest font-black text-zinc-300 mb-3">Alert Rules</h4>
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-2 mb-4">
          <input
            value={newAlert.name}
            onChange={(e) => setNewAlert((prev) => ({ ...prev, name: e.target.value }))}
            className="px-2 py-2 text-xs bg-zinc-900 border border-white/10"
            placeholder="Rule name"
          />
          <select
            value={newAlert.metric_key}
            onChange={(e) => setNewAlert((prev) => ({ ...prev, metric_key: e.target.value }))}
            className="px-2 py-2 text-xs bg-zinc-900 border border-white/10"
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
            className="px-2 py-2 text-xs bg-zinc-900 border border-white/10"
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
            className="px-2 py-2 text-xs bg-zinc-900 border border-white/10"
            placeholder="Threshold"
          />
          <button
            onClick={createAlert}
            className="px-3 py-2 text-xs uppercase tracking-widest font-black border bg-zinc-900 text-zinc-200 border-white/10 hover:border-red-600"
          >
            Add Alert
          </button>
        </div>

        <div className="space-y-2">
          {(alerts?.rules || []).length === 0 && <p className="text-xs text-zinc-500">No alert rules configured.</p>}
          {(alerts?.rules || []).map((rule) => (
            <div key={rule.id} className="border border-white/5 bg-zinc-950/60 px-3 py-2 flex items-center justify-between gap-3">
              <div>
                <div className="text-[10px] uppercase tracking-widest font-black text-zinc-300">{rule.name}</div>
                <div className="text-xs text-zinc-400 mt-1">
                  {rule.metric_key} {rule.comparator} {rule.threshold} | current: {rule.current_value}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-1 text-[10px] uppercase tracking-widest font-black border ${rule.triggered ? 'text-red-200 border-red-700/40 bg-red-900/30' : 'text-emerald-200 border-emerald-700/40 bg-emerald-900/30'}`}>
                  {rule.triggered ? 'Triggered' : 'Normal'}
                </span>
                <button
                  onClick={() => deleteAlert(rule.id)}
                  className="px-2 py-1 text-[10px] uppercase tracking-widest font-black border border-white/10 text-zinc-300 hover:border-red-600"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className={cardClass}>
          <h4 className="text-[10px] uppercase tracking-widest font-black text-zinc-300 mb-3">RAG Quality Signals</h4>
          <div className="space-y-2">
            <div className="flex items-center justify-between border border-white/5 bg-zinc-950/60 px-3 py-2">
              <span className="text-[10px] uppercase tracking-widest font-black text-zinc-400">Retrieval hit rate</span>
              <span className="text-sm font-bold text-white">{deepDive?.rag_quality?.retrieval_hit_rate || 0}%</span>
            </div>
            <div className="flex items-center justify-between border border-white/5 bg-zinc-950/60 px-3 py-2">
              <span className="text-[10px] uppercase tracking-widest font-black text-zinc-400">Low context rate</span>
              <span className="text-sm font-bold text-white">{deepDive?.rag_quality?.low_context_rate || 0}%</span>
            </div>
            <div className="flex items-center justify-between border border-white/5 bg-zinc-950/60 px-3 py-2">
              <span className="text-[10px] uppercase tracking-widest font-black text-zinc-400">Estimated grounded responses</span>
              <span className="text-sm font-bold text-white">{deepDive?.rag_quality?.estimated_grounded_responses || 0}</span>
            </div>
          </div>
        </div>

        <div className={cardClass}>
          <h4 className="text-[10px] uppercase tracking-widest font-black text-zinc-300 mb-3">Anomaly Detector</h4>
          <div className="space-y-2 max-h-72 overflow-y-auto pr-2">
            {(deepDive?.anomalies || []).length === 0 && <p className="text-xs text-zinc-500">No anomalies detected in current window.</p>}
            {(deepDive?.anomalies || []).map((anomaly, idx) => (
              <div key={`${anomaly.date}-${anomaly.type}-${idx}`} className="border border-amber-700/40 bg-amber-900/20 px-3 py-2">
                <div className="text-[10px] uppercase tracking-widest font-black text-amber-200">{anomaly.type.replace('_', ' ')}</div>
                <div className="text-xs text-zinc-300 mt-1">{anomaly.date} • value {anomaly.value} vs baseline {anomaly.baseline}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className={cardClass}>
          <h4 className="text-[10px] uppercase tracking-widest font-black text-zinc-300 mb-3">Depth Distribution</h4>
          <div className="space-y-2">
            {Object.entries(data.depth_distribution || {}).map(([bucket, value]) => (
              <div key={bucket} className="flex items-center justify-between border border-white/5 bg-zinc-950/60 px-3 py-2">
                <span className="text-[10px] uppercase tracking-widest font-black text-zinc-400">{bucket} messages</span>
                <span className="text-sm font-bold text-white">{value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className={cardClass}>
          <h4 className="text-[10px] uppercase tracking-widest font-black text-zinc-300 mb-3">Top Guests</h4>
          <div className="space-y-2">
            {(data.top_guests || []).length === 0 && <p className="text-xs text-zinc-500">No guest activity in this window.</p>}
            {(data.top_guests || []).map((guest) => (
              <div key={guest.guest_name} className="flex items-center justify-between border border-white/5 bg-zinc-950/60 px-3 py-2">
                <span className="text-[10px] uppercase tracking-widest font-black text-zinc-400">{guest.guest_name}</span>
                <span className="text-sm font-bold text-white">{guest.sessions} sessions</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className={cardClass}>
          <h4 className="text-[10px] uppercase tracking-widest font-black text-zinc-300 mb-3">Topic Clusters</h4>
          <div className="space-y-2 max-h-72 overflow-y-auto pr-2">
            {(deepDive?.top_topics || []).map((topic) => (
              <div key={topic.topic} className="flex items-center justify-between border border-white/5 bg-zinc-950/60 px-3 py-2">
                <span className="text-[10px] uppercase tracking-widest font-black text-zinc-400">{topic.topic}</span>
                <span className="text-sm font-bold text-white">{topic.count}</span>
              </div>
            ))}
            {(deepDive?.top_topics || []).length === 0 && <p className="text-xs text-zinc-500">No topic signals yet.</p>}
          </div>
        </div>

        <div className={cardClass}>
          <h4 className="text-[10px] uppercase tracking-widest font-black text-zinc-300 mb-3">Quality Heuristics</h4>
          <div className="space-y-2">
            <div className="flex items-center justify-between border border-white/5 bg-zinc-950/60 px-3 py-2">
              <span className="text-[10px] uppercase tracking-widest font-black text-zinc-400">Assistant messages</span>
              <span className="text-sm font-bold text-white">{deepDive?.quality?.assistant_messages || 0}</span>
            </div>
            <div className="flex items-center justify-between border border-white/5 bg-zinc-950/60 px-3 py-2">
              <span className="text-[10px] uppercase tracking-widest font-black text-zinc-400">Short response rate</span>
              <span className="text-sm font-bold text-white">{deepDive?.quality?.short_response_rate || 0}%</span>
            </div>
            <div className="flex items-center justify-between border border-white/5 bg-zinc-950/60 px-3 py-2">
              <span className="text-[10px] uppercase tracking-widest font-black text-zinc-400">Fallback response rate</span>
              <span className="text-sm font-bold text-white">{deepDive?.quality?.fallback_response_rate || 0}%</span>
            </div>
          </div>
        </div>

        <div className={cardClass}>
          <h4 className="text-[10px] uppercase tracking-widest font-black text-zinc-300 mb-3">Queue Aging</h4>
          <div className="space-y-2">
            <div className="flex items-center justify-between border border-white/5 bg-zinc-950/60 px-3 py-2">
              <span className="text-[10px] uppercase tracking-widest font-black text-zinc-400">Pending sessions</span>
              <span className="text-sm font-bold text-white">{deepDive?.queue_aging?.pending_count || 0}</span>
            </div>
            <div className="flex items-center justify-between border border-white/5 bg-zinc-950/60 px-3 py-2">
              <span className="text-[10px] uppercase tracking-widest font-black text-zinc-400">Oldest pending</span>
              <span className="text-sm font-bold text-white">{deepDive?.queue_aging?.oldest_pending_days || 0}d</span>
            </div>
            <div className="flex items-center justify-between border border-white/5 bg-zinc-950/60 px-3 py-2">
              <span className="text-[10px] uppercase tracking-widest font-black text-zinc-400">Avg pending age</span>
              <span className="text-sm font-bold text-white">{deepDive?.queue_aging?.avg_pending_days || 0}d</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className={cardClass}>
          <h4 className="text-[10px] uppercase tracking-widest font-black text-zinc-300 mb-3">Operations Throughput</h4>
          <div className="space-y-2">
            <div className="flex items-center justify-between border border-white/5 bg-zinc-950/60 px-3 py-2">
              <span className="text-[10px] uppercase tracking-widest font-black text-zinc-400">Approved sessions</span>
              <span className="text-sm font-bold text-white">{deepDive?.operations?.approved_sessions || 0}</span>
            </div>
            <div className="flex items-center justify-between border border-white/5 bg-zinc-950/60 px-3 py-2">
              <span className="text-[10px] uppercase tracking-widest font-black text-zinc-400">Discarded sessions</span>
              <span className="text-sm font-bold text-white">{deepDive?.operations?.discarded_sessions || 0}</span>
            </div>
            <div className="flex items-center justify-between border border-white/5 bg-zinc-950/60 px-3 py-2">
              <span className="text-[10px] uppercase tracking-widest font-black text-zinc-400">Approval rate</span>
              <span className="text-sm font-bold text-white">{deepDive?.operations?.approval_rate || 0}%</span>
            </div>
            <div className="flex items-center justify-between border border-white/5 bg-zinc-950/60 px-3 py-2">
              <span className="text-[10px] uppercase tracking-widest font-black text-zinc-400">Discard rate</span>
              <span className="text-sm font-bold text-white">{deepDive?.operations?.discard_rate || 0}%</span>
            </div>
          </div>
        </div>

        <div className={cardClass}>
          <h4 className="text-[10px] uppercase tracking-widest font-black text-zinc-300 mb-3">Topic Outcome Matrix</h4>
          <div className="space-y-2 max-h-72 overflow-y-auto pr-2">
            {(deepDive?.topic_outcomes || []).map((row) => (
              <div key={row.topic} className="border border-white/5 bg-zinc-950/60 px-3 py-2">
                <div className="text-[10px] uppercase tracking-widest font-black text-zinc-300 mb-2">{row.topic}</div>
                <div className="grid grid-cols-3 gap-2 text-[10px]">
                  <div className="text-zinc-500">Approved: <span className="text-white font-bold">{row.approved}</span></div>
                  <div className="text-zinc-500">Pending: <span className="text-white font-bold">{row.pending_review}</span></div>
                  <div className="text-zinc-500">Discarded: <span className="text-white font-bold">{row.discarded}</span></div>
                </div>
              </div>
            ))}
            {(deepDive?.topic_outcomes || []).length === 0 && <p className="text-xs text-zinc-500">No topic outcomes yet.</p>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminAnalytics;
