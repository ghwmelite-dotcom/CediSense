import { z } from 'zod';

// Ghana phone: 02X, 03X, 04X, 05X (covers MTN, Vodafone, AirtelTigo, all networks)
export const ghanaPhoneRegex = /^0[2-5]\d{8}$/;

// Weak PINs blocklist (sequential, repeated, common patterns)
const WEAK_PINS = new Set([
  '0000', '1111', '2222', '3333', '4444', '5555', '6666', '7777', '8888', '9999',
  '1234', '4321', '0123', '3210', '1212', '2580',
]);

export const pinSchema = z.string()
  .regex(/^\d{4}$/, 'PIN must be 4 digits')
  .refine(pin => !WEAK_PINS.has(pin), 'PIN is too common. Choose a stronger PIN.');

export const registerSchema = z.object({
  phone: z.string().min(8, 'Phone number too short').max(15, 'Phone number too long'),
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  pin: pinSchema,
  email: z.string().email('Invalid email address').optional(),
  country_code: z.string().regex(/^\+\d{1,4}$/, 'Invalid country code').optional(),
});

export const loginSchema = z.object({
  phone: z.string().min(4).max(100).optional(),
  email: z.string().email().optional(),
  pin: z.string().regex(/^\d{4}$/, 'PIN must be 4 digits'),
}).refine(
  (data) => data.phone || data.email,
  { message: 'Either phone or email is required', path: ['phone'] }
);

export const updateUserSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  monthly_income_ghs: z.number().min(0).optional(),
  preferred_language: z.enum(['en', 'tw', 'ee', 'dag']).optional(),
});

export const createAccountSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(['momo', 'bank', 'cash', 'susu']),
  provider: z.string().max(50).optional(),
  account_number: z.string().max(20).optional(),
  balance_pesewas: z.number().int().min(0).default(0),
  is_primary: z.boolean().default(false),
});

export const updateAccountSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  balance_pesewas: z.number().int().min(0).optional(),
  is_primary: z.boolean().optional(),
});

// Inferred types for request bodies
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type CreateAccountInput = z.infer<typeof createAccountSchema>;
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;

// ─── Transaction schemas ───────────────────────────────────────────────────

export const createTransactionSchema = z.object({
  account_id: z.string().min(1),
  category_id: z.string().optional(),
  type: z.enum(['credit', 'debit', 'transfer']),
  amount_pesewas: z.number().int().positive(),
  fee_pesewas: z.number().int().min(0).default(0),
  description: z.string().max(500).optional(),
  counterparty: z.string().max(200).optional(),
  reference: z.string().max(100).optional(),
  source: z.enum(['sms_import', 'csv_import', 'manual']),
  transaction_date: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
});

export const updateTransactionSchema = z.object({
  category_id: z.string().nullable().optional(),
  description: z.string().max(500).optional(),
  counterparty: z.string().max(200).optional(),
});

// ─── Import schemas ─────────────────────────────────────────────────────────

export const importSmsSchema = z.object({
  messages: z.array(
    z.object({
      body: z.string().min(1),
      sender: z.string().min(1),
      timestamp: z.string(),
    })
  ).min(1).max(500),
  account_id: z.string().min(1),
});

export const importCsvSchema = z.object({
  account_id: z.string().min(1),
  format: z.enum(['mtn_momo', 'gcb', 'ecobank', 'stanbic', 'absa', 'generic']),
  csv_data: z.string().min(1),
});

export const importConfirmSchema = z.object({
  batch_id: z.string().min(1),
  overrides: z.array(
    z.object({
      index: z.number().int().min(0),
      category_id: z.string().optional(),
      description: z.string().optional(),
    })
  ).optional(),
});

// ─── Category schemas ────────────────────────────────────────────────────────

export const createCategorySchema = z.object({
  name: z.string().min(1).max(100),
  icon: z.string().max(10).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  type: z.enum(['income', 'expense', 'transfer']),
  parent_id: z.string().optional(),
  sort_order: z.number().int().min(0).default(0),
});

export const updateCategorySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  icon: z.string().max(10).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  sort_order: z.number().int().min(0).optional(),
});

// ─── Category Rule schemas ───────────────────────────────────────────────────

export const createCategoryRuleSchema = z.object({
  match_type: z.enum(['contains', 'exact', 'regex']),
  match_field: z.enum(['counterparty', 'description', 'provider']),
  match_value: z.string().min(1).max(200),
  category_id: z.string().min(1),
  priority: z.number().int().min(0).default(0),
});

// ─── Query schemas ───────────────────────────────────────────────────────────

