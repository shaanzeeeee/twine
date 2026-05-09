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
import { 
  Activity, 
  BarChart3, 
  Clock, 
  AlertCircle, 
  Download, 
  TrendingUp, 
  Layers, 
  Zap,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';

const panelClass = 'rounded-[2rem] border border-white/5 bg-[#0F172A]/40 backdrop-blur-3xl p-6 sm:p-8 shadow-[0_8px_32px_0_rgba(0,0,0,0.3)] transition-all duration-500 hover:border-sky-500/20 group';
const chartColors = ['#38bdf8', '#818cf8', '#22d3ee', '#6366f1', '#2dd4bf', '#fb7185'];

const StatCard = ({ label, value, icon: Icon, trend = null, trendType = 'positive' }) => (
  <div className="rounded-[1.5rem] border border-white/5 bg-slate-900/40 backdrop-blur-xl p-6 transition-all duration-300 hover:scale-[1.02] hover:border-sky-500/30 group">
    <div className="flex justify-between items-start mb-4">
      <div className="p-3 rounded-2xl bg-sky-500/5 border border-sky-500/10 group-hover:bg-sky-500/10 transition-colors">
        <Icon className="w-5 h-5 text-sky-400" />
      </div>
      {trend && (
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
          trendType === 'positive' ? 'text-emerald-400 border-emerald-500/20 bg-emerald-500/5' : 'text-rose-400 border-rose-500/20 bg-rose-500/5'
        }`}>
          {trend}
        </span>
      )}
    </div>
    <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-slate-500 mb-1">{label}</p>
    <p className="text-3xl font-black text-white tracking-tighter">{value}</p>
  </div>
);

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#0F172A]/90 backdrop-blur-md border border-white/10 p-3 rounded-xl shadow-2xl">
        <p className="text-[10px] uppercase tracking-widest font-bold text-slate-500 mb-2">{label}</p>
        {payload.map((entry, index) => (
          <div key={index} className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
            <span className="text-xs font-bold text-white">{entry.name}:</span>
            <span className="text-xs text-sky-400">{entry.value}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

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

      const url = URL.createObjectURL(response.data);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `twine-intelligence-${days}d.${format}`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setTimedNotice(`Export complete`);
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
      <div className="p-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {Array.from({ length: 12 }).map((_, idx) => (
          <div key={idx} className="h-32 rounded-[1.5rem] border border-white/5 bg-slate-900/40 animate-pulse" />
        ))}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-slate-500">
        <Activity className="w-12 h-12 mb-4 opacity-10" />
        <p className="text-[10px] uppercase font-bold tracking-[0.2em]">Intelligence Engine Offline</p>
      </div>
    );
  }

  return (
    <div className="relative z-10 p-6 sm:p-10 space-y-10 overflow-y-auto">
      {/* Header Section */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between border-b border-white/5 pb-10">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2 h-2 rounded-full bg-sky-500 animate-pulse shadow-[0_0_8px_rgba(14,165,233,0.8)]" />
            <h3 className="text-[11px] uppercase tracking-[0.3em] font-black text-sky-400">Intelligence Command</h3>
          </div>
          <h2 className="text-4xl font-black text-white tracking-tighter mb-2 italic">Dashboard Overview</h2>
          <p className="text-sm text-slate-400 max-w-md font-medium leading-relaxed">Live operational telemetry for persona accuracy, retrieval quality, and user engagement.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3 bg-slate-900/50 backdrop-blur-xl p-2 rounded-[1.25rem] border border-white/5 shadow-2xl">
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="px-4 py-2 text-[10px] font-black uppercase tracking-widest bg-transparent text-slate-300 outline-none cursor-pointer hover:text-white transition-colors"
          >
            <option value={7}>7 Days</option>
            <option value={30}>30 Days</option>
            <option value={90}>90 Days</option>
          </select>
          <div className="w-px h-4 bg-white/10" />
          <button
            onClick={() => setAutoRefresh((v) => !v)}
            className={`flex items-center gap-2 px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${autoRefresh ? 'text-emerald-400 bg-emerald-500/5' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
          >
            <Zap className={`w-3 h-3 ${autoRefresh ? 'fill-current' : ''}`} />
            Live {autoRefresh ? 'Syncing' : 'Stream'}
          </button>
          <button
            onClick={() => fetchAnalytics({ silent: true })}
            className="flex items-center gap-2 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white hover:bg-white/5 rounded-xl transition-all"
          >
            <TrendingUp className="w-3 h-3" />
            Refresh
          </button>
          <div className="w-px h-4 bg-white/10" />
          <button
            onClick={() => downloadReport('json')}
            className="flex items-center gap-2 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-sky-400 hover:bg-sky-400/10 rounded-xl transition-all"
          >
            <Download className="w-3 h-3" />
            Export
          </button>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard label="Total Sessions" value={kpis.total_sessions || 0} icon={Layers} trend="+12.5%" />
        <StatCard label="Active Sessions" value={kpis.active_sessions || 0} icon={Activity} trend="Live" trendType="positive" />
        <StatCard label="Total Messages" value={kpis.total_messages || 0} icon={Zap} trend="+8.2%" />
        <StatCard label="Avg. Depth" value={kpis.avg_messages_per_session || 0} icon={BarChart3} trend="Stable" />
      </div>

      {/* Primary Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-[1.5fr_1fr] gap-6">
        <div className={panelClass}>
          <div className="flex justify-between items-center mb-10">
            <div>
              <h4 className="text-[11px] uppercase tracking-[0.2em] font-black text-slate-400 mb-1">Telemetry Velocity</h4>
              <p className="text-xs text-slate-500">Interaction volume across time</p>
            </div>
            <div className="flex gap-4">
               <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.5)]" /><span className="text-[10px] uppercase font-bold text-slate-400">Sessions</span></div>
               <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-indigo-400 shadow-[0_0_8px_rgba(129,140,248,0.5)]" /><span className="text-[10px] uppercase font-bold text-slate-400">Events</span></div>
            </div>
          </div>
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="colorSessions" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#38bdf8" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorMessages" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#818cf8" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#818cf8" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" hide />
                <YAxis hide />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="sessions" stroke="#38bdf8" strokeWidth={3} fillOpacity={1} fill="url(#colorSessions)" />
                <Area type="monotone" dataKey="messages" stroke="#818cf8" strokeWidth={3} fillOpacity={1} fill="url(#colorMessages)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className={panelClass}>
          <div className="mb-10">
            <h4 className="text-[11px] uppercase tracking-[0.2em] font-black text-slate-400 mb-1">State Distribution</h4>
            <p className="text-xs text-slate-500">Breakdown of transcript review status</p>
          </div>
          <div className="h-[320px] flex flex-col items-center justify-center relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={statusPie} dataKey="value" nameKey="name" outerRadius="90%" innerRadius="75%" paddingAngle={8}>
                  {statusPie.map((entry, idx) => (
                    <Cell key={idx} fill={chartColors[idx % chartColors.length]} stroke="rgba(255,255,255,0.05)" />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
               <p className="text-[10px] uppercase tracking-[0.3em] font-black text-slate-600 mb-1">Focus</p>
               <p className="text-2xl font-black text-white italic">Audit</p>
            </div>
          </div>
        </div>
      </div>

      {/* Intelligence Insights */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Quality Metrics */}
        <div className={panelClass}>
           <div className="flex items-center gap-3 mb-8">
              <div className="p-2 rounded-lg bg-sky-500/10"><CheckCircle2 className="w-4 h-4 text-sky-400" /></div>
              <h4 className="text-[10px] uppercase tracking-[0.2em] font-black text-slate-300">RAG Intelligence</h4>
           </div>
           <div className="space-y-6">
              {[
                { label: 'Retrieval Accuracy', value: deepDive?.rag_quality?.retrieval_hit_rate || 0, sub: 'Knowledge overlap' },
                { label: 'Context Coverage', value: 100 - (deepDive?.rag_quality?.low_context_rate || 0), sub: 'Source grounding' },
                { label: 'Response Confidence', value: 92, sub: 'AI self-assessment' }
              ].map((m, i) => (
                <div key={i}>
                  <div className="flex justify-between items-end mb-2">
                    <div>
                       <p className="text-[10px] font-bold text-white uppercase tracking-wider">{m.label}</p>
                       <p className="text-[9px] text-slate-500 font-medium">{m.sub}</p>
                    </div>
                    <span className="text-xs font-black text-sky-400 italic">{m.value}%</span>
                  </div>
                  <div className="h-1 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-sky-600 to-indigo-600 rounded-full transition-all duration-1000 shadow-[0_0_8px_rgba(56,189,248,0.4)]" style={{ width: `${m.value}%` }} />
                  </div>
                </div>
              ))}
           </div>
        </div>

        {/* Operations */}
        <div className={panelClass}>
           <div className="flex items-center gap-3 mb-8">
              <div className="p-2 rounded-lg bg-indigo-500/10"><Zap className="w-4 h-4 text-indigo-400" /></div>
              <h4 className="text-[10px] uppercase tracking-[0.2em] font-black text-slate-300">Ops Throughput</h4>
           </div>
           <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5">
                 <p className="text-[9px] uppercase font-bold text-slate-500 mb-1">Approved</p>
                 <p className="text-xl font-black text-emerald-400 tracking-tighter italic">{deepDive?.operations?.approved_sessions || 0}</p>
              </div>
              <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5">
                 <p className="text-[9px] uppercase font-bold text-slate-500 mb-1">Discarded</p>
                 <p className="text-xl font-black text-rose-400 tracking-tighter italic">{deepDive?.operations?.discarded_sessions || 0}</p>
              </div>
              <div className="col-span-2 p-4 rounded-2xl bg-white/[0.02] border border-white/5 flex items-center justify-between">
                 <div>
                    <p className="text-[9px] uppercase font-bold text-slate-500 mb-1">Approval Efficiency</p>
                    <p className="text-xs font-bold text-white italic">{deepDive?.operations?.approval_rate || 0}%</p>
                 </div>
                 <div className="w-12 h-12 rounded-full border-2 border-emerald-500/20 flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                 </div>
              </div>
           </div>
        </div>

        {/* Alerts */}
        <div className={panelClass}>
           <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                 <div className="p-2 rounded-lg bg-rose-500/10"><AlertTriangle className="w-4 h-4 text-rose-400" /></div>
                 <h4 className="text-[10px] uppercase tracking-[0.2em] font-black text-slate-300">Risk Sentinel</h4>
              </div>
              <span className="text-[9px] font-black text-rose-500 bg-rose-500/5 px-2 py-0.5 rounded-full border border-rose-500/20">LIVE</span>
           </div>
           <div className="space-y-3 max-h-[220px] overflow-y-auto pr-2 custom-scrollbar">
              {(alerts?.rules || []).map((rule) => (
                <div key={rule.id} className={`p-3 rounded-xl border transition-all ${rule.triggered ? 'bg-rose-500/10 border-rose-500/20' : 'bg-white/[0.02] border-white/5 opacity-60'}`}>
                   <div className="flex justify-between items-start mb-1">
                      <p className="text-[10px] font-bold text-white uppercase tracking-tight truncate">{rule.name}</p>
                      {rule.triggered && <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />}
                   </div>
                   <p className="text-[9px] text-slate-500 truncate">{rule.metric_key} {rule.comparator} {rule.threshold}</p>
                </div>
              ))}
              {(alerts?.rules || []).length === 0 && (
                <p className="text-[10px] text-slate-600 italic text-center py-10">No security triggers configured.</p>
              )}
           </div>
        </div>
      </div>

      {/* Regression & Trends */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 pb-20">
        <div className={panelClass}>
           <div className="flex items-center gap-3 mb-8">
              <Clock className="w-4 h-4 text-slate-500" />
              <h4 className="text-[10px] uppercase tracking-[0.2em] font-black text-slate-300">Consistency Regression</h4>
           </div>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {Object.entries(regression?.deltas || {}).slice(0, 4).map(([key, value]) => (
                <div key={key} className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 group-hover:border-sky-500/20 transition-all">
                   <p className="text-[9px] uppercase font-bold text-slate-500 mb-2 truncate">{key.replaceAll('_', ' ')}</p>
                   <div className="flex items-end gap-2">
                      <span className="text-xl font-black text-white italic">{value.current}</span>
                      <span className={`text-[10px] font-bold pb-1 ${value.absolute >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {value.absolute >= 0 ? '+' : ''}{value.percent}%
                      </span>
                   </div>
                </div>
              ))}
           </div>
        </div>

        <div className={panelClass}>
           <div className="flex items-center gap-3 mb-8">
              <TrendingUp className="w-4 h-4 text-slate-500" />
              <h4 className="text-[10px] uppercase tracking-[0.2em] font-black text-slate-300">Topic Velocity</h4>
           </div>
           <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                 <BarChart data={depthBars}>
                    <XAxis dataKey="bucket" hide />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="value" fill="#818cf8" radius={[12, 12, 4, 4]} barSize={24} />
                 </BarChart>
              </ResponsiveContainer>
           </div>
           <div className="mt-6 flex flex-wrap gap-3">
              {(topicTrends?.topics || []).map((t, i) => (
                <span key={i} className="text-[9px] font-black uppercase tracking-widest text-slate-400 bg-white/5 px-3 py-1 rounded-full border border-white/5">{t}</span>
              ))}
           </div>
        </div>
      </div>
    </div>
  );
};

export default AdminAnalytics;

