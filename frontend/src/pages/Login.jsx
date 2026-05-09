import React, { useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Sparkles, MessageSquare, Zap } from 'lucide-react';

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
            setError(err?.response?.data?.detail || 'Invalid credentials. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDemoLogin = async () => {
        setIsSubmitting(true);
        setError('');
        try {
            await login('demo@twine.app', 'demo123');
            navigate('/admin');
        } catch (err) {
            setError('Demo account unavailable. Please contact the admin.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen p-4 sm:p-0 bg-[#09090F] relative overflow-hidden">
            <div
                className="absolute inset-0 pointer-events-none"
                style={{
                    background: 'radial-gradient(ellipse at 30% 20%, rgba(59,130,246,0.1) 0%, transparent 50%), radial-gradient(ellipse at 70% 80%, rgba(139,92,246,0.08) 0%, transparent 50%)',
                }}
            />
            <div className="relative z-10 w-full max-w-full sm:max-w-lg p-6 sm:p-10 space-y-8 bg-[#111119]/80 backdrop-blur-xl border border-white/[0.07] shadow-2xl rounded-2xl">
                <div className="flex flex-col items-center gap-3 text-center">
                    <div className="w-16 h-16 bg-slate-900 flex items-center justify-center rounded-2xl border border-sky-500/20 shadow-[0_0_40px_rgba(56,189,248,0.05)]">
                        <img src="/logo.png" alt="Twine Logo" className="w-10 h-10 object-contain" />
                    </div>
                    <div>
                        <h2 className="text-3xl font-black tracking-tight text-white">Twine</h2>
                        <p className="text-[10px] uppercase tracking-[0.25em] text-slate-500 font-black mt-2">Admin Portal</p>
                    </div>
                </div>

                {error && (
                    <div className="rounded-xl border border-red-600/30 bg-red-600/10 px-4 py-3 text-sm font-semibold text-red-200">
                        {error}
                    </div>
                )}

                <form className="space-y-6" onSubmit={handleSubmit}>
                    <div className="space-y-3">
                        <label className="block text-[10px] font-semibold uppercase tracking-[0.25em] text-zinc-400">Email</label>
                        <input
                            type="email"
                            placeholder="admin@twine.app"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full rounded-xl border border-white/[0.07] bg-white/[0.03] px-5 py-4 text-white placeholder:text-zinc-600 focus:border-blue-500/60 focus:outline-none transition-all"
                            required
                        />
                    </div>
                    <div className="space-y-3">
                        <label className="block text-[10px] font-semibold uppercase tracking-[0.25em] text-zinc-400">Password</label>
                        <input
                            type="password"
                            placeholder="• • • • • • • •"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full rounded-xl border border-white/[0.07] bg-white/[0.03] px-5 py-4 text-white placeholder:text-zinc-600 focus:border-blue-500/60 focus:outline-none transition-all"
                            required
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full rounded-xl bg-sky-500 px-5 py-4 text-[11px] font-black uppercase tracking-[0.25em] text-white transition-all hover:bg-sky-600 active:translate-y-0.5 disabled:opacity-60 disabled:cursor-not-allowed shadow-lg shadow-sky-500/10"
                    >
                        {isSubmitting ? 'Verifying...' : 'Authenticate'}
                    </button>
                </form>

                <div className="flex flex-col gap-3">
                    <button
                        type="button"
                        onClick={handleDemoLogin}
                        disabled={isSubmitting}
                        className="w-full rounded-xl border border-sky-500/20 bg-sky-500/5 px-5 py-4 text-[11px] font-black uppercase tracking-[0.25em] text-sky-400 transition-all hover:bg-sky-500/10 hover:border-sky-500/40 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                        <span className="inline-flex items-center justify-center gap-2">
                            <Zap size={12} />
                            Recruiter Demo Access
                        </span>
                    </button>
                    <button
                        type="button"
                        onClick={() => navigate('/')}
                        className="w-full rounded-xl border border-white/[0.07] bg-white/[0.03] px-5 py-4 text-[11px] font-bold uppercase tracking-[0.25em] text-white transition-all hover:border-blue-500/50"
                    >
                        <span className="inline-flex items-center justify-center gap-2">
                            <MessageSquare size={14} />
                            Chat as Guest
                        </span>
                    </button>
                </div>

                <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-4 text-[11px] text-zinc-300 flex items-center gap-2">
                    <ShieldCheck size={16} className="text-blue-400" />
                    <span className="uppercase tracking-[0.25em] font-semibold">Secure access</span>
                </div>
            </div>
        </div>
    );
};

export default Login;
