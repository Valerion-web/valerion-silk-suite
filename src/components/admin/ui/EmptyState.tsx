interface EmptyStateProps {
  title: string;
  description: string;
}

export default function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <div className="rounded-[24px] border border-[#E5E7EB] bg-[#F8FAFC] p-10 text-center text-[#334155] shadow-[0_18px_36px_-24px_rgba(15,23,42,0.14)]">
      <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[#C8A13B]">No results</p>
      <h2 className="mt-4 text-xl font-semibold text-[#0F172A]">{title}</h2>
      <p className="mt-2 text-sm leading-7 text-[#64748B]">{description}</p>
    </div>
  );
}
