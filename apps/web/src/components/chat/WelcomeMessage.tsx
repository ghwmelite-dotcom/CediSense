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
    <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
      <span className="text-4xl mb-4">✨</span>
      <h2 className="text-white text-lg font-semibold mb-2">Hi! I'm your CediSense AI advisor</h2>
      <p className="text-muted text-sm text-center mb-6">
        Ask me about your spending, savings tips, or financial goals
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        {SUGGESTIONS.map((text) => (
          <button
            key={text}
            type="button"
            onClick={() => onSuggestion(text)}
            className="bg-white/10 border border-white/10 rounded-full px-4 py-2 text-gold text-sm
              hover:bg-white/20 active:scale-95 transition-all"
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}