export const transactionQuerySchema = z.object({
  account_id: z.string().optional(),
  category_id: z.string().optional(),
  type: z.enum(['credit', 'debit', 'transfer']).optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// Inferred types for new schemas
export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>;
export type ImportSmsInput = z.infer<typeof importSmsSchema>;
export type ImportCsvInput = z.infer<typeof importCsvSchema>;
export type ImportConfirmInput = z.infer<typeof importConfirmSchema>;
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
export type CreateCategoryRuleInput = z.infer<typeof createCategoryRuleSchema>;
export type TransactionQueryInput = z.infer<typeof transactionQuerySchema>;

// ─── Dashboard schema ────────────────────────────────────────────────────────

export const dashboardQuerySchema = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Month must be YYYY-MM format').optional(),
});

export type DashboardQueryInput = z.infer<typeof dashboardQuerySchema>;

// ─── Chat schemas ─────────────────────────────────────────────────────────────

export const chatMessageSchema = z.object({
  message: z.string().min(1, 'Message cannot be empty').max(500, 'Message too long (max 500 characters)'),
});

export const chatHistoryQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  before: z.string().optional(),
});

export type ChatMessageInput = z.infer<typeof chatMessageSchema>;
export type ChatHistoryQueryInput = z.infer<typeof chatHistoryQuerySchema>;

// ─── Budget schemas ───────────────────────────────────────────────────────────

export const createBudgetSchema = z.object({
  category_id: z.string().min(1),
  amount_pesewas: z.number().int().positive(),
});

export const updateBudgetSchema = z.object({
  amount_pesewas: z.number().int().positive(),
});

// ─── Goal schemas ─────────────────────────────────────────────────────────────

export const createGoalSchema = z.object({
  name: z.string().min(1).max(100),
  target_pesewas: z.number().int().positive(),
  deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(
    (d) => new Date(d + 'T00:00:00') >= new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00'),
    'Deadline must be today or later'
  ).optional(),
});

export const updateGoalSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  target_pesewas: z.number().int().positive().optional(),
  deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
});

export const contributeSchema = z.object({
  amount_pesewas: z.number().int().positive(),
});

export type CreateBudgetInput = z.infer<typeof createBudgetSchema>;
export type UpdateBudgetInput = z.infer<typeof updateBudgetSchema>;
export type CreateGoalInput = z.infer<typeof createGoalSchema>;
export type UpdateGoalInput = z.infer<typeof updateGoalSchema>;
export type ContributeInput = z.infer<typeof contributeSchema>;

// ─── Insights schema ──────────────────────────────────────────────────────────

export const insightsQuerySchema = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).optional(),
});

export type InsightsQueryInput = z.infer<typeof insightsQuerySchema>;

// ─── Recurring schemas ────────────────────────────────────────────────────────

export const confirmCandidateSchema = z.object({
  reminder_days_before: z.number().int().min(0).max(14).default(3),
});

export const updateRecurringSchema = z.object({
  expected_amount_pesewas: z.number().int().positive().optional(),
  frequency: z.enum(['weekly', 'biweekly', 'monthly']).optional(),
  reminder_days_before: z.number().int().min(0).max(14).optional(),
  next_due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(
    (d) => new Date(d + 'T00:00:00') >= new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00'),
    'Due date must be today or later'
  ).optional(),
  is_active: z.boolean().optional(),
});

export type ConfirmCandidateInput = z.infer<typeof confirmCandidateSchema>;
export type UpdateRecurringInput = z.infer<typeof updateRecurringSchema>;

// ─── IOU schemas ──────────────────────────────────────────────────────────────

export const createIOUSchema = z.object({
  person_name: z.string().min(1).max(100),
  amount_pesewas: z.number().int().positive(),
  direction: z.enum(['owed_to_me', 'i_owe']),
  description: z.string().max(200).optional(),
  transaction_id: z.string().optional(),
});

export type CreateIOUInput = z.infer<typeof createIOUSchema>;

// ─── Investment schemas ───────────────────────────────────────────────────────

export const createInvestmentSchema = z.object({
  type: z.enum(['tbill', 'mutual_fund', 'fixed_deposit', 'other']),
  name: z.string().min(1).max(100),
  institution: z.string().max(100).optional(),
  amount_pesewas: z.number().int().positive(),
  rate_percent: z.number().min(0).max(100).optional(),
  purchase_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  maturity_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  current_value_pesewas: z.number().int().positive().optional(),
  notes: z.string().max(500).optional(),
});

export const updateInvestmentSchema = z.object({
  current_value_pesewas: z.number().int().positive().optional(),
  maturity_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  notes: z.string().max(500).optional(),
});

export type CreateInvestmentInput = z.infer<typeof createInvestmentSchema>;
export type UpdateInvestmentInput = z.infer<typeof updateInvestmentSchema>;

