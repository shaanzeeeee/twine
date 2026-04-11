import React, { useState, useEffect, useRef } from 'react';
import { Send, Crown, Info, Settings, User } from 'lucide-react';
import api from '../services/api';

const ChatUI = () => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage = { role: 'user', content: input };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    try {
      const response = await api.post('/chat/', {
        message: input,
        history: messages
      });

      setMessages([...newMessages, { role: 'assistant', content: response.data.response }]);
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages([...newMessages, { role: 'assistant', content: 'An error occurred. Please try again.' }]);
    } finally {
      setIsLoading(false);
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
        <div className="flex space-x-4 text-gray-400">
          <Info size={20} className="hover:text-red-600 cursor-pointer transition" />
          <Settings size={20} className="hover:text-red-600 cursor-pointer transition" />
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
              <h2 className="text-2xl font-bold text-white">Welcome back, Luka</h2>
              <p className="text-gray-400 max-w-xs">Your internal knowledge base is synced and ready. How can we optimize operations today?</p>
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
              <p className={`whitespace-pre-wrap ${msg.role === 'user' ? 'skew-x-[2deg]' : 'skew-x-[-2deg]'}`}>
                {msg.content}
              </p>
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
          <input
            type="text"
            className="w-full bg-[#151515] border border-white/10 rounded-sm pl-6 pr-16 py-4 text-white focus:outline-none focus:border-red-600 transition-all duration-300 placeholder-gray-600 font-medium"
            placeholder="Search knowledge base..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
          />
          <button 
            onClick={handleSend}
            disabled={isLoading}
            className="absolute right-2 top-2 bottom-2 bg-red-600 text-white px-4 rounded-sm hover:bg-red-700 transition-all duration-300 disabled:opacity-50 hover:scale-105 active:scale-95"
          >
            <Send size={18} />
          </button>
        </div>
        <p className="text-center text-[10px] text-gray-500 mt-4 uppercase tracking-[0.2em]">Kingsbox Internal Strategic Intelligence System</p>
      </div>
    </div>
  );
};

export default ChatUI;
