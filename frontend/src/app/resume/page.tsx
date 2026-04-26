"use client";
import { useState } from "react";
import { fetchWithAuth } from "@/lib/api";
import { Upload, FileText, CheckCircle, AlertCircle, ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";

export default function ResumePage() {
    const [file, setFile] = useState<File | null>(null);
    const [jobDescription, setJobDescription] = useState("");
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [result, setResult] = useState<any>(null);
    const [error, setError] = useState("");

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const selectedFile = e.target.files[0];
            setFile(selectedFile);

            // Auto upload right after selecting
            setUploading(true);
            setError("");
            try {
                const formData = new FormData();
                formData.append('file', selectedFile);

                const res = await fetchWithAuth("/resumes/upload/", {
                    method: 'POST',
                    body: formData,
                });

                if (!res.ok) {
                    const data = await res.json();
                    throw new Error(data.error || "Failed to upload resume.");
                }
            } catch (err: any) {
                setError(err.message || "Something went wrong uploading.");
                setFile(null);
            } finally {
                setUploading(false);
            }
        }
    };

    const checkAts = async () => {
        if (!file) {
            setError("Please upload a resume first.");
            return;
        }
        if (!jobDescription) {
            setError("Please paste a job description to check against.");
            return;
        }

        setLoading(true);
        setError("");
        setResult(null);

        try {
            const res = await fetchWithAuth("/resumes/ats-check/", {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ job_description: jobDescription }),
            });
            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || "Failed algorithms.");
            }

            setResult(data);
        } catch (err: any) {
            setError(err.message || "Failed to analyze resume.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#0a0a0a] text-white font-sans overflow-x-hidden">
            <nav className="fixed top-0 w-full bg-[#0a0a0a]/80 backdrop-blur-md border-b border-white/10 z-50">
                <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
                    <Link href="/" className="flex items-center gap-2 text-xl font-bold hover:text-emerald-400 transition-colors">
                        <ArrowLeft size={20} /> Back to Jobs
                    </Link>
                    <div className="font-black tracking-tighter bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent text-xl">
                        Kaamlee.
                    </div>
                </div>
            </nav>

            <main className="pt-32 pb-20 px-4 max-w-4xl mx-auto relative z-10">
                <div className="text-center mb-12">
                    <h1 className="text-4xl md:text-5xl font-extrabold mb-4">AI Resume <span className="text-emerald-400">Analyzer</span></h1>
                    <p className="text-gray-400 text-lg">Upload your resume and paste a job description to find missing keywords before you apply.</p>
                </div>

                {error && (
                    <div className="bg-red-500/10 border border-red-500/50 p-4 rounded-xl text-red-400 mb-8 flex items-center gap-3">
                        <AlertCircle />
                        <span>{error}</span>
                    </div>
                )}

                <div className="grid md:grid-cols-2 gap-8 mb-8">
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-6 group">
                        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                            <span className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-sm">1</span>
                            Upload Resume
                        </h2>

                        <div className="border-2 border-dashed border-white/20 group-hover:border-emerald-500/50 rounded-xl p-8 flex flex-col items-center justify-center text-center transition-colors relative h-48">
                            <input
                                type="file"
                                accept=".pdf"
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                onChange={handleFileChange}
                                disabled={uploading || loading}
                            />

                            {uploading ? (
                                <>
                                    <Loader2 className="w-10 h-10 text-emerald-500 animate-spin mb-3" />
                                    <p className="text-gray-400 font-medium">Uploading to secure server...</p>
                                </>
                            ) : file ? (
                                <>
                                    <FileText className="w-12 h-12 text-emerald-400 mb-3" />
                                    <p className="font-medium text-emerald-300">{file.name}</p>
                                    <p className="text-xs text-gray-500 mt-1">Click to replace</p>
                                </>
                            ) : (
                                <>
                                    <Upload className="w-10 h-10 text-gray-500 group-hover:text-emerald-400 mb-3 transition-colors" />
                                    <p className="text-gray-300 font-medium mb-1">Drag & Drop or Click to Browse</p>
                                    <p className="text-xs text-gray-500">PDF documents only</p>
                                </>
                            )}
                        </div>
                    </div>

                    <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col">
                        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                            <span className="w-8 h-8 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold text-sm">2</span>
                            Job Description
                        </h2>
                        <textarea
                            value={jobDescription}
                            onChange={(e) => setJobDescription(e.target.value)}
                            placeholder="Paste the job requirements here..."
                            className="w-full flex-grow bg-black/40 border border-white/10 rounded-xl p-4 text-gray-300 focus:outline-none focus:border-cyan-500 resize-none h-48"
                        />
                    </div>
                </div>

                <button
                    onClick={checkAts}
                    disabled={loading || !file || !jobDescription}
                    className="w-full bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-white font-bold text-lg py-4 rounded-2xl shadow-[0_0_30px_rgba(16,185,129,0.2)] hover:shadow-[0_0_40px_rgba(16,185,129,0.4)] disabled:opacity-50 disabled:shadow-none transition-all hover:-translate-y-1 active:translate-y-0 flex items-center justify-center gap-2"
                >
                    {loading ? (
                        <><Loader2 className="animate-spin" /> Analyzing match & keywords...</>
                    ) : (
                        "Check ATS Score (1 Free Use)"
                    )}
                </button>

                {result && (
                    <div className="mt-12 bg-white/5 border border-white/20 rounded-3xl p-8 shadow-2xl overflow-hidden relative">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-cyan-500" />

                        <div className="flex flex-col md:flex-row items-center gap-8 mb-8">
                            <div className="relative w-40 h-40 flex items-center justify-center rounded-full bg-black/50 border-[6px] border-emerald-500/30">
                                {/* Simulated circular progress */}
                                <div className="absolute font-black text-5xl text-white">{result.ats_score}<span className="text-2xl text-gray-500">%</span></div>
                            </div>
                            <div className="flex-1">
                                <h3 className="text-2xl font-bold mb-2">Match Analysis</h3>
                                <p className="text-gray-400 text-lg">{result.feedback}</p>
                                <div className="mt-4 inline-flex px-3 py-1 rounded-full bg-black/50 border border-white/10 text-xs">
                                    Checks Remaining: <span className="font-bold text-emerald-400 ml-1">{result.checks_remaining}</span>
                                </div>
                            </div>
                        </div>

                        <div className="pt-6 border-t border-white/10">
                            <h4 className="text-lg font-semibold text-red-400 mb-4 flex items-center gap-2">
                                <AlertCircle size={18} /> Keywords Missing From Resume
                            </h4>
                            <div className="flex flex-wrap gap-2">
                                {result.missing_keywords?.length > 0 ? (
                                    result.missing_keywords.map((kw: string, i: number) => (
                                        <span key={i} className="px-4 py-2 rounded-xl bg-red-500/10 border border-red-500/30 text-red-200">
                                            {kw}
                                        </span>
                                    ))
                                ) : (
                                    <span className="text-gray-500 italic">No critical keywords missing!</span>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </main>

            <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-emerald-500/5 rounded-full blur-[200px] pointer-events-none" />
        </div>
    );
}
