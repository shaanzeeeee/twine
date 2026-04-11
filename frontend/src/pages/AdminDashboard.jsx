import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import api from '../services/api';
import { MessageSquare, Star, ArrowLeft, LogOut, Shield, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const AdminDashboard = () => {
    const [sessions, setSessions] = useState([]);
    const [selectedSession, setSelectedSession] = useState(null);
    const [loading, setLoading] = useState(true);
    const { logout } = useContext(AuthContext);
    const navigate = useNavigate();

    useEffect(() => {
        fetchTranscripts();
    }, []);

    const fetchTranscripts = async () => {
        try {
            const response = await api.get('/admin/transcripts');
            setSessions(response.data);
            if (response.data.length > 0 && !selectedSession) {
                setSelectedSession(response.data[0]);
            }
        } catch (error) {
            console.error("Failed to fetch transcripts", error);
        } finally {
            setLoading(false);
        }
    };

    const handleUpvote = async (messageId) => {
        try {
            await api.post(`/admin/upvote/${messageId}`);
            const updatedSessions = sessions.map(session => {
                if (session.session_id === selectedSession.session_id) {
                    return {
                        ...session,
                        messages: session.messages.map(msg => 
                            msg.id === messageId ? { ...msg, upvoted: true } : msg
                        )
                    };
                }
                return session;
            });
            setSessions(updatedSessions);
            const updatedSelected = updatedSessions.find(s => s.session_id === selectedSession.session_id);
            setSelectedSession(updatedSelected);
        } catch (error) {
            console.error("Failed to upvote", error);
        }
    };

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    if (loading) return (
        <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col items-center justify-center space-y-4">
            <div className="w-10 h-10 border-4 border-red-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-[10px] uppercase tracking-widest font-black">Decrypting Secure Channels...</p>
        </div>
    );

    return (
        <div className="flex h-screen bg-[#0a0a0a] text-white font-sans overflow-hidden">
            {/* Sidebar */}
            <div className="w-80 bg-[#0f0f0f] border-r border-white/5 flex flex-col h-full shadow-2xl z-20">
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
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    {sessions.map((session) => (
                        <button
                            key={session.session_id}
                            onClick={() => setSelectedSession(session)}
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
                                    Vector Session #{session.session_id}
                                </span>
                                <ChevronRight size={14} className={selectedSession?.session_id === session.session_id ? 'text-red-600' : 'text-zinc-800'} />
                            </div>
                            <span className="text-[10px] font-bold text-zinc-600 mt-1 block">
                                {new Date(session.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} • {session.messages.length} Units
                            </span>
                        </button>
                    ))}
                    {sessions.length === 0 && (
                        <div className="p-4 text-[10px] uppercase font-bold text-zinc-700 text-center tracking-widest">Zero active signals.</div>
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
                                <p className="text-[10px] text-zinc-500 font-bold">Session ID: {selectedSession.session_id}</p>
                            </div>
                            <div className="flex items-center space-x-2">
                                <span className="w-2 h-2 bg-red-600 rounded-full animate-pulse" />
                                <span className="text-[10px] font-black uppercase text-red-600">Secure Feed</span>
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
                                            <div className={`text-sm font-medium leading-relaxed ${isUser ? 'skew-x-[2deg]' : 'skew-x-[-2deg]'}`}>
                                                {msg.content}
                                            </div>
                                            
                                            {!isUser && (
                                                <div className="pt-4 mt-4 border-t border-white/5 flex skew-x-[-2deg]">
                                                    <button 
                                                        onClick={() => handleUpvote(msg.id)}
                                                        disabled={msg.upvoted}
                                                        className={`flex items-center gap-2 px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-all ${
                                                            msg.upvoted 
                                                            ? 'text-red-500 bg-red-500/10' 
                                                            : 'text-zinc-500 bg-black/40 hover:bg-red-600 hover:text-white'
                                                        }`}
                                                    >
                                                        <Star className={`w-3 h-3 ${msg.upvoted ? 'fill-current' : ''}`} />
                                                        {msg.upvoted ? 'Committed to Memory' : 'Authorize to Memory'}
                                                    </button>
                                                </div>
                                            )}
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
        </div>
    );
};

export default AdminDashboard;
