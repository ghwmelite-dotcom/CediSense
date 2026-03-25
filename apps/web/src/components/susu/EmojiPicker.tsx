import { useState, useEffect, useRef, useCallback } from 'react';

const EMOJI_CATEGORIES = [
  {
    name: 'Smileys',
    emojis: [
      '😀','😃','😄','😁','😆','😂','🤣','🥹','😊','😇',
      '🙂','😉','😍','🥰','😘','😋','😛','🤪','🤨','🧐',
      '🤓','😎','🥳','😏','😒','😞','😔','😟','😕','🙁',
      '😣','😖','😫','😩','🥺','😢','😭','😤','😠','🤬',
    ],
  },
  {
    name: 'Hands',
    emojis: [
      '👍','👎','👏','🤝','✌️','🤞','🤟','🤘','🤙','💪',
      '🫶','👋','🙌','🤲','🫰','☝️','👆','👇','👈','👉',
      '✊','👊','🤛','🤜','🫵','🫱','🫲','🫳','🫴','👐',
      '🙏','✍️','💅','🤳','💆','💇',
    ],
  },
  {
    name: 'Hearts',
    emojis: [
      '❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔',
      '❤️‍🔥','❤️‍🩹','💕','💞','💓','💗','💖','💘','💝','💟',
      '♥️','🫀','💑','💏','😍','🥰','😘','😻','💋','🫂',
    ],
  },
  {
    name: 'Objects',
    emojis: [
      '💰','💵','💴','💶','💷','💳','🪙','📱','💻','⌨️',
      '💡','⭐','🌟','✨','🎯','🏆','🥇','📊','📈','📉',
      '💼','🔑','🔒','📌','📎','✅','❌','⚠️','🎉','🎊',
      '🔔','📢','💬','💭','🗓️','📝',
    ],
  },
  {
    name: 'Food',
    emojis: [
      '🍕','🍔','🍟','🌮','🌯','🥙','🍜','🍝','🍚','🍛',
      '🥘','🍗','🥩','🥑','🍎','🍌','🍇','🍊','🍋','🍓',
      '🫐','🥝','☕','🍵','🧃','🥤','🍺','🍷','🥂','🍰',
    ],
  },
  {
    name: 'Animals',
    emojis: [
      '🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯',
      '🦁','🐮','🐷','🐸','🐵','🐔','🐧','🐦','🦅','🦆',
      '🐢','🐍','🦎','🐠','🐬','🐳','🦋','🐝','🐞','🦀',
    ],
  },
  {
    name: 'Ghana',
    emojis: [
      '🇬🇭','🏠','👨‍👩‍👧‍👦','💒','🎓','🌾','🐟','🥁','🎵','⚽',
      '🏪','🚌','🌍','🤲','🙏','💪','🤝','🎶','🌅','🌴',
    ],
  },
];

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

export function EmojiPicker({ onSelect, onClose }: EmojiPickerProps) {
  const [activeCategory, setActiveCategory] = useState(0);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const handleClickOutside = useCallback(
    (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    },
    [onClose],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose],
  );

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleClickOutside, handleKeyDown]);

  // Simple name mapping for search — map emoji to lowercase keywords
  const emojiMatchesSearch = (emoji: string, query: string): boolean => {
    if (!query) return true;
    // Basic: check if the emoji's unicode name-like description matches
    // We use the category name as a rough proxy plus common associations
    const q = query.toLowerCase();
    // Check if the emoji itself contains the query (for flag codes etc)
    if (emoji.toLowerCase().includes(q)) return true;
    // Match against the category name
    const cat = EMOJI_CATEGORIES.find((c) => c.emojis.includes(emoji));
    if (cat && cat.name.toLowerCase().includes(q)) return true;
    return false;
  };

  const filteredEmojis = search
    ? EMOJI_CATEGORIES.flatMap((cat) => cat.emojis.filter((e) => emojiMatchesSearch(e, search)))
    : EMOJI_CATEGORIES[activeCategory].emojis;

  return (
    <div
      ref={containerRef}
      className="absolute bottom-full mb-2 left-0 z-50 w-[320px] max-h-[380px] rounded-xl border border-white/10 bg-[#14142A]/95 backdrop-blur-xl shadow-2xl flex flex-col overflow-hidden"
      role="dialog"
      aria-label="Emoji picker"
    >
      {/* Search */}
      <div className="px-3 pt-3 pb-2">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search emojis..."
          className="w-full px-3 py-2 rounded-lg bg-white/[0.06] border border-white/10 text-white text-sm placeholder:text-muted focus:outline-none focus:border-gold/40 transition-colors"
          autoFocus
        />
      </div>

      {/* Category tabs */}
      {!search && (
        <div className="flex gap-1 px-3 pb-2 overflow-x-auto scrollbar-none">
          {EMOJI_CATEGORIES.map((cat, i) => (
            <button
              key={cat.name}
              type="button"
              onClick={() => setActiveCategory(i)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors min-h-[32px] ${
                activeCategory === i
                  ? 'bg-gold/20 text-gold'
                  : 'text-muted hover:text-white hover:bg-white/[0.06]'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      )}

      {/* Emoji grid */}
      <div className="flex-1 overflow-y-auto px-3 pb-3">
        {search && filteredEmojis.length === 0 && (
          <p className="text-muted text-xs text-center py-4">No emojis found</p>
        )}
        <div className="grid grid-cols-8 gap-0.5">
          {filteredEmojis.map((emoji, idx) => (
            <button
              key={`${emoji}-${idx}`}
              type="button"
              onClick={() => {
                onSelect(emoji);
                onClose();
              }}
              className="w-[36px] h-[36px] min-w-[36px] min-h-[36px] flex items-center justify-center text-xl rounded-lg hover:bg-white/[0.08] transition-colors cursor-pointer"
              aria-label={`Emoji ${emoji}`}
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
