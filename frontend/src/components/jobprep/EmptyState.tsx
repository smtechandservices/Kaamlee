import type { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  message: string;
}

export default function EmptyState({ icon: Icon, message }: EmptyStateProps) {
  return (
    <div className="bg-[#0a0a0a] border border-dashed border-[#333] rounded-2xl p-6 text-center">
      <Icon className="w-8 h-8 text-[#444] mx-auto mb-3" />
      <p className="text-xs text-[#555] font-medium">{message}</p>
    </div>
  );
}
