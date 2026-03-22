import { useState } from 'react';
import type { WelfareClaimType } from '@cedisense/shared';
import { formatPesewas } from '@cedisense/shared';

interface WelfareClaimFormProps {
  welfareFormOpen: boolean;
  onToggleForm: () => void;
  onSubmitClaim: (data: { claim_type: WelfareClaimType; description: string; amount_requested_pesewas: number }) => void;
}

export function WelfareClaimForm({ welfareFormOpen, onToggleForm, onSubmitClaim }: WelfareClaimFormProps) {
  const [claimType, setClaimType] = useState<WelfareClaimType>('medical');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState(0);

  return (
    <>
      {/* Submit claim button */}
      <button
        type="button"
        onClick={onToggleForm}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl
          bg-violet-500/20 border border-violet-500/40 text-violet-300 font-semibold text-sm
          hover:bg-violet-500/30 active:scale-95 transition-all min-h-[44px]"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        {welfareFormOpen ? 'Cancel' : 'Submit Welfare Claim'}
      </button>

      {/* Claim form */}
      {welfareFormOpen && (
        <div className="space-y-3 bg-violet-500/5 rounded-xl border border-violet-500/20 p-4">
          <div className="space-y-1.5">
            <label className="text-muted text-sm font-medium">Claim Type</label>
            <select
              value={claimType}
              onChange={(e) => setClaimType(e.target.value as WelfareClaimType)}
              className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-white
                text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50
                focus:border-violet-500 appearance-none cursor-pointer"
            >
              <option value="medical" className="bg-ghana-dark">Medical</option>
              <option value="funeral" className="bg-ghana-dark">Funeral</option>
              <option value="education" className="bg-ghana-dark">Education</option>
              <option value="emergency" className="bg-ghana-dark">Emergency</option>
              <option value="other" className="bg-ghana-dark">Other</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-muted text-sm font-medium">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the reason for your claim..."
              maxLength={500}
              rows={3}
              className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-white
                placeholder-muted text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50
                focus:border-violet-500 resize-none"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-muted text-sm font-medium">Amount Requested (GHS)</label>
            <input
              type="number"
              min={0.01}
              step={0.01}
              value={amount > 0 ? (amount / 100).toFixed(2) : ''}
              onChange={(e) => setAmount(Math.round(parseFloat(e.target.value || '0') * 100))}
              placeholder="0.00"
              className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-white
                placeholder-muted text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50
                focus:border-violet-500"
            />
          </div>
          <button
            type="button"
            disabled={!description.trim() || amount <= 0}
            onClick={() => {
              onSubmitClaim({
                claim_type: claimType,
                description: description.trim(),
                amount_requested_pesewas: amount,
              });
              setClaimType('medical');
              setDescription('');
              setAmount(0);
            }}
            className="w-full px-4 py-3 rounded-xl bg-violet-500 text-white font-semibold
              text-sm hover:brightness-110 active:scale-95 transition-all min-h-[44px]
              disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
          >
            Submit Claim
          </button>
        </div>
      )}
    </>
  );
}
