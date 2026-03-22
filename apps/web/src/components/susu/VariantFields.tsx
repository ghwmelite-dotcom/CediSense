import type { SusuVariant, DiasporaCurrency } from '@cedisense/shared';
import { AmountInput } from '@/components/transactions/AmountInput';
import type { WelfareOrganizationType } from '@cedisense/shared';

const CURRENCY_OPTIONS: { value: DiasporaCurrency; label: string; symbol: string }[] = [
  { value: 'GHS', label: 'Ghana Cedi', symbol: '\u20B5' },
  { value: 'GBP', label: 'British Pound', symbol: '\u00A3' },
  { value: 'USD', label: 'US Dollar', symbol: '$' },
  { value: 'EUR', label: 'Euro', symbol: '\u20AC' },
  { value: 'CAD', label: 'Canadian Dollar', symbol: 'CA$' },
];

const CROP_OPTIONS: { value: string; label: string; plantMonth: number; harvestMonth: number }[] = [
  { value: 'Cocoa', label: 'Cocoa', plantMonth: 4, harvestMonth: 10 },
  { value: 'Maize', label: 'Maize (Major)', plantMonth: 3, harvestMonth: 7 },
  { value: 'Rice', label: 'Rice', plantMonth: 5, harvestMonth: 9 },
  { value: 'Cassava', label: 'Cassava', plantMonth: 3, harvestMonth: 3 },
  { value: 'Other', label: 'Other', plantMonth: 1, harvestMonth: 6 },
];

const ORG_TYPE_OPTIONS: { value: WelfareOrganizationType; label: string; icon: string }[] = [
  { value: 'church', label: 'Church', icon: '\u26EA' },
  { value: 'mosque', label: 'Mosque', icon: '\uD83D\uDD4C' },
  { value: 'community', label: 'Community', icon: '\uD83C\uDFD8\uFE0F' },
  { value: 'other', label: 'Other', icon: '\uD83C\uDFE2' },
];

const TERM_OPTIONS = [
  { value: 'Term 1', label: 'Term 1 (Sep\u2013Dec)', payout: 'Payout: August' },
  { value: 'Term 2', label: 'Term 2 (Jan\u2013Apr)', payout: 'Payout: December' },
  { value: 'Term 3', label: 'Term 3 (May\u2013Jul)', payout: 'Payout: March' },
];

interface VariantFieldsProps {
  variant: SusuVariant;
  // Goal-based
  goalAmountPesewas: number;
  onGoalAmountChange: (v: number) => void;
  goalDescription: string;
  onGoalDescriptionChange: (v: string) => void;
  // School fees
  targetTerm: string;
  onTargetTermChange: (v: string) => void;
  schoolName: string;
  onSchoolNameChange: (v: string) => void;
  // Diaspora
  baseCurrency: DiasporaCurrency;
  onBaseCurrencyChange: (v: DiasporaCurrency) => void;
  // Event fund
  eventName: string;
  onEventNameChange: (v: string) => void;
  eventDate: string;
  onEventDateChange: (v: string) => void;
  // Bulk purchase
  supplierName: string;
  onSupplierNameChange: (v: string) => void;
  supplierContact: string;
  onSupplierContactChange: (v: string) => void;
  itemDescription: string;
  onItemDescriptionChange: (v: string) => void;
  estimatedSavingsPercent: number;
  onEstimatedSavingsChange: (v: number) => void;
  // Agricultural
  cropType: string;
  onCropTypeChange: (v: string) => void;
  plantingMonth: number;
  onPlantingMonthChange: (v: number) => void;
  harvestMonth: number;
  onHarvestMonthChange: (v: number) => void;
  // Welfare
  organizationName: string;
  onOrganizationNameChange: (v: string) => void;
  organizationType: WelfareOrganizationType;
  onOrganizationTypeChange: (v: WelfareOrganizationType) => void;
}

