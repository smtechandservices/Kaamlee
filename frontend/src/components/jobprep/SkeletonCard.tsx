export default function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div className={`bg-[#111] border border-[#222] rounded-2xl p-5 animate-pulse ${className}`}>
      <div className="h-3 w-1/3 bg-[#222] rounded-full mb-4" />
      <div className="h-4 w-3/4 bg-[#1a1a1a] rounded-full mb-3" />
      <div className="h-3 w-1/2 bg-[#1a1a1a] rounded-full" />
    </div>
  );
}
