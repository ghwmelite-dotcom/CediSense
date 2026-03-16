import { useState } from 'react';
import type { SusuFrequency, SusuVariant, DiasporaCurrency } from '@cedisense/shared';
import { AmountInput } from '@/components/transactions/AmountInput';

interface CreateGroupData {
  name: string;
  contribution_pesewas: number;
  frequency: SusuFrequency;
  max_members: number;
  variant: SusuVariant;
  goal_amount_pesewas?: number;
  goal_description?: string;
  target_term?: string;
  school_name?: string;
  base_currency?: DiasporaCurrency;
  event_name?: string;
  event_date?: string;
  guarantee_percent?: number;
  supplier_name?: string;
  supplier_contact?: string;
  item_description?: string;
  estimated_savings_percent?: number;
}

interface CreateGroupModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: CreateGroupData) => void;
}

const VARIANT_OPTIONS: { value: SusuVariant; label: string; description: string; className?: string }[] = [
  { value: 'rotating', label: 'Rotating', description: 'One member gets the pot each round' },
  { value: 'accumulating', label: 'Accumulating', description: 'Everyone saves, split at the end' },
  { value: 'goal_based', label: 'Goal-based', description: 'Save together for a shared goal' },
  { value: 'bidding', label: 'Bidding', description: 'Bid for early payout each round' },
  { value: 'school_fees', label: 'School Fees', description: 'Save for school term fees with term payouts' },
  { value: 'diaspora', label: 'Diaspora', description: 'Save across currencies for Ghana remittances' },
  { value: 'event_fund', label: 'Event Fund', description: 'Crowdfund a wedding, naming ceremony, or event' },
  { value: 'bulk_purchase', label: 'Bulk Purchase', description: 'Pool money to buy inventory at wholesale prices' },
  { value: 'funeral_fund', label: 'Funeral Fund', description: 'Emergency bereavement support for your family' },
];

const CURRENCY_OPTIONS: { value: DiasporaCurrency; label: string; symbol: string }[] = [
  { value: 'GHS', label: 'Ghana Cedi', symbol: '\u20B5' },
  { value: 'GBP', label: 'British Pound', symbol: '\u00A3' },
  { value: 'USD', label: 'US Dollar', symbol: '$' },
  { value: 'EUR', label: 'Euro', symbol: '\u20AC' },
  { value: 'CAD', label: 'Canadian Dollar', symbol: 'CA$' },
];

const TERM_OPTIONS = [
  { value: 'Term 1', label: 'Term 1 (Sep\u2013Dec)', payout: 'Payout: August' },
  { value: 'Term 2', label: 'Term 2 (Jan\u2013Apr)', payout: 'Payout: December' },
  { value: 'Term 3', label: 'Term 3 (May\u2013Jul)', payout: 'Payout: March' },
];

