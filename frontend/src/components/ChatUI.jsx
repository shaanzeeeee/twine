import React, { useState, useEffect, useRef, useMemo, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { Send, Sparkles, User, Copy, Download, RotateCcw, Shield, PenLine, Loader2 } from 'lucide-react';
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
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [toast, setToast] = useState(null);
  const [sessionHistory, setSessionHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const messagesEndRef = useRef(null);

  const promptChips = [
    'What\'s your perspective on this?',
    'Help me think through a challenge.',
    'What would you prioritize here?',
  ];

  const pushToast = (message, type = 'info') => {
    setToast({ message, type });
    window.clearTimeout(window.__twine_toast_timer);
    window.__twine_toast_timer = window.setTimeout(() => setToast(null), 2500);
  };

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadSessionHistory = () => {
    try {
      const raw = localStorage.getItem('chat_session_history');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  };

  useEffect(() => {
    if (user?.role === 'Admin') {
      setGuestName('Admin');
      setGuestNameDraft('Admin');
      setIsGuestReady(true);
      setSessionHistory(loadSessionHistory());
      return;
    }

    const storedName = localStorage.getItem('guest_name') || '';
    const normalized = storedName.trim();
    if (normalized) {
      setGuestName(normalized);
      setGuestNameDraft(normalized);
      setIsGuestReady(true);
    } else {
      setIsGuestReady(false);
    }
    setSessionHistory(loadSessionHistory());
  }, [user]);

  const persistSessionHistory = (history) => {
    localStorage.setItem('chat_session_history', JSON.stringify(history));
    setSessionHistory(history);
  };

  const saveCurrentSession = (currentMessages, currentSessionId) => {
    if (!currentMessages.length) return;

    const id = currentSessionId || `local-${Date.now()}`;
    const createdAt = currentMessages[0]?.timestamp || new Date().toISOString();
    const entry = {
      sessionId: id,
      guestName,
      createdAt,
      messageCount: currentMessages.length,
      messages: currentMessages,
    };

    setSessionHistory((currentHistory) => {
      const nextHistory = [entry, ...currentHistory.filter((record) => record.sessionId !== id)];
      const trimmed = nextHistory.slice(0, 12);
      localStorage.setItem('chat_session_history', JSON.stringify(trimmed));
      return trimmed;
    });

    if (!currentSessionId) {
      setSessionId(id);
    }
  };

  useEffect(() => {
    if (!messages.length) return;
    const saveTimer = window.setTimeout(() => saveCurrentSession(messages, sessionId), 400);
    return () => window.clearTimeout(saveTimer);
  }, [messages, sessionId, guestName]);

  const groupedMessages = useMemo(() => {
    return messages.reduce((acc, msg) => {
      const lastGroup = acc[acc.length - 1];
      if (lastGroup && lastGroup.role === msg.role) {
        lastGroup.contents.push(msg.content);
        lastGroup.timestamp = msg.timestamp;
      } else {
        acc.push({ role: msg.role, contents: [msg.content], timestamp: msg.timestamp });
      }
      return acc;
    }, []);
  }, [messages]);

  const canRegenerate = useMemo(() => {
    return messages.some((msg) => msg.role === 'user');
  }, [messages]);

  const handleSend = async () => {
    const trimmedInput = input.trim();
    if (!trimmedInput || !isGuestReady || isLoading) return;

    const userMessage = { role: 'user', content: trimmedInput, timestamp: new Date().toISOString() };
    const pendingMessages = [...messages, userMessage];
    setMessages(pendingMessages);
    setInput('');
    setIsLoading(true);

    try {
      const response = await api.post('/chat/', {
        message: trimmedInput,
        session_id: sessionId,
        guest_name: guestName,
        history: messages.map((msg) => ({ role: msg.role, content: msg.content })),
      });

      setSessionId(response.data.session_id);
      setMessages([
        ...pendingMessages,
        { role: 'assistant', content: response.data.response, timestamp: new Date().toISOString() },
      ]);
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages([
        ...pendingMessages,
        { role: 'assistant', content: 'An error occurred. Please try again.', timestamp: new Date().toISOString() },
      ]);
      pushToast('Failed to send message', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegenerate = async () => {
    if (!canRegenerate || isLoading) {
      return;
    }

    const trimmedMessages = [...messages];
    if (trimmedMessages[trimmedMessages.length - 1]?.role === 'assistant') {
      trimmedMessages.pop();
    }

    const lastUserMessage = [...trimmedMessages].reverse().find((msg) => msg.role === 'user');
    if (!lastUserMessage) {
      pushToast('No previous user prompt to regenerate', 'error');
      return;
    }

    setIsRegenerating(true);
    setIsLoading(true);

    try {
      const response = await api.post('/chat/', {
        message: lastUserMessage.content,
        session_id: sessionId,
        guest_name: guestName,
        history: trimmedMessages.map((msg) => ({ role: msg.role, content: msg.content })),
      });

      setSessionId(response.data.session_id);
      setMessages([
        ...trimmedMessages,
        lastUserMessage,
        { role: 'assistant', content: response.data.response, timestamp: new Date().toISOString() },
      ]);
      pushToast('Response regenerated');
    } catch (error) {
      console.error('Error regenerating response:', error);
      pushToast('Failed to regenerate response', 'error');
    } finally {
      setIsRegenerating(false);
      setIsLoading(false);
    }
  };

  const handleCopyTranscript = async () => {
    if (!messages.length) return;

    const transcript = messages
      .map((msg) => `${msg.role === 'user' ? 'You' : 'Assistant'}: ${msg.content}`)
      .join('\n\n');

    try {
      await navigator.clipboard.writeText(transcript);
      pushToast('Transcript copied');
    } catch (error) {
      pushToast('Copy failed', 'error');
    }
  };

  const handleExport = () => {
    const payload = {
      session_id: sessionId,
      guest_name: guestName,
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

  const resetChat = () => {
    setMessages([]);
    setSessionId(null);
    setInput('');
    pushToast('New chat started');
  };

  const handleResumeHistory = (session) => {
    setMessages(session.messages);
    setSessionId(session.sessionId);
    setGuestName(session.guestName || guestName);
    setGuestNameDraft(session.guestName || guestName);
    setIsGuestReady(true);
    setShowHistory(false);
    pushToast('Resumed previous conversation');
  };

  const deleteHistorySession = (sessionIdToRemove) => {
    const nextHistory = sessionHistory.filter((entry) => entry.sessionId !== sessionIdToRemove);
    persistSessionHistory(nextHistory);
    pushToast('Session removed from history');
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

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  return (
    <div className="flex flex-col h-screen w-full relative bg-[#09090F] overflow-hidden">
      <div
        className="absolute inset-0 z-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at 20% 0%, rgba(59,130,246,0.08) 0%, transparent 50%), radial-gradient(ellipse at 80% 100%, rgba(139,92,246,0.06) 0%, transparent 50%)',
        }}
      />

      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between px-4 py-3 sm:px-6 sm:py-4 gap-4 md:gap-0 twine-glass-strong border-b border-white/[0.06]">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 md:w-12 md:h-12 flex-shrink-0 bg-slate-900 border border-sky-500/20 flex items-center justify-center md:rounded-2xl rounded-xl shadow-lg shadow-sky-500/5">
            <img src="/logo.png" alt="Logo" className="w-6 h-6 object-contain" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg md:text-2xl font-black tracking-tight text-white truncate">Twine</h1>
            <p className="text-[9px] md:text-xs tracking-[0.25em] text-slate-500 font-black uppercase truncate">Persona Intelligence</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          {user?.role !== 'Admin' && (
            <button
              onClick={editGuestName}
              className="flex items-center gap-2 px-3 py-2 text-[10px] uppercase tracking-widest font-bold bg-white/[0.04] border border-white/[0.07] rounded-xl hover:border-blue-500/50 hover:text-white transition-all"
            >
              <PenLine size={12} />
              {guestName ? guestName : 'Guest Name'}
            </button>
          )}
          <button
            onClick={() => navigate(user?.role === 'Admin' ? '/admin' : '/login')}
            className="flex items-center gap-2 px-3 py-2 text-[10px] uppercase tracking-widest font-bold bg-white/[0.04] border border-white/[0.07] rounded-xl hover:border-blue-500/50 hover:text-white transition-all"
          >
            <Shield size={14} />
            {user?.role === 'Admin' ? 'Admin Dashboard' : 'Admin Login'}
          </button>
        </div>
      </div>

      <div className="relative z-10 px-4 sm:px-6 pt-4">
        <div className="max-w-6xl mx-auto flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-2">
            <div className="text-[10px] uppercase tracking-[0.35em] text-zinc-500 font-black">Session overview</div>
            <div className="flex flex-wrap gap-3 text-[11px] text-zinc-300">
              <span>{sessionId ? `Session • ${sessionId}` : 'New Session'}</span>
              <span>{messages.length} messages</span>
              <span>{guestName ? `Guest • ${guestName}` : 'Guest • anonymous'}</span>
              {messages[0]?.timestamp && <span>{new Date(messages[0].timestamp).toLocaleDateString()}</span>}
            </div>
          </div>
          <div className="flex flex-wrap gap-2 justify-end">
            <button
              onClick={resetChat}
              className="flex items-center gap-2 px-4 py-2 text-[10px] uppercase tracking-widest font-black text-white bg-sky-500 border border-sky-400/20 rounded-xl hover:bg-sky-600 transition-all shadow-lg shadow-sky-500/10"
            >
              <RotateCcw size={12} />
              New Chat
            </button>
            <button
              onClick={handleCopyTranscript}
              disabled={messages.length === 0}
              className="flex items-center gap-2 px-4 py-2 text-[10px] uppercase tracking-widest font-bold text-white bg-white/[0.04] border border-white/[0.07] rounded-xl hover:border-blue-500/50 transition-all disabled:opacity-40"
            >
              <Copy size={14} />
              Copy Transcript
            </button>
            <button
              onClick={handleExport}
              disabled={messages.length === 0}
              className="flex items-center gap-2 px-4 py-2 text-[10px] uppercase tracking-widest font-bold text-white bg-white/[0.04] border border-white/[0.07] rounded-xl hover:border-blue-500/50 transition-all disabled:opacity-40"
            >
              <Download size={14} />
              Export
            </button>
            <button
              onClick={handleRegenerate}
              disabled={!canRegenerate || isLoading}
              className="flex items-center gap-2 px-4 py-2 text-[10px] uppercase tracking-widest font-bold text-white bg-white/[0.04] border border-white/[0.07] rounded-xl hover:border-blue-500/50 transition-all disabled:opacity-40"
            >
              <RotateCcw size={14} />
              Regenerate
            </button>
          </div>
        </div>
      </div>

      <div className="hidden sm:block relative z-10 px-4 sm:px-6 mt-4 max-w-6xl mx-auto w-full">
        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] backdrop-blur-sm p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-[0.25em] text-zinc-400 font-semibold">Quick prompts</div>
            <p className="mt-1 text-[11px] text-zinc-500">Tap a suggestion to get started.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {promptChips.map((chip) => (
              <button
                key={chip}
                onClick={() => setInput(chip)}
                className="px-3 py-2 text-[10px] uppercase tracking-widest font-medium text-zinc-300 bg-white/[0.04] border border-white/[0.07] rounded-full hover:border-blue-500/50 hover:text-white transition-all"
              >
                {chip}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="hidden sm:block relative z-10 px-4 sm:px-6 mt-4 max-w-6xl mx-auto w-full">
        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] backdrop-blur-sm p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-[0.25em] text-zinc-400 font-semibold">Session history</div>
            <p className="mt-1 text-[11px] text-zinc-500">Resume recent conversations with one click.</p>
          </div>
          <button
            onClick={() => setShowHistory((prev) => !prev)}
            className="px-4 py-2 text-[10px] uppercase tracking-widest font-semibold text-white bg-white/[0.04] border border-white/[0.07] rounded-xl hover:border-blue-500/50 transition-all"
          >
            {showHistory ? 'Hide history' : 'Show history'}
          </button>
        </div>
        {showHistory && (
          <div className="mt-3 space-y-3">
            {sessionHistory.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-white/10 bg-zinc-950/80 p-5 text-center text-[11px] text-zinc-500">
                No saved conversations yet.
              </div>
            ) : (
              sessionHistory.map((session) => (
                <div key={session.sessionId} className="rounded-3xl border border-white/10 bg-zinc-950/80 p-4 grid gap-3 md:grid-cols-[1fr_auto] items-center">
                  <div>
                    <div className="flex flex-wrap gap-2 items-center text-[10px] uppercase tracking-[0.35em] text-zinc-400 font-black">
                      <span>{session.guestName || 'Guest'}</span>
                      <span>{session.sessionId}</span>
                      <span>{session.messageCount} messages</span>
                    </div>
                    <p className="mt-2 text-[11px] text-zinc-300">Started {new Date(session.createdAt).toLocaleString()}</p>
                  </div>
                  <div className="flex flex-wrap gap-2 justify-end">
                    <button
                      onClick={() => handleResumeHistory(session)}
                      className="px-3 py-2 text-[10px] uppercase tracking-widest font-semibold text-white bg-gradient-to-r from-blue-500 to-violet-600 border border-blue-500/30 rounded-xl hover:from-blue-600 hover:to-violet-700 transition-all"
                    >
                      Resume
                    </button>
                    <button
                      onClick={() => deleteHistorySession(session.sessionId)}
                      className="px-3 py-2 text-[10px] uppercase tracking-widest font-semibold text-zinc-200 bg-white/[0.04] border border-white/[0.07] rounded-xl hover:border-red-500/50 transition-all"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      <div className="relative z-10 flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 scrollbar-hide">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-24 h-24 bg-slate-900 rounded-3xl flex items-center justify-center border border-sky-500/10 shadow-2xl">
              <img src="/logo.png" alt="Logo" className="w-12 h-12 object-contain opacity-50" />
            </div>
            <div>
              <h2 className="text-3xl font-bold text-white">Welcome{guestName ? `, ${guestName}` : ''}</h2>
              <p className="text-gray-400 max-w-lg mx-auto">Your persona is ready. Ask a question or choose a prompt to get started.</p>
            </div>
          </div>
        )}

        {groupedMessages.map((group, index) => (
          <div key={index} className={`flex ${group.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`relative max-w-[92%] sm:max-w-[80%] rounded-2xl px-4 py-3 sm:px-6 sm:py-5 shadow-lg transition-all duration-300 twine-fade-in ${
              group.role === 'user'
                ? 'bg-sky-500/90 text-white border border-sky-400/20'
                : 'bg-slate-900/80 text-slate-100 border border-white/[0.05] backdrop-blur-sm'
            }`}>
              <div className={`mb-3 flex items-center justify-between gap-4 text-[10px] uppercase tracking-[0.35em] font-black ${group.role === 'user' ? 'text-red-100' : 'text-zinc-400'}`}>
                <span>{group.role === 'user' ? 'You' : 'Assistant'}</span>
                <span>{formatTime(group.timestamp)}</span>
              </div>
              <div className="space-y-4 text-sm leading-relaxed whitespace-pre-wrap">
                {group.contents.map((content, contentIndex) => (
                  <p key={contentIndex}>{content}</p>
                ))}
              </div>
              {group.role === 'assistant' && (
                <div className="mt-4 pt-4 border-t border-white/10 flex justify-end">
                  <button
                    onClick={() => handleCopy(group.contents.join('\n\n'))}
                    className="flex items-center gap-2 px-3 py-1 text-[10px] uppercase tracking-widest font-black text-zinc-300 bg-black/30 rounded-full hover:text-white hover:bg-black/50 transition-all"
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

        {(isLoading || isRegenerating) && (
          <div className="flex justify-start">
            <div className="bg-white/[0.04] rounded-2xl p-3 sm:p-4 border border-white/[0.07] backdrop-blur-sm twine-fade-in">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.25em] text-zinc-400 font-medium mb-3">Thinking</div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-500 animate-bounce"></span>
                <span className="w-2 h-2 rounded-full bg-violet-500 animate-bounce" style={{ animationDelay: '0.15s' }}></span>
                <span className="w-2 h-2 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '0.3s' }}></span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="sticky bottom-0 z-10 bg-gradient-to-t from-black to-transparent px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-2 sm:px-6 sm:pb-6 sm:pt-4">
        <div className="max-w-6xl mx-auto relative flex items-center">
          <textarea
            rows={2}
            className="w-full resize-none bg-white/[0.03] border border-white/[0.07] rounded-2xl pl-4 pr-14 sm:pl-6 sm:pr-28 py-3 sm:py-4 min-h-[52px] text-base leading-6 text-white focus:outline-none focus:border-blue-500/60 transition-all duration-300 placeholder-zinc-600 font-medium"
            placeholder={isGuestReady ? `Ask anything, ${guestName || 'guest'}...` : 'Enter your name to start chatting'}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onInputKeyDown}
            disabled={!isGuestReady}
            aria-label="Chat input"
          />
          <button
            onClick={handleSend}
            disabled={isLoading || !isGuestReady || !input.trim()}
            className="absolute right-2 top-2 bottom-2 sm:right-3 sm:top-3 sm:bottom-3 inline-flex items-center justify-center rounded-xl bg-sky-500 w-10 sm:w-auto sm:px-5 text-white hover:bg-sky-600 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-sky-500/20"
          >
            <Send size={16} />
          </button>
        </div>
        <div className="max-w-6xl mx-auto mt-3 text-[9px] sm:text-[10px] text-zinc-500 uppercase tracking-widest sm:tracking-[0.35em] flex flex-wrap gap-x-2 gap-y-1 items-center justify-center sm:justify-start">
          <span>Shift+Enter for newline</span>
          <span>·</span>
          <span>Enter to send</span>
          <span>·</span>
          <span>Resume previous sessions from history</span>
        </div>
      </div>

      {toast && (
        <div className={`absolute bottom-6 left-1/2 -translate-x-1/2 z-30 px-5 py-3 rounded-xl text-[10px] uppercase tracking-widest font-semibold border ${toast.type === 'error' ? 'bg-red-950/90 text-red-200 border-red-700/50' : 'bg-white/[0.06] text-zinc-100 border-white/[0.07] backdrop-blur-md'}`}>
          {toast.message}
        </div>
      )}

      {!isGuestReady && (
        <div className="absolute inset-0 z-40 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-[#111119]/95 border border-white/[0.07] p-8 shadow-2xl rounded-2xl backdrop-blur-xl">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-slate-900 flex items-center justify-center rounded-2xl border border-sky-500/20 shadow-lg shadow-sky-500/5">
                <User className="w-6 h-6 text-sky-400" />
              </div>
              <div>
                <h3 className="text-xl font-extrabold tracking-tight text-white">Welcome to Twine</h3>
                <p className="text-[10px] uppercase tracking-[0.25em] text-zinc-400 font-medium">Enter your name to begin</p>
              </div>
            </div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2">Your name</label>
            <input
              type="text"
              value={guestNameDraft}
              onChange={(e) => setGuestNameDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && beginGuestSession()}
              placeholder="Type your name"
              className="w-full px-4 py-3 mb-4 bg-white/[0.03] border border-white/[0.07] rounded-xl text-base text-white outline-none focus:border-blue-500/60 transition-all duration-300"
              maxLength={100}
              autoFocus
            />
            <button
              onClick={beginGuestSession}
              className="w-full px-4 py-3 text-[11px] uppercase tracking-widest font-black text-white bg-sky-500 rounded-xl hover:bg-sky-600 transition-all duration-300 shadow-lg shadow-sky-500/10"
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
