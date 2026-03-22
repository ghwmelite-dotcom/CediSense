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
    <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 motion-safe:animate-fade-in">
      {/* Sparkle icon with ambient glow */}
      <div className="relative mb-6">
        <div
          className="absolute inset-0 rounded-full bg-[#FF6B35]/15 blur-2xl scale-[2] motion-safe:animate-glow-pulse"
          aria-hidden="true"
        />
        <div
          className="relative w-16 h-16 rounded-full bg-gradient-to-br from-[#FF6B35]/20 to-[#FF6B35]/5
            border border-[#FF6B35]/15 flex items-center justify-center shadow-[0_0_25px_rgba(255,107,53,0.15)]"
        >
          <svg className="w-7 h-7 text-[#FF6B35] motion-safe:animate-sparkle-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
          </svg>
        </div>
      </div>

      <h2 className="text-white text-lg font-semibold mb-2 text-center">
        Hi! I&apos;m your CediSense AI advisor
      </h2>
      <p className="text-muted text-sm text-center mb-8 max-w-xs leading-relaxed">
        Ask me about your spending, savings tips, or financial goals
      </p>

      {/* Suggestion chips */}
      <div className="flex flex-wrap justify-center gap-2.5">
        {SUGGESTIONS.map((text) => (
          <button
            key={text}
            type="button"
            onClick={() => onSuggestion(text)}
            className="bg-white/[0.03] border border-[rgba(255,107,53,0.12)] rounded-full px-4 py-2.5 text-[#FF6B35]/80 text-sm
              hover:bg-[#FF6B35]/[0.08] hover:border-[#FF6B35]/20 hover:text-[#FF6B35]
              active:scale-[0.97]
              transition-all duration-200 min-h-[44px]"
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}
