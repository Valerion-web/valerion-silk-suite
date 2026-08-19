export default function LoadingState() {
  return (
    <div className="space-y-4 rounded-[24px] border border-[#E5E7EB] bg-white p-8 shadow-[0_18px_36px_-24px_rgba(15,23,42,0.14)]">
      <div className="h-4 w-32 animate-pulse rounded-full bg-[#E5E7EB]" />
      <div className="grid gap-4 md:grid-cols-3">
        <div className="h-24 animate-pulse rounded-[20px] bg-[#F8FAFC]" />
        <div className="h-24 animate-pulse rounded-[20px] bg-[#F8FAFC]" />
        <div className="h-24 animate-pulse rounded-[20px] bg-[#F8FAFC]" />
      </div>
      <div className="h-72 animate-pulse rounded-[24px] bg-[#F8FAFC]" />
    </div>
  );
}