// ─── Susu schemas ─────────────────────────────────────────────────────────────

export const SUSU_VARIANTS = ['rotating', 'accumulating', 'goal_based', 'bidding', 'funeral_fund', 'school_fees', 'diaspora', 'event_fund', 'bulk_purchase', 'agricultural', 'welfare'] as const;
export const DIASPORA_CURRENCIES = ['GHS', 'GBP', 'USD', 'EUR', 'CAD'] as const;

export const createSusuGroupSchema = z.object({
  name: z.string().min(1).max(100),
  contribution_pesewas: z.number().int().positive(),
  frequency: z.enum(['daily', 'weekly', 'monthly']),
  max_members: z.number().int().min(2).max(50).default(12),
  variant: z.enum(SUSU_VARIANTS).default('rotating'),
  goal_amount_pesewas: z.number().int().positive().optional(),
  goal_description: z.string().max(200).optional(),
  // School Fees fields
  target_term: z.string().optional(),
  school_name: z.string().max(200).optional(),
  // Diaspora fields
  base_currency: z.enum(DIASPORA_CURRENCIES).optional(),
  // Event Fund fields
  event_name: z.string().max(200).optional(),
  event_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  // Guarantee Fund fields (any variant)
  guarantee_percent: z.number().int().min(0).max(10).default(0),
  // Bulk Purchase fields
  supplier_name: z.string().max(200).optional(),
  supplier_contact: z.string().max(200).optional(),
  item_description: z.string().max(500).optional(),
  estimated_savings_percent: z.number().int().min(0).max(100).optional(),
  // Agricultural fields
  crop_type: z.string().max(100).optional(),
  planting_month: z.number().int().min(1).max(12).optional(),
  harvest_month: z.number().int().min(1).max(12).optional(),
  // Welfare fields
  organization_name: z.string().max(200).optional(),
  organization_type: z.enum(['church', 'mosque', 'community', 'other']).optional(),
  // Migration support — for groups already in progress offline
  starting_round: z.number().int().min(1).max(50).optional(),
}).refine(
  (data) => data.variant !== 'goal_based' || data.goal_amount_pesewas !== undefined,
  { message: 'goal_amount_pesewas is required for goal_based variant', path: ['goal_amount_pesewas'] }
).refine(
  (data) => data.variant !== 'event_fund' || data.event_name !== undefined,
  { message: 'event_name is required for event_fund variant', path: ['event_name'] }
).refine(
  (data) => data.variant !== 'bulk_purchase' || data.supplier_name !== undefined,
  { message: 'supplier_name is required for bulk_purchase variant', path: ['supplier_name'] }
).refine(
  (data) => data.variant !== 'agricultural' || (data.crop_type !== undefined && data.planting_month !== undefined && data.harvest_month !== undefined),
  { message: 'crop_type, planting_month, and harvest_month are required for agricultural variant', path: ['crop_type'] }
).refine(
  (data) => data.variant !== 'welfare' || (data.organization_name !== undefined && data.organization_type !== undefined),
  { message: 'organization_name and organization_type are required for welfare variant', path: ['organization_name'] }
);

export const joinSusuGroupSchema = z.object({
  invite_code: z.string().min(1),
});

export const recordContributionSchema = z.object({
  member_id: z.string().min(1),
  amount_pesewas: z.number().int().positive(),
  is_late: z.boolean().optional(),
  // Diaspora currency fields
  original_currency: z.enum(DIASPORA_CURRENCIES).optional(),
  original_amount: z.number().int().positive().optional(),
  exchange_rate: z.number().positive().optional(),
});

export const updateSusuGroupSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  contribution_pesewas: z.number().int().positive().optional(),
  frequency: z.enum(['daily', 'weekly', 'monthly']).optional(),
  max_members: z.number().int().min(2).max(50).optional(),
  is_active: z.boolean().optional(),
});

export const reorderSusuMembersSchema = z.object({
  order: z.array(z.string().min(1)).min(1),
});

export type CreateSusuGroupInput = z.infer<typeof createSusuGroupSchema>;
export type JoinSusuGroupInput = z.infer<typeof joinSusuGroupSchema>;
export type RecordContributionInput = z.infer<typeof recordContributionSchema>;
export type UpdateSusuGroupInput = z.infer<typeof updateSusuGroupSchema>;
export type ReorderSusuMembersInput = z.infer<typeof reorderSusuMembersSchema>;

// ─── Early Payout schemas ─────────────────────────────────────────────────────

export const earlyPayoutRequestSchema = z.object({
  reason: z.string().max(200).optional(),
});

export const earlyPayoutVoteSchema = z.object({
  vote: z.enum(['for', 'against']),
});

