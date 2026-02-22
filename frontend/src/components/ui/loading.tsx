export function Loading() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}

export function PageLoading() {
  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <div className="h-12 w-12 animate-spin rounded-full border-3 border-primary border-t-transparent" />
    </div>
  );
}
