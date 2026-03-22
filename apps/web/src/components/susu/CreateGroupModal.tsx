import { useState } from 'react';
import type { SusuFrequency, SusuVariant, DiasporaCurrency } from '@cedisense/shared';
import { AmountInput } from '@/components/transactions/AmountInput';
import type { WelfareOrganizationType } from '@cedisense/shared';
import { VariantFields } from './VariantFields';

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
  crop_type?: string;
  planting_month?: number;
  harvest_month?: number;
  organization_name?: string;
  organization_type?: WelfareOrganizationType;
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
  { value: 'agricultural', label: 'Agricultural', description: 'Timed to Ghana farming seasons for crop inputs' },
  { value: 'welfare', label: 'Welfare', description: 'Church/mosque/community welfare collections' },
];

export function CreateGroupModal({ open, onClose, onSave }: CreateGroupModalProps) {
  const [name, setName] = useState('');
  const [contributionPesewas, setContributionPesewas] = useState(0);
  const [frequency, setFrequency] = useState<SusuFrequency>('monthly');
  const [maxMembers, setMaxMembers] = useState(12);
  const [variant, setVariant] = useState<SusuVariant>('rotating');
  const [goalAmountPesewas, setGoalAmountPesewas] = useState(0);
  const [goalDescription, setGoalDescription] = useState('');
  const [targetTerm, setTargetTerm] = useState('Term 1');
  const [schoolName, setSchoolName] = useState('');
  const [baseCurrency, setBaseCurrency] = useState<DiasporaCurrency>('GHS');
  const [eventName, setEventName] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [guaranteeEnabled, setGuaranteeEnabled] = useState(false);
  const [guaranteePercent, setGuaranteePercent] = useState(2);
  const [supplierName, setSupplierName] = useState('');
  const [supplierContact, setSupplierContact] = useState('');
  const [itemDescription, setItemDescription] = useState('');
  const [estimatedSavingsPercent, setEstimatedSavingsPercent] = useState(0);
  const [cropType, setCropType] = useState('Cocoa');
  const [plantingMonth, setPlantingMonth] = useState(4);
  const [harvestMonth, setHarvestMonth] = useState(10);
  const [organizationName, setOrganizationName] = useState('');
  const [organizationType, setOrganizationType] = useState<WelfareOrganizationType>('church');

  if (!open) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || contributionPesewas <= 0) return;
    if (variant === 'goal_based' && goalAmountPesewas <= 0) return;
    if (variant === 'event_fund' && !eventName.trim()) return;
    if (variant === 'bulk_purchase' && !supplierName.trim()) return;
    if (variant === 'welfare' && !organizationName.trim()) return;

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
      crop_type: variant === 'agricultural' ? cropType : undefined,
      planting_month: variant === 'agricultural' ? plantingMonth : undefined,
      harvest_month: variant === 'agricultural' ? harvestMonth : undefined,
      organization_name: variant === 'welfare' ? organizationName.trim() : undefined,
      organization_type: variant === 'welfare' ? organizationType : undefined,
    });

    resetForm();
  }

  function resetForm() {
    setName(''); setContributionPesewas(0); setFrequency('monthly'); setMaxMembers(12);
    setVariant('rotating'); setGoalAmountPesewas(0); setGoalDescription('');
    setTargetTerm('Term 1'); setSchoolName(''); setBaseCurrency('GHS');
    setEventName(''); setEventDate(''); setGuaranteeEnabled(false); setGuaranteePercent(2);
    setSupplierName(''); setSupplierContact(''); setItemDescription('');
    setEstimatedSavingsPercent(0); setCropType('Cocoa'); setPlantingMonth(4);
    setHarvestMonth(10); setOrganizationName(''); setOrganizationType('church');
  }

  function handleClose() { resetForm(); onClose(); }

  const clampMembers = (val: number) => Math.min(50, Math.max(2, val));

  const isSubmitDisabled =
    !name.trim() || contributionPesewas <= 0 ||
    (variant === 'goal_based' && goalAmountPesewas <= 0) ||
    (variant === 'event_fund' && !eventName.trim()) ||
    (variant === 'bulk_purchase' && !supplierName.trim()) ||
    (variant === 'welfare' && !organizationName.trim());

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="create-group-title">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose} aria-hidden="true" />
      <div className="relative w-full max-w-md bg-ghana-dark border border-white/10 rounded-2xl shadow-2xl shadow-black/40 p-6 space-y-5 max-h-[90vh] overflow-y-auto">
        <h2 id="create-group-title" className="text-white text-lg font-bold">Create Susu Group</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Group name */}
          <div className="space-y-1.5">
            <label htmlFor="group-name" className="text-muted text-sm font-medium">Group Name</label>
            <input id="group-name" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Friday Market Susu" required className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-muted text-sm focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold" />
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
                    className={`flex flex-col gap-1 p-3 rounded-xl border text-left transition-all active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/50 ${opt.className ?? ''}
                      ${isSelected
                        ? isFuneral ? 'bg-neutral-800 border-amber-700/60 text-amber-200' : 'bg-gold/15 border-gold/60 text-gold'
                        : isFuneral ? 'bg-neutral-900/60 border-neutral-700/40 text-neutral-300 hover:bg-neutral-800/60' : 'bg-white/5 border-white/10 text-white hover:bg-white/10'
                      }`}
                  >
                    <span className="text-sm font-semibold">{opt.label}</span>
                    <span className={`text-xs leading-snug ${isSelected ? (isFuneral ? 'text-amber-300/70' : 'text-gold/80') : 'text-muted'}`}>{opt.description}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Variant-specific fields */}
          <VariantFields
            variant={variant}
            goalAmountPesewas={goalAmountPesewas} onGoalAmountChange={setGoalAmountPesewas}
            goalDescription={goalDescription} onGoalDescriptionChange={setGoalDescription}
            targetTerm={targetTerm} onTargetTermChange={setTargetTerm}
            schoolName={schoolName} onSchoolNameChange={setSchoolName}
            baseCurrency={baseCurrency} onBaseCurrencyChange={setBaseCurrency}
            eventName={eventName} onEventNameChange={setEventName}
            eventDate={eventDate} onEventDateChange={setEventDate}
            supplierName={supplierName} onSupplierNameChange={setSupplierName}
            supplierContact={supplierContact} onSupplierContactChange={setSupplierContact}
            itemDescription={itemDescription} onItemDescriptionChange={setItemDescription}
            estimatedSavingsPercent={estimatedSavingsPercent} onEstimatedSavingsChange={setEstimatedSavingsPercent}
            cropType={cropType} onCropTypeChange={setCropType}
            plantingMonth={plantingMonth} onPlantingMonthChange={setPlantingMonth}
            harvestMonth={harvestMonth} onHarvestMonthChange={setHarvestMonth}
            organizationName={organizationName} onOrganizationNameChange={setOrganizationName}
            organizationType={organizationType} onOrganizationTypeChange={setOrganizationType}
          />

          {/* Guarantee Fund toggle */}
          <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-cyan-300 text-xs font-semibold uppercase tracking-wide">Guarantee Fund</p>
                <p className="text-muted text-xs mt-0.5">Protect against member defaults</p>
              </div>
              <button type="button" onClick={() => setGuaranteeEnabled(!guaranteeEnabled)} className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/50 ${guaranteeEnabled ? 'bg-cyan-500' : 'bg-white/20'}`} role="switch" aria-checked={guaranteeEnabled}>
                <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform duration-200 ${guaranteeEnabled ? 'translate-x-[22px]' : 'translate-x-0.5'} mt-0.5`} />
              </button>
            </div>
            {guaranteeEnabled && (
              <div className="space-y-1.5">
                <label className="text-muted text-sm font-medium">Percentage per contribution</label>
                <div className="flex items-center gap-3">
                  <input type="range" min={1} max={5} value={guaranteePercent} onChange={(e) => setGuaranteePercent(parseInt(e.target.value, 10))} className="flex-1 accent-cyan-500" />
                  <span className="text-cyan-300 font-bold text-sm w-8 text-right">{guaranteePercent}%</span>
                </div>
                <p className="text-muted text-xs">{guaranteePercent}% of each contribution goes into a guarantee pool. Unused funds are refunded at cycle end.</p>
              </div>
            )}
          </div>

          {/* Contribution amount */}
          <div className="space-y-1.5">
            <label className="text-muted text-sm font-medium">Contribution Amount</label>
            <AmountInput valuePesewas={contributionPesewas} onChange={setContributionPesewas} placeholder="0.00" required />
          </div>

          {/* Frequency */}
          <div className="space-y-1.5">
            <label htmlFor="group-frequency" className="text-muted text-sm font-medium">Frequency</label>
            <select id="group-frequency" value={frequency} onChange={(e) => setFrequency(e.target.value as SusuFrequency)} className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold appearance-none cursor-pointer">
              <option value="daily" className="bg-ghana-dark">Daily</option>
              <option value="weekly" className="bg-ghana-dark">Weekly</option>
              <option value="monthly" className="bg-ghana-dark">Monthly</option>
            </select>
          </div>

          {/* Max members */}
          <div className="space-y-1.5">
            <label htmlFor="group-max-members" className="text-muted text-sm font-medium">Max Members</label>
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => setMaxMembers((v) => clampMembers(v - 1))} className="w-10 h-10 rounded-lg bg-white/10 border border-white/10 text-white font-bold text-lg hover:bg-white/20 active:scale-95 transition-all flex items-center justify-center shrink-0" aria-label="Decrease max members">{'\u2212'}</button>
              <input id="group-max-members" type="number" min={2} max={50} value={maxMembers} onChange={(e) => setMaxMembers(clampMembers(parseInt(e.target.value, 10) || 2))} className="flex-1 bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-white text-sm text-center font-semibold focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold" />
              <button type="button" onClick={() => setMaxMembers((v) => clampMembers(v + 1))} className="w-10 h-10 rounded-lg bg-white/10 border border-white/10 text-white font-bold text-lg hover:bg-white/20 active:scale-95 transition-all flex items-center justify-center shrink-0" aria-label="Increase max members">+</button>
            </div>
            <p className="text-muted text-xs px-1">Between 2 and 50 members</p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={handleClose} className="flex-1 px-4 py-3 rounded-xl border border-white/20 text-white font-semibold text-sm hover:bg-white/10 active:scale-95 transition-all min-h-[44px]">Cancel</button>
            <button type="submit" disabled={isSubmitDisabled} className="flex-1 px-4 py-3 rounded-xl bg-gold text-ghana-dark font-semibold text-sm hover:brightness-110 active:scale-95 transition-all min-h-[44px] disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100">Create Group</button>
          </div>
        </form>
      </div>
    </div>
  );
}