export function VariantFields({
  variant,
  goalAmountPesewas, onGoalAmountChange,
  goalDescription, onGoalDescriptionChange,
  targetTerm, onTargetTermChange,
  schoolName, onSchoolNameChange,
  baseCurrency, onBaseCurrencyChange,
  eventName, onEventNameChange,
  eventDate, onEventDateChange,
  supplierName, onSupplierNameChange,
  supplierContact, onSupplierContactChange,
  itemDescription, onItemDescriptionChange,
  estimatedSavingsPercent, onEstimatedSavingsChange,
  cropType, onCropTypeChange,
  plantingMonth, onPlantingMonthChange,
  harvestMonth, onHarvestMonthChange,
  organizationName, onOrganizationNameChange,
  organizationType, onOrganizationTypeChange,
}: VariantFieldsProps) {
  return (
    <>
      {/* Goal-based fields */}
      {variant === 'goal_based' && (
        <div className="space-y-3 rounded-xl border border-gold/20 bg-gold/5 p-4">
          <p className="text-gold text-xs font-semibold uppercase tracking-wide">Goal Settings</p>
          <div className="space-y-1.5">
            <label className="text-muted text-sm font-medium">Goal Amount</label>
            <AmountInput valuePesewas={goalAmountPesewas} onChange={onGoalAmountChange} placeholder="0.00" required />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="goal-description" className="text-muted text-sm font-medium">
              Goal Description <span className="text-muted/60">(optional)</span>
            </label>
            <input
              id="goal-description"
              type="text"
              value={goalDescription}
              onChange={(e) => onGoalDescriptionChange(e.target.value)}
              placeholder="e.g. Buy a shared bus"
              maxLength={200}
              className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-muted text-sm focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold"
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
                  onClick={() => onTargetTermChange(term.value)}
                  className={`w-full flex items-center justify-between p-3 rounded-xl border text-left transition-all active:scale-95
                    ${targetTerm === term.value
                      ? 'bg-blue-500/15 border-blue-500/60 text-blue-300'
                      : 'bg-white/5 border-white/10 text-white hover:bg-white/10'
                    }`}
                >
                  <span className="text-sm font-semibold">{term.label}</span>
                  <span className={`text-xs ${targetTerm === term.value ? 'text-blue-300/70' : 'text-muted'}`}>{term.payout}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-muted text-sm font-medium">School Name <span className="text-muted/60">(optional)</span></label>
            <input
              type="text"
              value={schoolName}
              onChange={(e) => onSchoolNameChange(e.target.value)}
              placeholder="e.g. Accra Academy"
              maxLength={200}
              className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-muted text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-muted text-sm font-medium">Target Amount (fees)</label>
            <AmountInput valuePesewas={goalAmountPesewas} onChange={onGoalAmountChange} placeholder="0.00" />
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
                  onClick={() => onBaseCurrencyChange(cur.value)}
                  className={`flex flex-col items-center gap-0.5 p-2.5 rounded-xl border text-center transition-all active:scale-95
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
              onChange={(e) => onEventNameChange(e.target.value)}
              placeholder="e.g. Kwame & Ama's Wedding"
              maxLength={200}
              required
              className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-muted text-sm focus:outline-none focus:ring-2 focus:ring-pink-500/50 focus:border-pink-500"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-muted text-sm font-medium">Event Date <span className="text-muted/60">(optional)</span></label>
            <input
              type="date"
              value={eventDate}
              onChange={(e) => onEventDateChange(e.target.value)}
              className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-pink-500/50 focus:border-pink-500 [color-scheme:dark]"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-muted text-sm font-medium">Target Amount <span className="text-muted/60">(optional)</span></label>
            <AmountInput valuePesewas={goalAmountPesewas} onChange={onGoalAmountChange} placeholder="0.00" />
          </div>
          <p className="text-muted text-xs">Contributions can be any amount -- no fixed minimums for event funds.</p>
        </div>
      )}

      {/* Bulk Purchase fields */}
      {variant === 'bulk_purchase' && (
        <div className="space-y-3 rounded-xl border border-orange-500/20 bg-orange-500/5 p-4">
          <p className="text-orange-300 text-xs font-semibold uppercase tracking-wide">Bulk Purchase Settings</p>
          <div className="space-y-1.5">
            <label className="text-muted text-sm font-medium">Supplier Name</label>
            <input type="text" value={supplierName} onChange={(e) => onSupplierNameChange(e.target.value)} placeholder="e.g. Makola Wholesale Ltd" maxLength={200} required className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-muted text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500" />
          </div>
          <div className="space-y-1.5">
            <label className="text-muted text-sm font-medium">Supplier Contact <span className="text-muted/60">(optional)</span></label>
            <input type="text" value={supplierContact} onChange={(e) => onSupplierContactChange(e.target.value)} placeholder="e.g. 024 123 4567" maxLength={200} className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-muted text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500" />
          </div>
          <div className="space-y-1.5">
            <label className="text-muted text-sm font-medium">Item Description <span className="text-muted/60">(optional)</span></label>
            <input type="text" value={itemDescription} onChange={(e) => onItemDescriptionChange(e.target.value)} placeholder="e.g. 100 bags of rice" maxLength={500} className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-muted text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500" />
          </div>
          <div className="space-y-1.5">
            <label className="text-muted text-sm font-medium">Estimated Savings <span className="text-muted/60">(% off retail)</span></label>
            <div className="flex items-center gap-3">
              <input type="range" min={0} max={50} value={estimatedSavingsPercent} onChange={(e) => onEstimatedSavingsChange(parseInt(e.target.value, 10))} className="flex-1 accent-orange-500" />
              <span className="text-orange-300 font-bold text-sm w-10 text-right">{estimatedSavingsPercent}%</span>
            </div>
          </div>
        </div>
      )}

      {/* Agricultural fields */}
      {variant === 'agricultural' && (
        <div className="space-y-3 rounded-xl border border-green-600/20 bg-green-600/5 p-4">
          <p className="text-green-300 text-xs font-semibold uppercase tracking-wide">Agricultural Settings</p>
          <div className="space-y-1.5">
            <label className="text-muted text-sm font-medium">Crop Type</label>
            <div className="space-y-2">
              {CROP_OPTIONS.map((crop) => (
                <button
                  key={crop.value}
                  type="button"
                  onClick={() => {
                    onCropTypeChange(crop.value);
                    onPlantingMonthChange(crop.plantMonth);
                    onHarvestMonthChange(crop.harvestMonth);
                  }}
                  className={`w-full flex items-center justify-between p-3 rounded-xl border text-left transition-all active:scale-95
                    ${cropType === crop.value ? 'bg-green-600/15 border-green-500/60 text-green-300' : 'bg-white/5 border-white/10 text-white hover:bg-white/10'}`}
                >
                  <span className="text-sm font-semibold">{crop.label}</span>
                  <span className={`text-xs ${cropType === crop.value ? 'text-green-300/70' : 'text-muted'}`}>
                    Plant: {new Date(2024, crop.plantMonth - 1).toLocaleString('en', { month: 'short' })} | Harvest: {new Date(2024, crop.harvestMonth - 1).toLocaleString('en', { month: 'short' })}
                  </span>
                </button>
              ))}
            </div>
          </div>
          {cropType === 'Other' && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-muted text-sm font-medium">Planting Month</label>
                <select value={plantingMonth} onChange={(e) => onPlantingMonthChange(parseInt(e.target.value, 10))} className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500 appearance-none cursor-pointer">
                  {Array.from({ length: 12 }, (_, i) => (
                    <option key={i + 1} value={i + 1} className="bg-ghana-dark">{new Date(2024, i).toLocaleString('en', { month: 'long' })}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-muted text-sm font-medium">Harvest Month</label>
                <select value={harvestMonth} onChange={(e) => onHarvestMonthChange(parseInt(e.target.value, 10))} className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500 appearance-none cursor-pointer">
                  {Array.from({ length: 12 }, (_, i) => (
                    <option key={i + 1} value={i + 1} className="bg-ghana-dark">{new Date(2024, i).toLocaleString('en', { month: 'long' })}</option>
                  ))}
                </select>
              </div>
            </div>
          )}
          <p className="text-muted text-xs">Contributions collected during harvest season. Payouts during planting when capital is needed.</p>
        </div>
      )}

      {/* Welfare fields */}
      {variant === 'welfare' && (
        <div className="space-y-3 rounded-xl border border-violet-500/20 bg-violet-500/5 p-4">
          <p className="text-violet-300 text-xs font-semibold uppercase tracking-wide">Welfare Settings</p>
          <div className="space-y-1.5">
            <label className="text-muted text-sm font-medium">Organization Name</label>
            <input type="text" value={organizationName} onChange={(e) => onOrganizationNameChange(e.target.value)} placeholder="e.g. Grace Baptist Church" maxLength={200} required className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-muted text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500" />
          </div>
          <div className="space-y-1.5">
            <label className="text-muted text-sm font-medium">Organization Type</label>
            <div className="grid grid-cols-2 gap-2">
              {ORG_TYPE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onOrganizationTypeChange(opt.value)}
                  className={`flex items-center gap-2 p-3 rounded-xl border text-left transition-all active:scale-95
                    ${organizationType === opt.value ? 'bg-violet-500/15 border-violet-500/60 text-violet-300' : 'bg-white/5 border-white/10 text-white hover:bg-white/10'}`}
                >
                  <span className="text-lg">{opt.icon}</span>
                  <span className="text-sm font-semibold">{opt.label}</span>
                </button>
              ))}
            </div>
          </div>
          <p className="text-muted text-xs">Welfare funds accumulate from contributions. Members submit claims for medical, funeral, education, or emergency needs.</p>
        </div>
      )}
    </>
  );
}
