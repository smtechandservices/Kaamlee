"use client";
import { useState } from "react";
import { fetchWithAuth } from "@/lib/api";
import { Send, ArrowLeft, Building2, CheckCircle2 } from "lucide-react";
import Link from "next/link";

export default function ContactHR() {
    const [message, setMessage] = useState("");
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState("");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!message.trim()) return;

        setLoading(true);
        setError("");
        setSuccess(false);

        try {
            const res = await fetchWithAuth("/auth/contact-hr/", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Failed to contact HR.");
            }

            setSuccess(true);
            setMessage("");
        } catch (err: any) {
            setError(err.message || "An error occurred.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#0a0a0a] text-white font-sans relative overflow-x-hidden flex flex-col items-center">
            <nav className="fixed top-0 w-full bg-[#0a0a0a]/80 backdrop-blur-md border-b border-white/10 z-50">
                <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
                    <Link href="/" className="flex items-center gap-2 text-xl font-bold hover:text-cyan-400 transition-colors">
                        <ArrowLeft size={20} /> Back to Jobs
                    </Link>
                    <div className="font-black tracking-tighter bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent text-xl">
                        Kaamlee.
                    </div>
                </div>
            </nav>

            <div className="absolute top-1/4 -right-1/4 w-[800px] h-[800px] bg-emerald-500/10 rounded-full blur-[200px] pointer-events-none" />
            <div className="absolute bottom-1/4 -left-1/4 w-[800px] h-[800px] bg-blue-500/10 rounded-full blur-[200px] pointer-events-none" />

            <main className="flex-1 w-full flex items-center justify-center pt-24 pb-12 px-4 relative z-10">
                <div className="w-full max-w-2xl">
                    <div className="text-center mb-10">
                        <div className="w-20 h-20 mx-auto bg-gradient-to-br from-emerald-500/20 to-blue-500/20 border border-white/20 rounded-3xl flex items-center justify-center mb-6 shadow-2xl">
                            <Building2 className="w-10 h-10 text-emerald-400" />
                        </div>
                        <h1 className="text-4xl font-extrabold mb-3">Get Connected</h1>
                        <p className="text-gray-400 text-lg">Send your message with your profile details directly to our Hiring Personnel. We will get back to you shortly.</p>
                    </div>

                    <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl p-8 shadow-2xl">
                        {success ? (
                            <div className="text-center py-12">
                                <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                                    <CheckCircle2 className="w-10 h-10 text-emerald-400" />
                                </div>
                                <h3 className="text-2xl font-bold mb-2 text-white">Message Sent!</h3>
                                <p className="text-gray-400 mb-8 max-w-sm mx-auto">
                                    Our HR team has received your inquiry along with your profile information. Keep an eye on your inbox!
                                </p>
                                <button
                                    onClick={() => setSuccess(false)}
                                    className="px-6 py-3 bg-white/10 hover:bg-white/20 rounded-xl transition-colors font-medium border border-white/10"
                                >
                                    Send Another Message
                                </button>
                            </div>
                        ) : (
                            <form onSubmit={handleSubmit} className="space-y-6">
                                {error && (
                                    <div className="p-4 bg-red-500/20 border border-red-500/50 rounded-xl text-red-200">
                                        {error}
                                    </div>
                                )}

                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-300">Your Message</label>
                                    <textarea
                                        required
                                        value={message}
                                        onChange={(e) => setMessage(e.target.value)}
                                        placeholder="Hello! I would love to connect regarding..."
                                        className="w-full bg-black/40 border border-white/10 focus:border-cyan-500 rounded-2xl p-4 text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-cyan-500 transition-all resize-none min-h-[200px]"
                                    />
                                    <p className="text-xs text-gray-500 text-right">
                                        Your profile email and registered name will be automatically attached.
                                    </p>
                                </div>

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full bg-gradient-to-r from-blue-500 to-emerald-500 hover:from-blue-400 hover:to-emerald-400 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 transition-all hover:shadow-[0_0_30px_rgba(16,185,129,0.3)] disabled:opacity-50 hover:-translate-y-1 active:translate-y-0"
                                >
                                    {loading ? "Sending..." : <><Send size={20} /> Send Inquiry to HR</>}
                                </button>
                            </form>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}
