"use client";
import { useState, useEffect } from "react";
import { fetchWithAuth } from "@/lib/api";
import { User, Briefcase, MapPin, ExternalLink, ArrowLeft, Loader2, Sparkles, Building2, Clock } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function ProfilePage() {
    const [user, setUser] = useState<any>(null);
    const [bio, setBio] = useState("");
    const [editing, setEditing] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [recommendedJobs, setRecommendedJobs] = useState([]);
    const [jobsLoading, setJobsLoading] = useState(false);
    const router = useRouter();

    useEffect(() => {
        const fetchUser = async () => {
            try {
                const res = await fetchWithAuth("/auth/me/");
                if (!res.ok) throw new Error("Not logged in");
                const data = await res.json();
                setUser(data);
                setBio(data.profile?.bio || "");
            } catch (err) {
                router.push("/login");
            } finally {
                setLoading(false);
            }
        };
        fetchUser();
    }, [router]);

    useEffect(() => {
        if (user && bio) {
            const fetchJobs = async () => {
                setJobsLoading(true);
                try {
                    const res = await fetchWithAuth(`/jobs/search/?q=${encodeURIComponent(bio)}`);
                    const data = await res.json();
                    setRecommendedJobs(data.results || []);
                } catch (err) {
                    console.error(err);
                } finally {
                    setJobsLoading(false);
                }
            };

            // Delay to avoid spamming while typing if they save immediately
            fetchJobs();
        }
    }, [user, user?.profile?.bio]);

    const handleSaveBio = async () => {
        setSaving(true);
        try {
            const res = await fetchWithAuth("/auth/me/", {
                method: "PUT",
                body: JSON.stringify({ bio })
            });
            const data = await res.json();
            setUser(data);
            setEditing(false);
        } catch (err) {
            console.error(err);
        } finally {
            setSaving(false);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        router.push("/");
    };

    if (loading) {
        return <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center"><Loader2 className="w-10 h-10 text-emerald-500 animate-spin" /></div>;
    }

    return (
        <div className="min-h-screen bg-[#0a0a0a] text-white font-sans relative overflow-x-hidden">
            <nav className="fixed top-0 w-full bg-[#0a0a0a]/80 backdrop-blur-md border-b border-white/10 z-50">
                <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
                    <Link href="/" className="flex items-center gap-2 text-xl font-bold hover:text-emerald-400 transition-colors">
                        <ArrowLeft size={20} /> Back Built-in
                    </Link>
                    <div className="font-black tracking-tighter bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent text-xl">
                        Kaamlee.
                    </div>
                    <button onClick={handleLogout} className="text-gray-400 hover:text-red-400 text-sm font-medium transition-colors">Sign Out</button>
                </div>
            </nav>

            <main className="pt-28 pb-20 px-4 max-w-5xl mx-auto relative z-10 grid md:grid-cols-[1fr_2fr] gap-8">

                {/* Left Column: Profile Card */}
                <div className="space-y-6">
                    <div className="bg-white/5 border border-white/10 rounded-3xl p-8 shadow-2xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/20 rounded-full blur-[50px]" />
                        <div className="w-24 h-24 bg-gradient-to-br from-emerald-400 to-cyan-500 rounded-full flex items-center justify-center mb-6 text-3xl font-black shadow-lg">
                            {user?.first_name?.[0] || user?.email?.[0]?.toUpperCase()}
                        </div>
                        <h1 className="text-2xl font-bold mb-1">{user?.first_name} {user?.last_name}</h1>
                        <p className="text-gray-400 mb-6 text-sm">{user?.email}</p>

                        <div className="border-t border-white/10 pt-6">
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="font-semibold text-gray-300 flex items-center gap-2"><User size={16} /> Job Preferences</h3>
                                <button onClick={() => setEditing(!editing)} className="text-xs text-cyan-400 hover:text-cyan-300">
                                    {editing ? "Cancel" : "Edit Phase"}
                                </button>
                            </div>

                            {editing ? (
                                <div className="space-y-3">
                                    <input
                                        type="text"
                                        value={bio}
                                        onChange={(e) => setBio(e.target.value)}
                                        placeholder="e.g. React Frontend Developer..."
                                        className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-cyan-500"
                                    />
                                    <button
                                        onClick={handleSaveBio} disabled={saving}
                                        className="w-full bg-cyan-500 hover:bg-cyan-600 text-white font-medium py-2 rounded-xl text-sm transition-colors flex justify-center items-center gap-2"
                                    >
                                        {saving ? <Loader2 size={16} className="animate-spin" /> : "Save Target Role"}
                                    </button>
                                </div>
                            ) : (
                                <div className="bg-black/30 rounded-xl p-4 border border-white/5">
                                    <p className="text-sm font-medium text-emerald-400">
                                        {user?.profile?.bio ? user.profile.bio : "Not Set. Edit to get Custom Recommendations!"}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    <Link href="/resume" className="block w-full bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 hover:from-emerald-500/20 hover:to-cyan-500/20 border border-emerald-500/30 rounded-3xl p-6 transition-all group">
                        <h3 className="font-bold flex items-center gap-2 text-emerald-400 mb-2">Check ATS Match <ExternalLink size={16} className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" /></h3>
                        <p className="text-sm text-gray-400">Scan your resume instantly against any job description.</p>
                    </Link>
                </div>

                {/* Right Column: Recommended Jobs */}
                <div className="space-y-6">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 bg-emerald-500/20 rounded-xl text-emerald-400"><Sparkles size={24} /></div>
                        <h2 className="text-3xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">Recommended Curations</h2>
                    </div>

                    <div className="space-y-4">
                        {jobsLoading ? (
                            <div className="py-20 flex justify-center"><Loader2 className="w-8 h-8 text-emerald-500 animate-spin" /></div>
                        ) : !user?.profile?.bio ? (
                            <div className="bg-white/5 border border-white/10 rounded-2xl p-10 text-center">
                                <p className="text-gray-400">Set your Target Role on the left to see personalized job curations here.</p>
                            </div>
                        ) : recommendedJobs.length === 0 ? (
                            <div className="bg-white/5 border border-white/10 rounded-2xl p-10 text-center">
                                <p className="text-gray-400">No jobs match '{user.profile.bio}' currently. Try expanding your preference term.</p>
                            </div>
                        ) : (
                            recommendedJobs.map((job: any) => (
                                <div key={job.id} className="bg-white/5 hover:bg-white/10 border border-white/10 hover:border-emerald-500/50 rounded-2xl p-5 transition-all duration-300 md:flex items-center justify-between group">
                                    <div className="flex-1">
                                        <h3 className="font-bold text-lg mb-1 group-hover:text-emerald-400 transition-colors line-clamp-1">{job.title}</h3>
                                        <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400 font-medium mb-3 md:mb-0">
                                            <span className="flex items-center gap-1 text-emerald-500"><Building2 size={14} /> {job.company}</span>
                                            <span className="flex items-center gap-1"><MapPin size={14} /> {job.location || 'Remote'}</span>
                                            {job.is_remote && <span className="flex items-center gap-1 text-cyan-400"><Clock size={14} /> Remote Allowed</span>}
                                        </div>
                                    </div>
                                    <a
                                        href={job.url} target="_blank" rel="noreferrer"
                                        className="shrink-0 md:ml-6 px-5 py-2.5 bg-white/10 hover:bg-emerald-500 text-white text-sm font-semibold rounded-xl flex items-center justify-center gap-2 transition-all border border-white/10 group-hover:border-transparent"
                                    >
                                        Apply <ExternalLink size={14} />
                                    </a>
                                </div>
                            ))
                        )}
                    </div>
                </div>

            </main>

            <div className="fixed top-1/2 right-0 w-[600px] h-[600px] bg-cyan-500/5 rounded-full blur-[150px] pointer-events-none translate-x-1/2" />
        </div>
    );
}
