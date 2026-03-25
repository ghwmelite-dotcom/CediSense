import { useState, useEffect, useCallback } from 'react';

interface MentionMember {
  member_id: string;
  display_name: string;
  user_id: string;
}

interface MentionPopupProps {
  query: string;
  members: MentionMember[];
  onSelect: (member: MentionMember) => void;
  onClose: () => void;
  position: { bottom: number; left: number };
}

export function MentionPopup({ query, members, onSelect, onClose, position }: MentionPopupProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  const filtered = members
    .filter((m) => m.display_name.toLowerCase().startsWith(query.toLowerCase()))
    .slice(0, 5);

  // Reset active index when filtered results change
  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((prev) => (prev + 1) % filtered.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((prev) => (prev - 1 + filtered.length) % filtered.length);
        return;
      }
      if (e.key === 'Enter' && filtered.length > 0) {
        e.preventDefault();
        onSelect(filtered[activeIndex]);
      }
    },
    [filtered, activeIndex, onSelect, onClose],
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (filtered.length === 0) return null;

  return (
    <div
      className="absolute z-50 w-[220px] rounded-xl border border-white/10 bg-[#14142A]/95 backdrop-blur-xl shadow-2xl overflow-hidden"
      style={{ bottom: `${position.bottom}px`, left: `${position.left}px` }}
      role="listbox"
      aria-label="Mention suggestions"
    >
      {filtered.map((member, i) => (
        <button
          key={member.member_id}
          type="button"
          role="option"
          aria-selected={i === activeIndex}
          onClick={() => onSelect(member)}
          className={`w-full text-left px-4 py-2.5 min-h-[44px] flex items-center gap-2 transition-colors cursor-pointer ${
            i === activeIndex
              ? 'bg-gold/15 text-gold'
              : 'text-white hover:bg-white/[0.06]'
          }`}
        >
          <span className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-xs font-semibold shrink-0">
            {member.display_name.charAt(0).toUpperCase()}
          </span>
          <span className="text-sm font-medium truncate">{member.display_name}</span>
        </button>
      ))}
    </div>
  );
}