export type EarlyPayoutRequestInput = z.infer<typeof earlyPayoutRequestSchema>;
export type EarlyPayoutVoteInput = z.infer<typeof earlyPayoutVoteSchema>;

// ─── Susu Chat schemas ────────────────────────────────────────────────────────

export const susuMessageSchema = z.object({
  content: z.string().min(1).max(500),
  reply_to_id: z.string().optional(),
});

export const messageReactionSchema = z.object({
  emoji: z.string().min(1).max(4),
});

export const editMessageSchema = z.object({
  content: z.string().min(1).max(500),
});

export const pinMessageSchema = z.object({
  message_id: z.string().min(1),
});

export type SusuMessageInput = z.infer<typeof susuMessageSchema>;
export type MessageReactionInput = z.infer<typeof messageReactionSchema>;
export type EditMessageInput = z.infer<typeof editMessageSchema>;
export type PinMessageInput = z.infer<typeof pinMessageSchema>;

// ─── Funeral Fund schemas ────────────────────────────────────────────────────

export const funeralClaimSchema = z.object({
  deceased_name: z.string().min(1).max(100),
  relationship: z.string().min(1).max(50),
  description: z.string().max(500).optional(),
});

export const funeralClaimVoteSchema = z.object({
  vote: z.enum(['approve', 'deny']),
});

export type FuneralClaimInput = z.infer<typeof funeralClaimSchema>;
export type FuneralClaimVoteInput = z.infer<typeof funeralClaimVoteSchema>;

// ─── Guarantee Fund schemas ─────────────────────────────────────────────────

export const guaranteeClaimSchema = z.object({
  defaulting_member_id: z.string().min(1),
  round: z.number().int().positive(),
  covered_amount_pesewas: z.number().int().positive(),
});

export type GuaranteeClaimInput = z.infer<typeof guaranteeClaimSchema>;

// ─── Welfare Claim schemas ──────────────────────────────────────────────────

export const welfareClaimSchema = z.object({
  claim_type: z.enum(['medical', 'funeral', 'education', 'emergency', 'other']),
  description: z.string().min(1).max(500),
  amount_requested_pesewas: z.number().int().positive(),
});

export const welfareClaimApproveSchema = z.object({
  amount_approved_pesewas: z.number().int().positive().optional(),
});

export type WelfareClaimInput = z.infer<typeof welfareClaimSchema>;
export type WelfareClaimApproveInput = z.infer<typeof welfareClaimApproveSchema>;

// ─── Collector schemas ──────────────────────────────────────────────────────

export const createCollectorProfileSchema = z.object({
  business_name: z.string().min(1).max(100),
  market_area: z.string().max(100).optional(),
  commission_days: z.number().int().min(1).max(5).default(1),
});

export const addCollectorClientSchema = z.object({
  client_name: z.string().min(1).max(100),
  client_phone: z.string().optional(),
  daily_amount_pesewas: z.number().int().positive(),
  cycle_days: z.number().int().min(7).max(60).default(30),
});

export const recordDepositSchema = z.object({
  amount_pesewas: z.number().int().positive(),
  deposit_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const updateCollectorClientSchema = z.object({
  client_name: z.string().min(1).max(100).optional(),
  client_phone: z.string().optional(),
  daily_amount_pesewas: z.number().int().positive().optional(),
  cycle_days: z.number().int().min(7).max(60).optional(),
  is_active: z.boolean().optional(),
});

export type CreateCollectorProfileInput = z.infer<typeof createCollectorProfileSchema>;
export type AddCollectorClientInput = z.infer<typeof addCollectorClientSchema>;
export type RecordDepositInput = z.infer<typeof recordDepositSchema>;
export type UpdateCollectorClientInput = z.infer<typeof updateCollectorClientSchema>;

// ─── Admin schemas ─────────────────────────────────────────────────────────

export const adminPinResetSchema = z.object({
  pin: pinSchema,
});

export const adminRoleChangeSchema = z.object({
  role: z.enum(['user', 'admin', 'superadmin']),
});

export type AdminPinResetInput = z.infer<typeof adminPinResetSchema>;
export type AdminRoleChangeInput = z.infer<typeof adminRoleChangeSchema>;

// ─── Notification schemas ──────────────────────────────────────────────────

// Notification schemas
export {
  notificationTypeSchema,
  notificationReferenceTypeSchema,
  notificationPreferencesSchema,
  pushSubscriptionSchema,
  notificationQuerySchema,
} from './notification-types.js';

export type {
  NotificationType,
  NotificationReferenceType,
  Notification,
  NotificationPreferences,
  PushSubscriptionPayload,
  NotificationEvent,
} from './notification-types.js';