export function CreateGroupModal({ open, onClose, onSave }: CreateGroupModalProps) {
  const [name, setName] = useState('');
  const [contributionPesewas, setContributionPesewas] = useState(0);
  const [frequency, setFrequency] = useState<SusuFrequency>('monthly');
  const [maxMembers, setMaxMembers] = useState(12);
  const [variant, setVariant] = useState<SusuVariant>('rotating');
  const [goalAmountPesewas, setGoalAmountPesewas] = useState(0);
  const [goalDescription, setGoalDescription] = useState('');
  // School fees
  const [targetTerm, setTargetTerm] = useState('Term 1');
  const [schoolName, setSchoolName] = useState('');
  // Diaspora
  const [baseCurrency, setBaseCurrency] = useState<DiasporaCurrency>('GHS');
  // Event fund
  const [eventName, setEventName] = useState('');
  const [eventDate, setEventDate] = useState('');
  // Guarantee fund
  const [guaranteeEnabled, setGuaranteeEnabled] = useState(false);
  const [guaranteePercent, setGuaranteePercent] = useState(2);
  // Bulk purchase
  const [supplierName, setSupplierName] = useState('');
  const [supplierContact, setSupplierContact] = useState('');
  const [itemDescription, setItemDescription] = useState('');
  const [estimatedSavingsPercent, setEstimatedSavingsPercent] = useState(0);

  if (!open) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || contributionPesewas <= 0) return;
    if (variant === 'goal_based' && goalAmountPesewas <= 0) return;
    if (variant === 'event_fund' && !eventName.trim()) return;
    if (variant === 'bulk_purchase' && !supplierName.trim()) return;

    onSave({
      name: name.trim(),
      contribution_pesewas: contributionPesewas,
      frequency,
      max_members: maxMembers,
      variant,
      goal_amount_pesewas: (variant === 'goal_based' || variant === 'event_fund') ? goalAmountPesewas : undefined,
      goal_description: variant === 'goal_based' && goalDescription.trim() ? goalDescription.trim() : undefined,
      target_term: variant === 'school_fees' ? targetTerm : undefined,
      school_name: variant === 'school_fees' && schoolName.trim() ? schoolName.trim() : undefined,
      base_currency: variant === 'diaspora' ? baseCurrency : undefined,
      event_name: variant === 'event_fund' ? eventName.trim() : undefined,
      event_date: variant === 'event_fund' && eventDate ? eventDate : undefined,
      guarantee_percent: guaranteeEnabled ? guaranteePercent : undefined,
      supplier_name: variant === 'bulk_purchase' ? supplierName.trim() : undefined,
      supplier_contact: variant === 'bulk_purchase' && supplierContact.trim() ? supplierContact.trim() : undefined,
      item_description: variant === 'bulk_purchase' && itemDescription.trim() ? itemDescription.trim() : undefined,
      estimated_savings_percent: variant === 'bulk_purchase' && estimatedSavingsPercent > 0 ? estimatedSavingsPercent : undefined,
    });

    resetForm();
  }

  function resetForm() {
    setName('');
    setContributionPesewas(0);
    setFrequency('monthly');
    setMaxMembers(12);
    setVariant('rotating');
    setGoalAmountPesewas(0);
    setGoalDescription('');
    setTargetTerm('Term 1');
    setSchoolName('');
    setBaseCurrency('GHS');
    setEventName('');
    setEventDate('');
    setGuaranteeEnabled(false);
    setGuaranteePercent(2);
    setSupplierName('');
    setSupplierContact('');
    setItemDescription('');
    setEstimatedSavingsPercent(0);
  }

  function handleClose() {
    resetForm();
    onClose();
  }

  const clampMembers = (val: number) => Math.min(50, Math.max(2, val));

  const isSubmitDisabled =
    !name.trim() ||
    contributionPesewas <= 0 ||
    (variant === 'goal_based' && goalAmountPesewas <= 0) ||
    (variant === 'event_fund' && !eventName.trim()) ||
    (variant === 'bulk_purchase' && !supplierName.trim());

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-group-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div className="relative w-full max-w-md bg-ghana-dark border border-white/10 rounded-2xl
        shadow-2xl shadow-black/40 p-6 space-y-5 max-h-[90vh] overflow-y-auto">
        <h2 id="create-group-title" className="text-white text-lg font-bold">
          Create Susu Group
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Group name */}
          <div className="space-y-1.5">
            <label htmlFor="group-name" className="text-muted text-sm font-medium">
              Group Name
            </label>
            <input
              id="group-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Friday Market Susu"
              required
              className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-white
                placeholder-muted text-sm focus:outline-none focus:ring-2 focus:ring-gold/50
                focus:border-gold"
            />
          </div>

          {/* Variant selector */}
          <div className="space-y-2">
            <p className="text-muted text-sm font-medium">Susu Type</p>
            <div className="grid grid-cols-2 gap-2">
              {VARIANT_OPTIONS.map((opt) => {
                const isFuneral = opt.value === 'funeral_fund';
                const isSelected = variant === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setVariant(opt.value)}
                    className={`flex flex-col gap-1 p-3 rounded-xl border text-left transition-all
                      active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/50
                      ${opt.className ?? ''}
                      ${isSelected
                        ? isFuneral
                          ? 'bg-neutral-800 border-amber-700/60 text-amber-200'
                          : 'bg-gold/15 border-gold/60 text-gold'
                        : isFuneral
                          ? 'bg-neutral-900/60 border-neutral-700/40 text-neutral-300 hover:bg-neutral-800/60'
                          : 'bg-white/5 border-white/10 text-white hover:bg-white/10'
                      }`}
                  >
                    <span className="text-sm font-semibold">{opt.label}</span>
                    <span className={`text-xs leading-snug ${
                      isSelected
                        ? isFuneral ? 'text-amber-300/70' : 'text-gold/80'
                        : 'text-muted'
                    }`}>
                      {opt.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Goal-based fields */}
          {variant === 'goal_based' && (
            <div className="space-y-3 rounded-xl border border-gold/20 bg-gold/5 p-4">
              <p className="text-gold text-xs font-semibold uppercase tracking-wide">Goal Settings</p>
              <div className="space-y-1.5">
                <label className="text-muted text-sm font-medium">Goal Amount</label>
                <AmountInput
                  valuePesewas={goalAmountPesewas}
                  onChange={setGoalAmountPesewas}
                  placeholder="0.00"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="goal-description" className="text-muted text-sm font-medium">
                  Goal Description <span className="text-muted/60">(optional)</span>
                </label>
                <input
                  id="goal-description"
                  type="text"
                  value={goalDescription}
                  onChange={(e) => setGoalDescription(e.target.value)}
                  placeholder="e.g. Buy a shared bus"
                  maxLength={200}
                  className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-white
                    placeholder-muted text-sm focus:outline-none focus:ring-2 focus:ring-gold/50
                    focus:border-gold"
                />
              </div>
            </div>
          )}

          {/* School Fees fields */}
          {variant === 'school_fees' && (
            <div className="space-y-3 rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">
              <p className="text-blue-300 text-xs font-semibold uppercase tracking-wide">School Fees Settings</p>
              <div className="space-y-1.5">
                <label className="text-muted text-sm font-medium">Target Term</label>
                <div className="space-y-2">
                  {TERM_OPTIONS.map((term) => (
                    <button
                      key={term.value}
                      type="button"
                      onClick={() => setTargetTerm(term.value)}
                      className={`w-full flex items-center justify-between p-3 rounded-xl border text-left transition-all
                        active:scale-95
                        ${targetTerm === term.value
                          ? 'bg-blue-500/15 border-blue-500/60 text-blue-300'
                          : 'bg-white/5 border-white/10 text-white hover:bg-white/10'
                        }`}
                    >
                      <span className="text-sm font-semibold">{term.label}</span>
                      <span className={`text-xs ${targetTerm === term.value ? 'text-blue-300/70' : 'text-muted'}`}>
                        {term.payout}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-muted text-sm font-medium">
                  School Name <span className="text-muted/60">(optional)</span>
                </label>
                <input
                  type="text"
                  value={schoolName}
                  onChange={(e) => setSchoolName(e.target.value)}
                  placeholder="e.g. Accra Academy"
                  maxLength={200}
                  className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-white
                    placeholder-muted text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50
                    focus:border-blue-500"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-muted text-sm font-medium">Target Amount (fees)</label>
                <AmountInput
                  valuePesewas={goalAmountPesewas}
                  onChange={setGoalAmountPesewas}
                  placeholder="0.00"
                />
              </div>
            </div>
          )}

          {/* Diaspora fields */}
          {variant === 'diaspora' && (
            <div className="space-y-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
              <p className="text-emerald-300 text-xs font-semibold uppercase tracking-wide">Diaspora Settings</p>
              <div className="space-y-1.5">
                <label className="text-muted text-sm font-medium">Base Currency</label>
                <div className="grid grid-cols-3 gap-2">
                  {CURRENCY_OPTIONS.map((cur) => (
                    <button
                      key={cur.value}
                      type="button"
                      onClick={() => setBaseCurrency(cur.value)}
                      className={`flex flex-col items-center gap-0.5 p-2.5 rounded-xl border text-center transition-all
                        active:scale-95
                        ${baseCurrency === cur.value
                          ? 'bg-emerald-500/15 border-emerald-500/60 text-emerald-300'
                          : 'bg-white/5 border-white/10 text-white hover:bg-white/10'
                        }`}
                    >
                      <span className="text-lg font-bold">{cur.symbol}</span>
                      <span className="text-[10px] font-medium">{cur.value}</span>
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-muted text-xs">
                Members can contribute in any supported currency. Amounts are converted to {baseCurrency} equivalent.
              </p>
            </div>
          )}

          {/* Event Fund fields */}
          {variant === 'event_fund' && (
            <div className="space-y-3 rounded-xl border border-pink-500/20 bg-pink-500/5 p-4">
              <p className="text-pink-300 text-xs font-semibold uppercase tracking-wide">Event Fund Settings (Abotr\u025B)</p>
              <div className="space-y-1.5">
                <label className="text-muted text-sm font-medium">Event Name</label>
                <input
                  type="text"
                  value={eventName}
                  onChange={(e) => setEventName(e.target.value)}
                  placeholder="e.g. Kwame & Ama's Wedding"
                  maxLength={200}
                  required
                  className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-white
                    placeholder-muted text-sm focus:outline-none focus:ring-2 focus:ring-pink-500/50
                    focus:border-pink-500"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-muted text-sm font-medium">
                  Event Date <span className="text-muted/60">(optional)</span>
                </label>
                <input
                  type="date"
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                  className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-white
                    text-sm focus:outline-none focus:ring-2 focus:ring-pink-500/50
                    focus:border-pink-500 [color-scheme:dark]"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-muted text-sm font-medium">
                  Target Amount <span className="text-muted/60">(optional)</span>
                </label>
                <AmountInput
                  valuePesewas={goalAmountPesewas}
                  onChange={setGoalAmountPesewas}
                  placeholder="0.00"
                />
              </div>
              <p className="text-muted text-xs">
                Contributions can be any amount -- no fixed minimums for event funds.
              </p>
            </div>
          )}

          {/* Bulk Purchase fields */}
          {variant === 'bulk_purchase' && (
            <div className="space-y-3 rounded-xl border border-orange-500/20 bg-orange-500/5 p-4">
              <p className="text-orange-300 text-xs font-semibold uppercase tracking-wide">Bulk Purchase Settings</p>
              <div className="space-y-1.5">
                <label className="text-muted text-sm font-medium">Supplier Name</label>
                <input
                  type="text"
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                  placeholder="e.g. Makola Wholesale Ltd"
                  maxLength={200}
                  required
                  className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-white
                    placeholder-muted text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50
                    focus:border-orange-500"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-muted text-sm font-medium">
                  Supplier Contact <span className="text-muted/60">(optional)</span>
                </label>
                <input
                  type="text"
                  value={supplierContact}
                  onChange={(e) => setSupplierContact(e.target.value)}
                  placeholder="e.g. 024 123 4567"
                  maxLength={200}
                  className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-white
                    placeholder-muted text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50
                    focus:border-orange-500"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-muted text-sm font-medium">
                  Item Description <span className="text-muted/60">(optional)</span>
                </label>
                <input
                  type="text"
                  value={itemDescription}
                  onChange={(e) => setItemDescription(e.target.value)}
                  placeholder="e.g. 100 bags of rice"
                  maxLength={500}
                  className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-white
                    placeholder-muted text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50
                    focus:border-orange-500"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-muted text-sm font-medium">
                  Estimated Savings <span className="text-muted/60">(% off retail)</span>
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={0}
                    max={50}
                    value={estimatedSavingsPercent}
                    onChange={(e) => setEstimatedSavingsPercent(parseInt(e.target.value, 10))}
                    className="flex-1 accent-orange-500"
                  />
                  <span className="text-orange-300 font-bold text-sm w-10 text-right">
                    {estimatedSavingsPercent}%
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Guarantee Fund toggle (any variant) */}
          <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-cyan-300 text-xs font-semibold uppercase tracking-wide">Guarantee Fund</p>
                <p className="text-muted text-xs mt-0.5">Protect against member defaults</p>
              </div>
              <button
                type="button"
                onClick={() => setGuaranteeEnabled(!guaranteeEnabled)}
                className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors duration-200
                  focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/50
                  ${guaranteeEnabled ? 'bg-cyan-500' : 'bg-white/20'}`}
                role="switch"
                aria-checked={guaranteeEnabled}
              >
                <span
                  className={`inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform duration-200
                    ${guaranteeEnabled ? 'translate-x-[22px]' : 'translate-x-0.5'} mt-0.5`}
                />
              </button>
            </div>
            {guaranteeEnabled && (
              <div className="space-y-1.5">
                <label className="text-muted text-sm font-medium">
                  Percentage per contribution
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={1}
                    max={5}
                    value={guaranteePercent}
                    onChange={(e) => setGuaranteePercent(parseInt(e.target.value, 10))}
                    className="flex-1 accent-cyan-500"
                  />
                  <span className="text-cyan-300 font-bold text-sm w-8 text-right">
                    {guaranteePercent}%
                  </span>
                </div>
                <p className="text-muted text-xs">
                  {guaranteePercent}% of each contribution goes into a guarantee pool. Unused funds are refunded at cycle end.
                </p>
              </div>
            )}
          </div>

          {/* Contribution amount */}
          <div className="space-y-1.5">
            <label className="text-muted text-sm font-medium">
              Contribution Amount
            </label>
            <AmountInput
              valuePesewas={contributionPesewas}
              onChange={setContributionPesewas}
              placeholder="0.00"
              required
            />
          </div>

          {/* Frequency */}
          <div className="space-y-1.5">
            <label htmlFor="group-frequency" className="text-muted text-sm font-medium">
              Frequency
            </label>
            <select
              id="group-frequency"
              value={frequency}
              onChange={(e) => setFrequency(e.target.value as SusuFrequency)}
              className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-white
                text-sm focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold
                appearance-none cursor-pointer"
            >
              <option value="daily" className="bg-ghana-dark">Daily</option>
              <option value="weekly" className="bg-ghana-dark">Weekly</option>
              <option value="monthly" className="bg-ghana-dark">Monthly</option>
            </select>
          </div>

          {/* Max members */}
          <div className="space-y-1.5">
            <label htmlFor="group-max-members" className="text-muted text-sm font-medium">
              Max Members
            </label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setMaxMembers((v) => clampMembers(v - 1))}
                className="w-10 h-10 rounded-lg bg-white/10 border border-white/10 text-white
                  font-bold text-lg hover:bg-white/20 active:scale-95 transition-all
                  flex items-center justify-center shrink-0"
                aria-label="Decrease max members"
              >
                −
              </button>
              <input
                id="group-max-members"
                type="number"
                min={2}
                max={50}
                value={maxMembers}
                onChange={(e) => setMaxMembers(clampMembers(parseInt(e.target.value, 10) || 2))}
                className="flex-1 bg-white/10 border border-white/10 rounded-xl px-4 py-3
                  text-white text-sm text-center font-semibold focus:outline-none
                  focus:ring-2 focus:ring-gold/50 focus:border-gold"
              />
              <button
                type="button"
                onClick={() => setMaxMembers((v) => clampMembers(v + 1))}
                className="w-10 h-10 rounded-lg bg-white/10 border border-white/10 text-white
                  font-bold text-lg hover:bg-white/20 active:scale-95 transition-all
                  flex items-center justify-center shrink-0"
                aria-label="Increase max members"
              >
                +
              </button>
            </div>
            <p className="text-muted text-xs px-1">Between 2 and 50 members</p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 px-4 py-3 rounded-xl border border-white/20 text-white font-semibold
                text-sm hover:bg-white/10 active:scale-95 transition-all min-h-[44px]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitDisabled}
              className="flex-1 px-4 py-3 rounded-xl bg-gold text-ghana-dark font-semibold
                text-sm hover:brightness-110 active:scale-95 transition-all min-h-[44px]
                disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
            >
              Create Group
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
