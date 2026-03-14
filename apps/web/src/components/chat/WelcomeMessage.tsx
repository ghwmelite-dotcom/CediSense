interface WelcomeMessageProps {
  onSuggestion: (text: string) => void;
}

const SUGGESTIONS = [
  'How am I spending?',
  'Tips to save on MoMo fees',
  'Summarize this month',
  'Am I on track?',
];

export function WelcomeMessage({ onSuggestion }: WelcomeMessageProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 animate-fade-in">
      {/* Animated sparkle icon with glow halo */}
      <div className="relative mb-5">
        <div
          className="absolute inset-0 rounded-full bg-gold/20 blur-xl scale-150 animate-pulse-soft"
          aria-hidden="true"
        />
        <div
          className="relative w-16 h-16 rounded-full bg-gradient-to-br from-gold/30 to-gold/10
            border border-gold/25 flex items-center justify-center shadow-gold-glow"
        >
          <span className="text-3xl animate-sparkle-spin" role="img" aria-label="sparkles">
            ✨
          </span>
        </div>
      </div>

      <h2 className="text-white text-lg font-semibold mb-2 text-center">
        Hi! I&apos;m your CediSense AI advisor
      </h2>
      <p className="text-muted text-sm text-center mb-7 max-w-xs leading-relaxed">
        Ask me about your spending, savings tips, or financial goals
      </p>

      {/* Suggestion chips */}
      <div className="flex flex-wrap justify-center gap-2">
        {SUGGESTIONS.map((text) => (
          <button
            key={text}
            type="button"
            onClick={() => onSuggestion(text)}
            className="bg-white/8 border border-white/12 rounded-full px-4 py-2 text-gold text-sm
              shadow-[0_2px_8px_rgba(0,0,0,0.25)]
              hover:bg-gold/15 hover:border-gold/35 hover:scale-[1.04]
              hover:shadow-[0_0_14px_rgba(212,168,67,0.2)]
              active:scale-95
              transition-all duration-200"
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}
