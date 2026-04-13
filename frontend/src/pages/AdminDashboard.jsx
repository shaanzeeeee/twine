import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import api from '../services/api';
import {
    MessageSquare,
    ArrowLeft,
    LogOut,
    Shield,
    ChevronRight,
    Database,
    Trash2,
    Menu,
    Download,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const AdminDashboard = () => {
    const [sessions, setSessions] = useState([]);
    const [selectedSession, setSelectedSession] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
    const [search, setSearch] = useState('');
    const [minMessages, setMinMessages] = useState(0);
    const [toast, setToast] = useState(null);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [pendingDiscard, setPendingDiscard] = useState(null);
    const { logout } = useContext(AuthContext);
    const navigate = useNavigate();

    useEffect(() => {
        fetchTranscripts();
    }, [search, minMessages]);

    useEffect(() => {
        if (!pendingDiscard) return undefined;

        const timerId = window.setTimeout(async () => {
            try {
                await api.delete(`/admin/sessions/${pendingDiscard.session.session_id}`);
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
            const response = await api.get('/admin/transcripts', {
                params: {
                    search,
                    min_messages: minMessages,
                },
            });
            setSessions(response.data);
            if (response.data.length > 0 && !selectedSession) {
                setSelectedSession(response.data[0]);
            } else if (selectedSession) {
                const refreshed = response.data.find((s) => s.session_id === selectedSession.session_id);
                setSelectedSession(refreshed || response.data[0] || null);
            }
        } catch (error) {
            console.error("Failed to fetch transcripts", error);
            pushToast('Failed to fetch transcripts', 'error');
        } finally {
            setLoading(false);
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

    const handleLogout = () => {
        logout();
        navigate('/login');
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
        <div className="flex h-screen bg-[#0a0a0a] text-white font-sans overflow-hidden">
            {/* Sidebar */}
            <div className={`fixed md:static inset-y-0 left-0 z-30 w-80 bg-[#0f0f0f] border-r border-white/5 flex flex-col h-full shadow-2xl transform transition-transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
                <div className="p-6 border-b border-white/5 flex justify-between items-center bg-black/40">
                    <div className="flex items-center gap-2">
                        <Shield className="w-5 h-5 text-red-600" />
                        <h2 className="text-xs font-black uppercase tracking-widest text-gray-100">
                           Intelligence Logs
                        </h2>
                    </div>
                    <button onClick={handleLogout} className="text-gray-500 hover:text-red-600 transition" title="Logout">
                        <LogOut className="w-4 h-4" />
                    </button>
                </div>
                <div className="p-4 border-b border-white/5 space-y-3">
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search session id or content"
                        className="w-full px-3 py-2 text-xs bg-zinc-900 border border-white/10 focus:border-red-600 outline-none"
                    />
                    <select
                        value={minMessages}
                        onChange={(e) => setMinMessages(Number(e.target.value))}
                        className="w-full px-3 py-2 text-xs bg-zinc-900 border border-white/10 focus:border-red-600 outline-none"
                    >
                        <option value={0}>All sessions</option>
                        <option value={4}>4+ messages</option>
                        <option value={8}>8+ messages</option>
                        <option value={12}>12+ messages</option>
                    </select>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    {sessions.map((session) => (
                        <button
                            key={session.session_id}
                            onClick={() => {
                                setSelectedSession(session);
                                setSidebarOpen(false);
                            }}
                            className={`w-full text-left p-4 transition-all duration-300 relative group overflow-hidden ${
                                selectedSession?.session_id === session.session_id
                                ? 'bg-zinc-800 shadow-xl scale-[1.02] border-l-4 border-red-600 skew-x-[-2deg]'
                                : 'hover:bg-zinc-900/50 grayscale hover:grayscale-0'
                            }`}
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
                                Pending Review
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
            <div className="flex-1 flex flex-col h-full bg-[#0a0a0a] relative">
                 <div className="absolute inset-0 opacity-5 bg-[url('/gym-bg.png')] bg-cover bg-center grayscale" />
                
                {selectedSession ? (
                    <>
                        <div className="relative z-10 h-16 border-b border-white/5 bg-black/20 backdrop-blur-xl flex items-center px-8 justify-between shrink-0">
                            <div>
                                <h3 className="text-xs font-black uppercase tracking-widest text-white italic">KingsBox Intelligence Report</h3>
                                <p className="text-[10px] text-zinc-500 font-bold">
                                    {selectedSession.guest_name ? `Guest: ${selectedSession.guest_name}` : 'Guest: Anonymous'} • Session ID: {selectedSession.session_id}
                                </p>
                            </div>
                            <div className="flex items-center space-x-2">
                                <button
                                    onClick={() => setSidebarOpen((prev) => !prev)}
                                    className="md:hidden flex items-center gap-2 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-zinc-100 bg-zinc-800 hover:bg-zinc-700 transition-all"
                                >
                                    <Menu className="w-3 h-3" />
                                    Sessions
                                </button>
                                <button
                                    onClick={exportSession}
                                    className="flex items-center gap-2 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-zinc-100 bg-zinc-800 hover:bg-zinc-700 transition-all"
                                >
                                    <Download className="w-3 h-3" />
                                    Export
                                </button>
                                <button
                                    onClick={handleAddSessionToDatabase}
                                    className="flex items-center gap-2 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-zinc-100 bg-zinc-800 hover:bg-emerald-700 transition-all"
                                >
                                    <Database className="w-3 h-3" />
                                    Add to Database
                                </button>
                                <button
                                    onClick={() => setShowDiscardConfirm(true)}
                                    className="flex items-center gap-2 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-zinc-100 bg-zinc-800 hover:bg-red-700 transition-all"
                                >
                                    <Trash2 className="w-3 h-3" />
                                    Discard
                                </button>
                            </div>
                        </div>
                        
                        <div className="relative z-10 flex-1 overflow-y-auto p-10 space-y-8">
                            {selectedSession.messages.map((msg) => {
                                const isUser = msg.role === 'user';
                                return (
                                    <div key={msg.id} className={`flex max-w-[90%] ${isUser ? 'ml-auto justify-end' : 'mr-auto justify-start'}`}>
                                        <div className={`relative px-6 py-4 shadow-2xl transition-all border border-white/5 backdrop-blur-sm ${
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
                        <p className="text-[10px] uppercase font-black tracking-[0.3em]">Standby for Data Selection</p>
                        <button
                            onClick={() => navigate('/')}
                            className="mt-5 px-4 py-2 text-[10px] uppercase tracking-widest font-black text-zinc-200 bg-zinc-900 border border-white/10 hover:border-red-600 transition-all"
                        >
                            Go To Chat
                        </button>
                    </div>
                )}
            </div>
            
            <button 
                onClick={() => navigate('/')} 
                className="absolute bottom-10 right-10 w-14 h-14 bg-red-600 flex items-center justify-center shadow-[0_0_30px_rgba(227,30,36,0.3)] text-white transition-all hover:scale-110 active:scale-95 z-30 rotate-45 group hover:rotate-0"
                title="Go to Chat"
            >
                <ArrowLeft className="w-6 h-6 -rotate-45 group-hover:rotate-0" />
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
