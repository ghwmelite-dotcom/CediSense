export function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="bg-ghana-surface rounded-2xl rounded-bl-md border border-white/10 px-4 py-3 flex gap-1.5">
        <span className="w-2 h-2 bg-muted rounded-full motion-safe:animate-pulse" style={{ animationDelay: '0ms' }} />
        <span className="w-2 h-2 bg-muted rounded-full motion-safe:animate-pulse" style={{ animationDelay: '150ms' }} />
        <span className="w-2 h-2 bg-muted rounded-full motion-safe:animate-pulse" style={{ animationDelay: '300ms' }} />
      </div>
    </div>
  );
}
