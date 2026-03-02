export default function Loading() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="relative">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent shadow-glow-md" />
        <div className="absolute inset-0 h-10 w-10 animate-ping rounded-full border border-primary/20" />
      </div>
    </div>
  );
}
