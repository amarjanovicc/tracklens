export default function Loading() {
  return (
    <div className="animate-pulse" aria-busy="true" aria-label="Loading">
      <div className="mb-6 h-8 w-48 rounded-lg bg-surface-2" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => <div key={i} className="h-24 rounded-lg bg-surface-2" />)}
      </div>
      <div className="mt-6 h-72 rounded-lg bg-surface-2" />
    </div>
  );
}
