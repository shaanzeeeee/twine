import React, { useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Crown } from 'lucide-react';

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const { login } = useContext(AuthContext);
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await login(email, password);
            navigate('/admin');
        } catch (err) {
            setError('ACCESS DENIED: Invalid credentials');
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-[#0a0a0a] relative overflow-hidden">
            {/* Background Texture/Overlay */}
            <div className="absolute inset-0 opacity-10 bg-[url('/gym-bg.png')] bg-cover bg-center grayscale" />
            
            <div className="relative z-10 w-full max-w-md p-10 space-y-8 bg-zinc-900/80 backdrop-blur-xl border border-white/5 shadow-2xl skew-x-[-1deg]">
                <div className="flex flex-col items-center">
                    <div className="w-16 h-16 bg-red-600 flex items-center justify-center rotate-45 mb-4 shadow-[0_0_30px_rgba(227,30,36,0.5)]">
                        <Crown className="w-10 h-10 text-white -rotate-45" />
                    </div>
                    <h2 className="text-3xl font-black tracking-tighter text-white uppercase italic">
                        Kingsbox <span className="text-red-600">Elite</span>
                    </h2>
                    <p className="text-[10px] uppercase tracking-widest text-gray-400 font-bold mt-2">Executive Command Center</p>
                </div>
                
                {error && (
                    <div className="p-4 text-xs font-bold text-red-500 bg-red-500/10 border-l-4 border-red-600 uppercase tracking-wider">
                        {error}
                    </div>
                )}
                
                <form className="space-y-6" onSubmit={handleSubmit}>
                    <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Identifier</label>
                        <input
                            type="email"
                            placeholder="admin@kingsbox.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full px-5 py-4 text-white bg-black/40 border border-white/10 focus:border-red-600 outline-none transition-all placeholder-zinc-700 font-medium"
                            required
                        />
                    </div>
                    
                    <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Security Key</label>
                        <input
                            type="password"
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-5 py-4 text-white bg-black/40 border border-white/10 focus:border-red-600 outline-none transition-all placeholder-zinc-700 font-medium"
                            required
                        />
                    </div>
                    
                    <button
                        type="submit"
                        className="w-full px-5 py-4 font-black text-white bg-red-600 hover:bg-red-700 transition-all uppercase tracking-tighter italic border-b-4 border-red-900 active:border-b-0 active:translate-y-1"
                    >
                        Initialize Session
                    </button>
                </form>
                
                <div className="flex items-center justify-center space-x-2 text-zinc-600">
                    <ShieldCheck size={14} />
                    <span className="text-[10px] uppercase font-bold tracking-widest">Secure Internal Access Only</span>
                </div>
            </div>
        </div>
    );
};

export default Login;
