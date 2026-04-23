import React, { useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Crown, MessageSquare } from 'lucide-react';

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { login } = useContext(AuthContext);
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError('');
        try {
            await login(email, password);
            navigate('/admin');
        } catch (err) {
            setError(err?.response?.data?.detail || 'ACCESS DENIED: Invalid credentials');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen p-4 sm:p-0 bg-[#0a0a0a] relative overflow-hidden">
            <div className="absolute inset-0 opacity-20 pointer-events-none bg-[url('/gym-bg.png')] bg-cover bg-center grayscale" />
            <div className="relative z-10 w-full max-w-full sm:max-w-lg p-6 sm:p-10 space-y-8 bg-black/70 backdrop-blur-xl border border-white/10 shadow-2xl rounded-[32px]">
                <div className="flex flex-col items-center gap-3 text-center">
                    <div className="w-16 h-16 bg-red-600 flex items-center justify-center rounded-3xl shadow-[0_0_30px_rgba(227,30,36,0.35)]">
                        <Crown className="w-10 h-10 text-white" />
                    </div>
                    <div>
                        <h2 className="text-3xl font-black tracking-tight text-white uppercase">Kingsbox Elite</h2>
                        <p className="text-[10px] uppercase tracking-[0.35em] text-zinc-400 font-bold mt-2">Admin Login Portal</p>
                    </div>
                </div>

                {error && (
                    <div className="rounded-3xl border border-red-600/30 bg-red-600/10 px-4 py-3 text-sm font-black text-red-200 uppercase tracking-[0.2em]">
                        {error}
                    </div>
                )}

                <form className="space-y-6" onSubmit={handleSubmit}>
                    <div className="space-y-3">
                        <label className="block text-[10px] font-black uppercase tracking-[0.35em] text-zinc-400">Email</label>
                        <input
                            type="email"
                            placeholder="admin@lukabot.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full rounded-3xl border border-white/10 bg-zinc-950/70 px-5 py-4 text-white placeholder:text-zinc-600 focus:border-red-600 focus:outline-none transition-all"
                            required
                        />
                    </div>
                    <div className="space-y-3">
                        <label className="block text-[10px] font-black uppercase tracking-[0.35em] text-zinc-400">Password</label>
                        <input
                            type="password"
                            placeholder="• • • • • • • •"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full rounded-3xl border border-white/10 bg-zinc-950/70 px-5 py-4 text-white placeholder:text-zinc-600 focus:border-red-600 focus:outline-none transition-all"
                            required
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full rounded-3xl bg-red-600 px-5 py-4 text-[11px] font-black uppercase tracking-[0.35em] text-white transition-all hover:bg-red-700 active:translate-y-0.5 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                        {isSubmitting ? 'Accessing...' : 'Access Dashboard'}
                    </button>
                    <button
                        type="button"
                        onClick={() => navigate('/')}
                        className="w-full rounded-3xl border border-white/10 bg-zinc-950/70 px-5 py-4 text-[11px] font-black uppercase tracking-[0.35em] text-white transition-all hover:border-red-600"
                    >
                        <span className="inline-flex items-center justify-center gap-2">
                            <MessageSquare size={14} />
                            Chat as Guest
                        </span>
                    </button>
                </form>

                <div className="rounded-3xl border border-white/10 bg-white/5 p-4 text-[11px] text-zinc-300 flex items-center gap-2">
                    <ShieldCheck size={16} className="text-red-500" />
                    <span className="uppercase tracking-[0.35em] font-black">Secure internal access only</span>
                </div>

                <div className="rounded-3xl border border-white/10 bg-zinc-950/80 p-4 text-[11px] text-zinc-400">
                    <p className="font-bold text-zinc-200 uppercase tracking-[0.35em] mb-2">Pro tip</p>
                    <p className="leading-relaxed">Use the credentials created by the admin setup script. If you lose access, re-run <span className="text-white">backend/setup_admin.py</span> with new credentials.</p>
                </div>
            </div>
        </div>
    );
};

export default Login;
