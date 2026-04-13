import React, { useState, useEffect, useRef, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { Send, Crown, User, Copy, Download, RotateCcw, Shield, PenLine } from 'lucide-react';
import api from '../services/api';

const ChatUI = () => {
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [sessionId, setSessionId] = useState(null);
  const [guestName, setGuestName] = useState('');
  const [guestNameDraft, setGuestNameDraft] = useState('');
  const [isGuestReady, setIsGuestReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const messagesEndRef = useRef(null);

  const promptChips = [
    'Summarize today\'s key operational insights.',
    'What are the top bottlenecks in our workflow?',
    'Draft a weekly coaching plan for my team.',
  ];

  const pushToast = (message, type = 'info') => {
    setToast({ message, type });
    window.clearTimeout(window.__lukabot_toast_timer);
    window.__lukabot_toast_timer = window.setTimeout(() => setToast(null), 2500);
  };

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    const storedName = localStorage.getItem('guest_name') || '';
    const normalized = storedName.trim();
    if (normalized) {
      setGuestName(normalized);
      setGuestNameDraft(normalized);
      setIsGuestReady(true);
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || !isGuestReady) return;

    const outgoing = input;
    const userMessage = { role: 'user', content: outgoing, timestamp: new Date().toISOString() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    try {
      const response = await api.post('/chat/', {
        message: outgoing,
        session_id: sessionId,
        guest_name: guestName,
        history: messages.map((msg) => ({ role: msg.role, content: msg.content }))
      });

      setSessionId(response.data.session_id);
      setMessages([
        ...newMessages,
        { role: 'assistant', content: response.data.response, timestamp: new Date().toISOString() },
      ]);
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages([
        ...newMessages,
        { role: 'assistant', content: 'An error occurred. Please try again.', timestamp: new Date().toISOString() },
      ]);
      pushToast('Failed to send message', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleExport = () => {
    const payload = {
      session_id: sessionId,
      exported_at: new Date().toISOString(),
      messages,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `chat-session-${sessionId || 'local'}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    pushToast('Session exported');
  };

  const handleCopy = async (content) => {
    try {
      await navigator.clipboard.writeText(content);
      pushToast('Message copied');
    } catch (error) {
      pushToast('Copy failed', 'error');
    }
  };

  const resetChat = () => {
    setMessages([]);
    setSessionId(null);
    setInput('');
    pushToast('New chat started');
  };

  const beginGuestSession = () => {
    const normalized = guestNameDraft.trim();
    if (!normalized) {
      pushToast('Please enter your name', 'error');
      return;
    }
    const safeName = normalized.slice(0, 100);
    setGuestName(safeName);
    setGuestNameDraft(safeName);
    localStorage.setItem('guest_name', safeName);
    setIsGuestReady(true);
    pushToast(`Welcome, ${safeName}`);
  };

  const editGuestName = () => {
    setIsGuestReady(false);
  };

  const clearMessages = () => {
    setMessages([]);
    pushToast('Messages cleared');
  };

  const onInputKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-screen w-full relative bg-[#0a0a0a] overflow-hidden">
      {/* Background Image with Overlay */}
      <div 
        className="absolute inset-0 z-0 opacity-20"
        style={{ 
          backgroundImage: 'url("/gym-bg.png")', 
          backgroundSize: 'cover', 
          backgroundPosition: 'center',
          filter: 'grayscale(100%) brightness(0.5)'
        }}
      />
      
      {/* Header */}
      <div className="relative z-10 flex items-center justify-between px-6 py-4 bg-black/60 backdrop-blur-md border-b border-white/10">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-red-600 flex items-center justify-center rounded-sm rotate-45 group hover:rotate-0 transition-all duration-300">
            <Crown size={24} className="-rotate-45 group-hover:rotate-0 text-white transition-all duration-300" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tighter text-white uppercase italic">Kingsbox <span className="text-red-600">Elite</span></h1>
            <p className="text-[10px] uppercase tracking-widest text-gray-400 font-bold">Luka's Strategic Assistant</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-gray-400">
          <button
            onClick={editGuestName}
            className="flex items-center gap-2 px-3 py-2 text-[10px] uppercase tracking-widest font-black bg-zinc-900 border border-white/10 hover:border-red-600 hover:text-white transition-all"
          >
            <PenLine size={13} />
            {guestName ? guestName : 'Guest Name'}
          </button>
          <button
            onClick={() => navigate(user?.role === 'Admin' ? '/admin' : '/login')}
            className="flex items-center gap-2 px-3 py-2 text-[10px] uppercase tracking-widest font-black bg-zinc-900 border border-white/10 hover:border-red-600 hover:text-white transition-all"
          >
            <Shield size={14} />
            {user?.role === 'Admin' ? 'Admin Dashboard' : 'Admin Login'}
          </button>
        </div>
      </div>

      <div className="relative z-10 px-6 pt-4">
        <div className="max-w-4xl mx-auto flex flex-wrap gap-2 justify-end">
          <button
            onClick={resetChat}
            className="flex items-center gap-2 px-3 py-2 text-[10px] uppercase tracking-widest font-black text-zinc-200 bg-zinc-900/80 border border-white/10 hover:border-red-600 transition-all"
          >
            <RotateCcw size={13} />
            New Chat
          </button>
          <button
            onClick={clearMessages}
            disabled={messages.length === 0}
            className="flex items-center gap-2 px-3 py-2 text-[10px] uppercase tracking-widest font-black text-zinc-200 bg-zinc-900/80 border border-white/10 hover:border-red-600 transition-all disabled:opacity-40"
          >
            Clear
          </button>
          <button
            onClick={handleExport}
            disabled={messages.length === 0}
            className="flex items-center gap-2 px-3 py-2 text-[10px] uppercase tracking-widest font-black text-zinc-200 bg-zinc-900/80 border border-white/10 hover:border-red-600 transition-all disabled:opacity-40"
          >
            <Download size={13} />
            Export
          </button>
        </div>
      </div>
      
      {/* Chat Messages */}
      <div className="relative z-10 flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center border border-white/10 animate-pulse">
               <User size={40} className="text-red-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Welcome{guestName ? `, ${guestName}` : ''}</h2>
              <p className="text-gray-400 max-w-xs">Your internal knowledge base is synced and ready. How can we optimize operations today?</p>
            </div>
            <div className="flex flex-wrap justify-center gap-2 max-w-xl">
              {promptChips.map((chip) => (
                <button
                  key={chip}
                  onClick={() => setInput(chip)}
                  className="px-3 py-2 text-[10px] uppercase tracking-widest font-black text-zinc-300 bg-zinc-900/80 border border-white/10 hover:border-red-600 hover:text-white transition-all"
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>
        )}
        
        {messages.map((msg, index) => (
          <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`relative max-w-[80%] rounded-sm px-5 py-3 shadow-2xl transition-all duration-300 ${
              msg.role === 'user' 
                ? 'bg-red-600 text-white font-medium border-l-4 border-white/30 skew-x-[-2deg]' 
                : 'bg-[#1a1a1a]/90 text-gray-100 border border-white/10 backdrop-blur-sm skew-x-[2deg]'
            }`}>
              <div className={`mb-2 text-[10px] uppercase tracking-widest font-black flex items-center justify-between gap-4 ${msg.role === 'user' ? 'text-red-100' : 'text-zinc-400'} ${msg.role === 'user' ? 'skew-x-[2deg]' : 'skew-x-[-2deg]'}`}>
                <span>{msg.role === 'user' ? 'You' : 'Assistant'}</span>
                <span>{formatTime(msg.timestamp || new Date().toISOString())}</span>
              </div>
              <p className={`whitespace-pre-wrap ${msg.role === 'user' ? 'skew-x-[2deg]' : 'skew-x-[-2deg]'}`}>
                {msg.content}
              </p>
              {msg.role === 'assistant' && (
                <div className="mt-3 pt-3 border-t border-white/10 flex justify-end">
                  <button
                    onClick={() => handleCopy(msg.content)}
                    className="flex items-center gap-2 px-2 py-1 text-[10px] uppercase tracking-widest font-black text-zinc-300 hover:text-white bg-black/30 hover:bg-black/50 transition-all skew-x-[-2deg]"
                    title="Copy response"
                  >
                    <Copy size={12} />
                    Copy
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
        
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-[#1a1a1a]/90 rounded-sm p-4 border border-white/10 skew-x-[2deg]">
              <div className="flex space-x-2">
                <div className="w-2 h-2 bg-red-600 animate-bounce"></div>
                <div className="w-2 h-2 bg-red-600 animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                <div className="w-2 h-2 bg-red-600 animate-bounce" style={{ animationDelay: '0.4s' }}></div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="relative z-10 p-6 bg-gradient-to-t from-black to-transparent">
        <div className="max-w-4xl mx-auto relative group">
          <textarea
            rows={2}
            className="w-full resize-none bg-[#151515] border border-white/10 rounded-sm pl-6 pr-16 py-4 text-white focus:outline-none focus:border-red-600 transition-all duration-300 placeholder-gray-600 font-medium"
            placeholder={isGuestReady ? `Ask anything, ${guestName || 'guest'}...` : 'Enter your name to start chatting'}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onInputKeyDown}
            disabled={!isGuestReady}
          />
          <button 
            onClick={handleSend}
            disabled={isLoading || !isGuestReady}
            className="absolute right-2 top-2 bottom-2 bg-red-600 text-white px-4 rounded-sm hover:bg-red-700 transition-all duration-300 disabled:opacity-50 hover:scale-105 active:scale-95"
          >
            <Send size={18} />
          </button>
        </div>
        <p className="text-center text-[10px] text-gray-500 mt-4 uppercase tracking-[0.2em]">Kingsbox Internal Strategic Intelligence System</p>
      </div>

      {toast && (
        <div className={`absolute bottom-6 left-1/2 -translate-x-1/2 z-30 px-4 py-2 text-[10px] uppercase tracking-widest font-black border ${toast.type === 'error' ? 'bg-red-950/90 text-red-200 border-red-700' : 'bg-zinc-900/90 text-zinc-100 border-white/10'}`}>
          {toast.message}
        </div>
      )}

      {!isGuestReady && (
        <div className="absolute inset-0 z-40 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-zinc-900/95 border border-white/10 p-8 shadow-2xl">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-red-600 flex items-center justify-center rotate-45">
                <User className="w-5 h-5 text-white -rotate-45" />
              </div>
              <div>
                <h3 className="text-lg font-black uppercase tracking-wide text-white">Guest Mode</h3>
                <p className="text-[10px] uppercase tracking-widest text-zinc-400 font-bold">Enter your name to begin</p>
              </div>
            </div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2">Your name</label>
            <input
              type="text"
              value={guestNameDraft}
              onChange={(e) => setGuestNameDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && beginGuestSession()}
              placeholder="Type your name"
              className="w-full px-4 py-3 bg-black/40 border border-white/10 text-white outline-none focus:border-red-600"
              maxLength={100}
              autoFocus
            />
            <button
              onClick={beginGuestSession}
              className="mt-4 w-full px-4 py-3 text-[11px] uppercase tracking-widest font-black text-white bg-red-600 hover:bg-red-700 transition-all"
            >
              Start Guest Session
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatUI;
