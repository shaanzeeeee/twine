import React, { useState, useEffect, useContext, lazy, Suspense } from 'react';
import { AuthContext } from '../context/AuthContext';
import api from '../services/api';
import {
    MessageSquare,
    ArrowLeft,
    LogOut,
    Sparkles,
    ChevronRight,
    Database,
    Trash2,
    Menu,
    Download,
    RefreshCw,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const AdminAnalytics = lazy(() => import('../components/AdminAnalytics'));
const FileUpload = lazy(() => import('../components/FileUpload'));

const AdminDashboard = () => {
    const [sessions, setSessions] = useState([]);
    const [selectedSession, setSelectedSession] = useState(null);
    const [viewMode, setViewMode] = useState('transcripts');
    const [page, setPage] = useState(1);
    const [hasNextPage, setHasNextPage] = useState(false);
    const [loading, setLoading] = useState(true);
    const [sessionLoading, setSessionLoading] = useState(false);
    const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
    const [search, setSearch] = useState('');
    const [minMessages, setMinMessages] = useState(0);
    const [showArchived, setShowArchived] = useState(false);
    const [toast, setToast] = useState(null);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [pendingDiscard, setPendingDiscard] = useState(null);
    const [isSyncing, setIsSyncing] = useState(false);
    const [refreshToken, setRefreshToken] = useState(0);
    const [syncStatus, setSyncStatus] = useState('idle');
    const [syncMessage, setSyncMessage] = useState('');
    const { logout } = useContext(AuthContext);
    const navigate = useNavigate();

    useEffect(() => {
        fetchTranscripts();
    }, [search, minMessages, showArchived, page]);

    useEffect(() => {
        if (!pendingDiscard) return undefined;

        const timerId = window.setTimeout(async () => {
            try {
                await api.delete(`/admin/sessions/${pendingDiscard.session.session_id}`, {
                    data: { reason: 'Discarded from admin review' },
                });
                pushToast(`Session #${pendingDiscard.session.session_id} discarded`, 'info');
            } catch (error) {
                // Restore if backend discard fails.
                setSessions((prev) => [pendingDiscard.session, ...prev]);
                if (!selectedSession) {
                    setSelectedSession(pendingDiscard.session);
                }
                pushToast('Discard failed. Session restored.', 'error');
            } finally {
                setPendingDiscard(null);
            }
        }, 8000);

        return () => window.clearTimeout(timerId);
    }, [pendingDiscard, selectedSession]);

    const pushToast = (message, type = 'info') => {
        setToast({ message, type });
        window.clearTimeout(window.__admin_toast_timer);
        window.__admin_toast_timer = window.setTimeout(() => setToast(null), 3000);
    };

    const fetchTranscripts = async () => {
        try {
            const endpoint = showArchived ? '/admin/transcripts/archive' : '/admin/transcripts';
            const response = await api.get(endpoint, {
                params: {
                    search,
                    min_messages: minMessages,
                    page,
                    page_size: 25,
                    paged: true,
                    summary_only: true,
                },
            });
            const items = response.data.items || [];
            setSessions(items);
            setHasNextPage(Boolean(response.data.has_next));

            if (items.length > 0 && !selectedSession) {
                await loadSessionDetails(items[0]);
            } else if (selectedSession) {
                const refreshed = items.find((s) => s.session_id === selectedSession.session_id);
                if (refreshed) {
                    setSelectedSession((prev) => ({ ...refreshed, messages: prev?.messages || [] }));
                } else {
                    setSelectedSession(null);
                }
            }
        } catch (error) {
            console.error("Failed to fetch transcripts", error);
            pushToast('Failed to fetch transcripts', 'error');
        } finally {
            setLoading(false);
        }
    };

    const loadSessionDetails = async (sessionSummary) => {
        try {
            setSessionLoading(true);
            const response = await api.get(`/admin/sessions/${sessionSummary.session_id}/export`);
            setSelectedSession(response.data);
        } catch (error) {
            pushToast('Failed to load full session', 'error');
            setSelectedSession(sessionSummary);
        } finally {
            setSessionLoading(false);
        }
    };

    const removeSessionFromState = (sessionId) => {
        const updatedSessions = sessions.filter((session) => session.session_id !== sessionId);
        setSessions(updatedSessions);

        if (selectedSession?.session_id === sessionId) {
            setSelectedSession(updatedSessions.length > 0 ? updatedSessions[0] : null);
        }
    };

    const handleAddSessionToDatabase = async () => {
        if (!selectedSession) return;
        try {
            const response = await api.post(`/admin/sessions/${selectedSession.session_id}/add-to-database`);
            removeSessionFromState(selectedSession.session_id);
            pushToast(`Saved ${response.data.saved_pairs} Q/A pairs`, 'info');
        } catch (error) {
            console.error("Failed to add session to database", error);
            pushToast('Failed to add session to database', 'error');
        }
    };

    const handleDiscardSession = async () => {
        if (!selectedSession) return;
        const discarded = selectedSession;
        removeSessionFromState(discarded.session_id);
        setPendingDiscard({ session: discarded });
        setShowDiscardConfirm(false);
        pushToast(`Session #${discarded.session_id} queued for discard. Undo?`, 'warning');
    };

    const undoDiscard = () => {
        if (!pendingDiscard) return;
        setSessions((prev) => [pendingDiscard.session, ...prev]);
        if (!selectedSession) {
            setSelectedSession(pendingDiscard.session);
        }
        pushToast(`Discard canceled for session #${pendingDiscard.session.session_id}`, 'info');
        setPendingDiscard(null);
    };

    const exportSession = async () => {
        if (!selectedSession) return;
        try {
            const response = await api.get(`/admin/sessions/${selectedSession.session_id}/export`);
            const blob = new Blob([JSON.stringify(response.data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const anchor = document.createElement('a');
            anchor.href = url;
            anchor.download = `admin-session-${selectedSession.session_id}.json`;
            anchor.click();
            URL.revokeObjectURL(url);
            pushToast('Session export downloaded', 'info');
        } catch (error) {
            pushToast('Session export failed', 'error');
        }
    };

    const handleRestoreSession = async () => {
        if (!selectedSession) return;
        try {
            await api.post(`/admin/sessions/${selectedSession.session_id}/restore`);
            removeSessionFromState(selectedSession.session_id);
            pushToast(`Session #${selectedSession.session_id} restored`, 'info');
        } catch (error) {
            pushToast('Failed to restore session', 'error');
        }
    };

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const handleChatAsGuest = () => {
        logout();
        navigate('/');
    };

    const closeSidebar = () => setSidebarOpen(false);

    const handleDriveSync = async () => {
        try {
            setIsSyncing(true);
            setSyncStatus('in_progress');
            setSyncMessage('Manual ingest in progress...');
            const response = await api.post('/admin/drive/sync');
            if (response.data?.status === 'error') {
                const message = response.data.message || 'Drive sync failed';
                setSyncStatus('error');
                setSyncMessage(message);
                pushToast(message, 'error');
                return;
            }
            const message = `Drive sync complete${response.data?.docs_indexed != null ? ` • ${response.data.docs_indexed} docs indexed` : ''}`;
            pushToast(
                message,
                'info'
            );
            setSyncStatus('success');
            setSyncMessage(message);
            setRefreshToken((value) => value + 1);
            await fetchTranscripts();
        } catch (error) {
            const message = error?.response?.data?.detail || 'Drive sync failed';
            setSyncStatus('error');
            setSyncMessage(message);
            pushToast(message, 'error');
        } finally {
            setIsSyncing(false);
            window.clearTimeout(window.__admin_sync_timer);
            window.__admin_sync_timer = window.setTimeout(() => {
                setSyncStatus('idle');
                setSyncMessage('');
            }, 3500);
        }
    };

    const formatDateTime = (value) => {
        return new Date(value).toLocaleString([], {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const loadingSkeleton = (
        <div className="min-h-screen bg-[#0a0a0a] text-white p-6 md:p-10">
            <div className="grid grid-cols-1 md:grid-cols-[320px_1fr] gap-6 h-full">
                <div className="space-y-3">
                    <div className="h-12 bg-zinc-900/70 animate-pulse" />
                    <div className="h-20 bg-zinc-900/50 animate-pulse" />
                    <div className="h-20 bg-zinc-900/40 animate-pulse" />
                </div>
                <div className="space-y-4">
                    <div className="h-16 bg-zinc-900/70 animate-pulse" />
                    <div className="h-24 bg-zinc-900/50 animate-pulse" />
                    <div className="h-24 bg-zinc-900/40 animate-pulse" />
                </div>
            </div>
        </div>
    );

    if (loading) return loadingSkeleton;

    return (
        <div className="flex h-screen bg-[#09090F] text-white font-sans overflow-hidden">
            {sidebarOpen && (
                <button
                    type="button"
                    aria-label="Close sidebar"
                    onClick={closeSidebar}
                    data-testid="admin-sidebar-backdrop"
                    className="fixed inset-0 z-20 bg-black/60 md:hidden"
                />
            )}
            {/* Sidebar */}
            <div
                data-testid="admin-sidebar"
                className={`fixed md:static inset-y-0 left-0 z-30 w-80 bg-[#0f0f0f] border-r border-white/5 flex flex-col h-full shadow-2xl transform transition-transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}
            >
                <div className="p-6 border-b border-white/[0.05] flex justify-between items-center bg-[#0D0D15]">
                    <div className="flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-blue-400" />
                        <h2 className="text-xs font-bold uppercase tracking-[0.25em] text-gray-100">
                           Twine Dashboard
                        </h2>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={closeSidebar}
                            className="md:hidden text-gray-400 hover:text-white transition"
                            title="Close sidebar"
                            aria-label="Close sidebar"
                        >
                            <Menu className="w-4 h-4 rotate-180" />
                        </button>
                        <button onClick={handleLogout} className="text-gray-500 hover:text-blue-400 transition" title="Logout">
                            <LogOut className="w-4 h-4" />
                        </button>
                    </div>
                </div>
                <div className="p-4 border-b border-white/5 space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                        <button
                            onClick={() => {
                                setViewMode('transcripts');
                                closeSidebar();
                            }}
                            className={`px-3 py-2 text-xs font-bold uppercase tracking-widest border rounded-lg transition-all ${viewMode === 'transcripts' ? 'bg-blue-500/15 text-blue-200 border-blue-500/30' : 'bg-white/[0.03] text-zinc-100 border-white/[0.07] hover:border-blue-500/40'}`}
                        >
                            Transcripts
                        </button>
                        <button
                            onClick={() => {
                                setViewMode('analytics');
                                closeSidebar();
                            }}
                            className={`px-3 py-2 text-xs font-bold uppercase tracking-widest border rounded-lg transition-all ${viewMode === 'analytics' ? 'bg-blue-500/15 text-blue-200 border-blue-500/30' : 'bg-white/[0.03] text-zinc-100 border-white/[0.07] hover:border-blue-500/40'}`}
                        >
                            Analytics
                        </button>
                    </div>
                    <button
                        onClick={() => {
                            setViewMode('uploads');
                            closeSidebar();
                        }}
                        className={`w-full px-3 py-2 text-xs font-bold uppercase tracking-widest border rounded-lg transition-all ${viewMode === 'uploads' ? 'bg-violet-500/15 text-violet-200 border-violet-500/30' : 'bg-white/[0.03] text-zinc-100 border-white/[0.07] hover:border-violet-500/40'}`}
                    >
                        📄 Upload Documents
                    </button>
                    <button
                        onClick={() => {
                            setShowArchived((prev) => !prev);
                            closeSidebar();
                        }}
                        className={`w-full px-3 py-2 text-xs font-bold uppercase tracking-widest border rounded-lg transition-all ${showArchived ? 'bg-amber-900/30 text-amber-200 border-amber-700/40' : 'bg-white/[0.03] text-zinc-100 border-white/[0.07] hover:border-blue-500/40'}`}
                    >
                        {showArchived ? 'Viewing Archive' : 'Viewing Active Sessions'}
                    </button>
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search session id or content"
                        className="w-full px-3 py-2 text-xs bg-white/[0.03] border border-white/[0.07] rounded-lg focus:border-blue-500/60 outline-none"
                        disabled={viewMode !== 'transcripts'}
                    />
                    <select
                        value={minMessages}
                        onChange={(e) => setMinMessages(Number(e.target.value))}
                        className="w-full px-3 py-2 text-xs bg-white/[0.03] border border-white/[0.07] rounded-lg focus:border-blue-500/60 outline-none"
                        disabled={viewMode !== 'transcripts'}
                    >
                        <option value={0}>All sessions</option>
                        <option value={4}>4+ messages</option>
                        <option value={8}>8+ messages</option>
                        <option value={12}>12+ messages</option>
                    </select>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
                            disabled={page <= 1}
                            className="flex-1 px-2 py-2 text-[10px] uppercase tracking-widest font-black bg-zinc-900 border border-white/10 disabled:opacity-40"
                        >
                            Prev
                        </button>
                        <button
                            onClick={() => setPage((prev) => prev + 1)}
                            disabled={!hasNextPage}
                            className="flex-1 px-2 py-2 text-[10px] uppercase tracking-widest font-black bg-zinc-900 border border-white/10 disabled:opacity-40"
                        >
                            Next
                        </button>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    {viewMode === 'analytics' && (
                        <div className="p-4 text-center text-[10px] uppercase tracking-widest font-black text-zinc-500 border border-white/5 bg-zinc-950/50">
                            Analytics mode active
                        </div>
                    )}
                    {sessions.map((session) => (
                        <button
                            key={session.session_id}
                            onClick={async () => {
                                await loadSessionDetails(session);
                                closeSidebar();
                            }}
                            className={`w-full text-left p-4 transition-all duration-300 relative group overflow-hidden ${
                                selectedSession?.session_id === session.session_id
                                ? 'bg-zinc-800 shadow-xl scale-[1.02] border-l-4 border-red-600 skew-x-[-2deg]'
                                : 'hover:bg-zinc-900/50 grayscale hover:grayscale-0'
                            } ${viewMode !== 'transcripts' ? 'opacity-40 pointer-events-none' : ''}`}
                        >
                            <div className="flex justify-between items-start relative z-10">
                                <span className={`text-[10px] font-black uppercase tracking-tighter ${
                                    selectedSession?.session_id === session.session_id ? 'text-white' : 'text-gray-500'
                                }`}>
                                    {session.guest_name ? `${session.guest_name} • Session #${session.session_id}` : `Guest Session #${session.session_id}`}
                                </span>
                                <ChevronRight size={14} className={selectedSession?.session_id === session.session_id ? 'text-red-600' : 'text-zinc-800'} />
                            </div>
                            <span className="text-[10px] font-bold text-zinc-600 mt-1 block">
                                {formatDateTime(session.created_at)} • {session.message_count} Units
                            </span>
                            <span className="inline-block mt-2 px-2 py-1 text-[9px] uppercase tracking-widest font-black text-amber-300 bg-amber-900/30 border border-amber-700/30">
                                {(session.status || 'pending_review').replace('_', ' ')}
                            </span>
                        </button>
                    ))}
                    {sessions.length === 0 && (
                        <div className="p-4 text-center space-y-3">
                            <p className="text-[10px] uppercase font-bold text-zinc-700 tracking-widest">No sessions found</p>
                            <button
                                onClick={() => navigate('/')}
                                className="px-3 py-2 text-[10px] uppercase tracking-widest font-black bg-zinc-800 hover:bg-red-700 transition-all"
                            >
                                Go To Chat
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col h-full bg-[#0a0a0a] relative min-w-0">
                 <div className="absolute inset-0 opacity-5 pointer-events-none" style={{background: 'radial-gradient(ellipse at 50% 0%, rgba(59,130,246,0.15) 0%, transparent 60%)'}} />
                 {syncStatus !== 'idle' && (
                     <div className={`relative z-20 mx-4 mt-4 sm:mx-8 px-4 py-3 rounded-2xl border text-[10px] font-black uppercase tracking-widest ${syncStatus === 'success' ? 'bg-emerald-900/40 text-emerald-200 border-emerald-700/40' : syncStatus === 'error' ? 'bg-red-900/40 text-red-200 border-red-700/40' : 'bg-zinc-900/90 text-zinc-100 border-white/10'}`}>
                         {syncMessage}
                     </div>
                 )}
                
                 {/* Mobile Header Tool */}
                 <div className="md:hidden relative z-20 flex flex-wrap items-center justify-between gap-3 p-4 border-b border-white/5 bg-[#0a0a0a] shrink-0">
                     <button
                         onClick={() => setSidebarOpen((prev) => !prev)}
                         className="flex items-center gap-2 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-zinc-100 bg-zinc-900 border border-white/10 rounded-2xl hover:border-red-600 transition-all"
                     >
                         <Menu className="w-3 h-3" />
                         {sidebarOpen ? 'Close Menu' : 'Open Menu'}
                     </button>
                     <div className="flex flex-wrap items-center gap-2">
                         <button
                             onClick={handleChatAsGuest}
                             className="flex items-center gap-2 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-zinc-100 bg-zinc-900 border border-white/10 rounded-2xl hover:border-red-600 transition-all"
                         >
                             <MessageSquare className="w-3 h-3" />
                             Guest Chat
                         </button>
                         <button
                             onClick={handleDriveSync}
                             disabled={isSyncing}
                             className="flex items-center gap-2 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-white bg-gradient-to-r from-blue-500 to-violet-600 border border-blue-500/30 rounded-xl hover:from-blue-600 hover:to-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                         >
                             <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
                             Ingest
                         </button>
                     </div>
                 </div>

                <div className="relative z-10 hidden md:flex items-center justify-end gap-2 px-8 py-3 border-b border-white/5 bg-black/20 backdrop-blur-xl shrink-0">
                    <button
                        onClick={handleChatAsGuest}
                        className="flex items-center gap-2 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-zinc-100 bg-white/[0.03] border border-white/[0.07] rounded-xl hover:border-blue-500/40 transition-all"
                    >
                        <MessageSquare className="w-3 h-3" />
                        Chat as Guest
                    </button>
                    <button
                        onClick={handleDriveSync}
                        disabled={isSyncing}
                        className="flex items-center gap-2 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-white bg-red-600 border border-red-600 rounded-2xl hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                        <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
                        {isSyncing ? 'Syncing Drive' : 'Ingest Drive'}
                    </button>
                </div>

                {viewMode === 'uploads' ? (
                    <Suspense fallback={<div className="p-6 text-zinc-400">Loading...</div>}>
                        <FileUpload />
                    </Suspense>
                ) : viewMode === 'analytics' ? (
                    <Suspense
                        fallback={
                            <div className="p-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                                {Array.from({ length: 8 }).map((_, idx) => (
                                    <div key={idx} className="h-24 bg-zinc-900/60 border border-white/[0.07] animate-pulse rounded-xl" />
                                ))}
                            </div>
                        }
                    >
                        <AdminAnalytics refreshToken={refreshToken} syncStatus={syncStatus} syncMessage={syncMessage} />
                    </Suspense>
                ) : selectedSession ? (
                    <>
                        <div className="relative z-10 h-auto py-3 sm:py-0 sm:h-16 border-b border-white/5 bg-black/20 backdrop-blur-xl flex flex-col sm:flex-row items-start sm:items-center px-4 sm:px-8 justify-between shrink-0 gap-3 sm:gap-0">
                            <div className="truncate w-full sm:w-auto">
                                <h3 className="text-[10px] sm:text-xs font-bold uppercase tracking-[0.25em] text-white truncate">Twine Session Report</h3>
                                <p className="text-[9px] sm:text-[10px] text-zinc-500 font-bold truncate">
                                    {selectedSession.guest_name ? `Guest: ${selectedSession.guest_name}` : 'Guest: Anonymous'} • Session ID: {selectedSession.session_id}
                                </p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                <button
                                    onClick={exportSession}
                                    className="flex items-center gap-2 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-zinc-100 bg-white/[0.03] border border-white/[0.07] rounded-xl hover:border-blue-500/40 transition-all"
                                >
                                    <Download className="w-3 h-3" />
                                    Export
                                </button>
                                {showArchived ? (
                                    <button
                                        onClick={handleRestoreSession}
                                        className="flex items-center gap-2 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-zinc-100 bg-white/[0.03] border border-white/[0.07] rounded-xl hover:border-blue-500/40 transition-all"
                                    >
                                        <Database className="w-3 h-3" />
                                        Restore Session
                                    </button>
                                ) : (
                                    <>
                                        <button
                                            onClick={handleAddSessionToDatabase}
                                            className="flex items-center gap-2 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-zinc-100 bg-white/[0.03] border border-white/[0.07] rounded-xl hover:border-blue-500/40 transition-all"
                                        >
                                            <Database className="w-3 h-3" />
                                            Add to Database
                                        </button>
                                        <button
                                            onClick={() => setShowDiscardConfirm(true)}
                                            className="flex items-center gap-2 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-zinc-100 bg-white/[0.03] border border-white/[0.07] rounded-xl hover:border-blue-500/40 transition-all"
                                        >
                                            <Trash2 className="w-3 h-3" />
                                            Discard
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                        
                        <div className="relative z-10 flex-1 overflow-y-auto p-4 sm:p-10 space-y-6 sm:space-y-8">
                            {sessionLoading && (
                                <div className="text-xs uppercase tracking-widest text-zinc-500">Loading full session...</div>
                            )}
                            {(selectedSession.messages || []).map((msg) => {
                                const isUser = msg.role === 'user';
                                return (
                                    <div key={msg.id} className={`flex max-w-[90%] ${isUser ? 'ml-auto justify-end' : 'mr-auto justify-start'}`}>
                                        <div className={`relative w-full px-4 sm:px-6 py-3 sm:py-4 shadow-2xl transition-all border border-white/5 backdrop-blur-sm ${
                                            isUser 
                                            ? 'bg-red-600/90 text-white skew-x-[-2deg]' 
                                            : 'bg-zinc-900/90 text-zinc-100 skew-x-[2deg]'
                                        }`}>
                                            <div className={`mb-2 text-[10px] uppercase tracking-widest font-black flex items-center justify-between gap-3 ${isUser ? 'text-red-100 skew-x-[2deg]' : 'text-zinc-400 skew-x-[-2deg]'}`}>
                                                <span>{isUser ? 'User' : 'Assistant'}</span>
                                                <span>{formatDateTime(msg.timestamp || selectedSession.created_at)}</span>
                                            </div>
                                            <div className={`text-sm font-medium leading-relaxed ${isUser ? 'skew-x-[2deg]' : 'skew-x-[-2deg]'}`}>
                                                {msg.content}
                                            </div>
                                            
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </>
                ) : (
                    <div className="relative z-10 flex-1 flex flex-col items-center justify-center text-zinc-800">
                        <MessageSquare className="w-16 h-16 mb-4 opacity-10" />
                        <p className="text-[10px] uppercase font-bold tracking-[0.25em]">Select a session to review</p>
                        <button
                            onClick={() => navigate('/')}
                            className="mt-5 px-4 py-2 text-[10px] uppercase tracking-widest font-bold text-zinc-200 bg-white/[0.03] border border-white/[0.07] rounded-xl hover:border-blue-500/40 transition-all"
                        >
                            Go To Chat
                        </button>
                    </div>
                )}
            </div>
            
            <button 
                onClick={() => navigate('/')} 
                className="absolute bottom-10 right-10 w-14 h-14 bg-gradient-to-br from-blue-500 to-violet-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/25 text-white transition-all hover:scale-110 active:scale-95 z-30"
                title="Go to Chat"
            >
                <ArrowLeft className="w-6 h-6" />
            </button>

            {showDiscardConfirm && selectedSession && (
                <div className="absolute inset-0 z-40 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="w-full max-w-md bg-zinc-900 border border-white/10 p-6 shadow-2xl">
                        <h4 className="text-sm font-black uppercase tracking-widest text-white">Discard Session?</h4>
                        <p className="mt-3 text-xs text-zinc-300 leading-relaxed">
                            This will permanently remove session #{selectedSession.session_id} and all of its messages from transcripts.
                        </p>
                        <div className="mt-6 flex justify-end gap-2">
                            <button
                                onClick={() => setShowDiscardConfirm(false)}
                                className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-zinc-100 bg-zinc-700 hover:bg-zinc-600 transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDiscardSession}
                                className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-white bg-red-700 hover:bg-red-600 transition-all"
                            >
                                Confirm Discard
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {pendingDiscard && (
                <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-40 px-4 py-3 bg-zinc-900 border border-amber-700/60 flex items-center gap-4">
                    <p className="text-[10px] uppercase tracking-widest font-black text-amber-200">
                        Session #{pendingDiscard.session.session_id} will be discarded in 8s
                    </p>
                    <button
                        onClick={undoDiscard}
                        className="px-3 py-1 text-[10px] uppercase tracking-widest font-black text-zinc-100 bg-zinc-700 hover:bg-zinc-600 transition-all"
                    >
                        Undo
                    </button>
                </div>
            )}

            {toast && (
                <div className={`absolute bottom-6 left-1/2 -translate-x-1/2 z-40 px-4 py-2 text-[10px] uppercase tracking-widest font-black border ${toast.type === 'error' ? 'bg-red-950/90 text-red-200 border-red-700' : toast.type === 'warning' ? 'bg-amber-950/90 text-amber-200 border-amber-700' : 'bg-zinc-900/90 text-zinc-100 border-white/10'}`}>
                    {toast.message}
                </div>
            )}
        </div>
    );
};

export default AdminDashboard;
