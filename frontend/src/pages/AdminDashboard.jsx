import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import api from '../services/api';
import { MessageSquare, Star, ArrowLeft, LogOut } from 'lucide-react';
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
            // Update local state to reflect upvoted status
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
            alert("Failed to upvote message");
        }
    };

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    if (loading) return <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">Loading...</div>;

    return (
        <div className="flex h-screen bg-gray-900 text-white font-sans overflow-hidden">
            {/* Sidebar List of Sessions */}
            <div className="w-80 bg-gray-900 border-r border-gray-800 flex flex-col h-full">
                <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-gray-950">
                    <h2 className="text-lg font-bold text-gray-100 flex items-center gap-2">
                        <MessageSquare className="w-5 h-5 text-blue-500" />
                        Transcripts
                    </h2>
                    <button onClick={handleLogout} className="text-gray-400 hover:text-white" title="Logout">
                        <LogOut className="w-5 h-5" />
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-1 bg-gray-900">
                    {sessions.map((session) => (
                        <button
                            key={session.session_id}
                            onClick={() => setSelectedSession(session)}
                            className={`w-full text-left p-3 rounded-lg flex flex-col gap-1 transition-colors ${
                                selectedSession?.session_id === session.session_id
                                ? 'bg-gray-800 border-l-2 border-blue-500'
                                : 'hover:bg-gray-800/50'
                            }`}
                        >
                            <span className="text-sm font-medium text-gray-200">
                                Session #{session.session_id}
                            </span>
                            <span className="text-xs text-gray-500">
                                {new Date(session.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} • {session.messages.length} msgs
                            </span>
                        </button>
                    ))}
                    {sessions.length === 0 && (
                        <div className="p-4 text-sm text-gray-500 text-center">No chat sessions found.</div>
                    )}
                </div>
            </div>

            {/* Main Chat Viewer */}
            <div className="flex-1 flex flex-col h-full bg-gray-800">
                {selectedSession ? (
                    <>
                        <div className="h-14 border-b border-gray-700 bg-gray-800/80 backdrop-blur flex items-center px-6 justify-between shrink-0">
                            <h3 className="font-semibold text-gray-200">Session #{selectedSession.session_id} details</h3>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                            {selectedSession.messages.map((msg, index) => {
                                const isUser = msg.role === 'user';
                                return (
                                    <div key={msg.id} className={`flex max-w-[85%] ${isUser ? 'ml-auto justify-end' : 'mr-auto justify-start'}`}>
                                        <div className={`p-4 rounded-2xl relative group ${
                                            isUser 
                                            ? 'bg-blue-600 text-white rounded-br-none' 
                                            : 'bg-gray-700 text-gray-100 rounded-bl-none shadow-sm'
                                        }`}>
                                            <div className="text-sm prose prose-invert max-w-none">
                                                {msg.content}
                                            </div>
                                            
                                            {!isUser && (
                                                <div className="pt-3 mt-3 border-t border-gray-600/50 flex">
                                                    <button 
                                                        onClick={() => handleUpvote(msg.id)}
                                                        disabled={msg.upvoted}
                                                        className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                                                            msg.upvoted 
                                                            ? 'text-yellow-400 bg-yellow-400/10 cursor-default' 
                                                            : 'text-gray-300 bg-gray-600 hover:bg-blue-600 hover:text-white'
                                                        }`}
                                                    >
                                                        <Star className={`w-4 h-4 ${msg.upvoted ? 'fill-current' : ''}`} />
                                                        {msg.upvoted ? 'Added to Memory' : 'Add to Memory'}
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
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
                        <MessageSquare className="w-12 h-12 mb-4 opacity-20" />
                        <p>Select a session to view the transcript</p>
                    </div>
                )}
            </div>
            
            <button 
                onClick={() => navigate('/')} 
                className="absolute bottom-6 right-6 p-3 bg-blue-600 hover:bg-blue-700 rounded-full shadow-lg text-white transition-transform hover:scale-105"
                title="Go to Chat"
            >
                <ArrowLeft className="w-6 h-6" />
            </button>
        </div>
    );
};

export default AdminDashboard;
