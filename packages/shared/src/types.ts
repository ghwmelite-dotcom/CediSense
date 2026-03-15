// User types
export interface User {
  id: string;
  phone: string;
  name: string;
  monthly_income_ghs: number | null;
  preferred_language: 'en' | 'tw' | 'ee' | 'dag';
  onboarding_completed: 0 | 1;
  created_at: string;
  updated_at: string;
}

// Publicly safe user (returned from auth endpoints)
export type PublicUser = Pick<User, 'id' | 'name' | 'phone'>;

// Auth method types
export type AuthMethodType = 'pin' | 'webauthn' | 'otp' | 'google' | 'apple';

export interface AuthMethod {
  id: string;
  user_id: string;
  type: AuthMethodType;
  credential: string; // JSON string
  is_primary: 0 | 1;
  created_at: string;
}

// PIN credential stored as JSON in auth_methods.credential
export interface PinCredential {
  hash: string; // base64
  salt: string; // base64
}

// Account types
export type AccountType = 'momo' | 'bank' | 'cash' | 'susu';

export interface Account {
  id: string;
  user_id: string;
  name: string;
  type: AccountType;
  provider: string | null;
  account_number: string | null;
  balance_pesewas: number;
  is_primary: 0 | 1;
  created_at: string;
}

// API response envelope
export interface ApiSuccess<T> {
  data: T;
  meta?: { total?: number; page?: number; limit?: number };
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

// Auth responses
export interface AuthResponse {
  accessToken: string;
  user: PublicUser;
}

export interface RefreshResponse {
  accessToken: string;
}

// Transaction types
export type TransactionType = 'credit' | 'debit' | 'transfer';
export type TransactionSource = 'sms_import' | 'csv_import' | 'manual';
export type CategorizedBy = 'ai' | 'user' | 'rule';

// Category rule match types
export type MatchType = 'contains' | 'exact' | 'regex';
export type MatchField = 'counterparty' | 'description' | 'provider';

// Category type
export type CategoryType = 'income' | 'expense' | 'transfer';

export interface Category {
  id: string;
  user_id: string | null;
  name: string;
  icon: string | null;
  color: string | null;
  type: CategoryType;
  parent_id: string | null;
  sort_order: number;
  created_at: string;
}

export interface Transaction {
  id: string;
  user_id: string;
  account_id: string;
  category_id: string | null;
  type: TransactionType;
  amount_pesewas: number;
  fee_pesewas: number;
  description: string | null;
  raw_text: string | null;
  counterparty: string | null;
  reference: string | null;
  source: TransactionSource;
  categorized_by: CategorizedBy | null;
  transaction_date: string;
  import_batch_id: string | null;
  created_at: string;
  updated_at: string;
}

// Raw transaction before categorization (from SMS/CSV parsers)
export interface RawTransaction {
  type: TransactionType;
  amount_pesewas: number;
  fee_pesewas: number;
  description: string | null;
  raw_text: string;
  counterparty: string | null;
  reference: string | null;
  balance_after_pesewas: number | null;
  source: TransactionSource;
  transaction_date: string;
  account_id?: string;
  provider?: string;
}

export interface CategoryRule {
  id: string;
  user_id: string;
  match_type: MatchType;
  match_field: MatchField;
  match_value: string;
  category_id: string;
  priority: number;
  created_at: string;
}

export interface CSVFormat {
  provider: string;
  label: string;
  delimiter: string;
  hasHeader: boolean;
  columnMap: {
    date: string;
    description: string;
    amount?: string;
    debit?: string;
    credit?: string;
    reference?: string;
    balance?: string;
  };
  dateFormat: string;
}

export interface SMSPattern {
  id: string;
  provider: string;
  pattern_name: string;
  pattern_regex: string;
  transaction_type: TransactionType;
  field_mapping: string; // JSON string
  sample_sms: string | null;
  is_active: 0 | 1;
  created_at: string;
}

export interface ImportResult {
  batch_id: string;
  total: number;
  imported: number;
  duplicates: number;
  failed: number;
  transactions: RawTransaction[];
}

// ─── Dashboard types ──────────────────────────────────────────────────────────

export interface CategoryBreakdownItem {
  category_id: string;
  name: string;
  icon: string;
  color: string;
  total_pesewas: number;
  transaction_count: number;
  percentage: number;
}

export interface DashboardRecentTransaction {
  id: string;
  account_id: string;
  category_id: string | null;
  type: TransactionType;
  amount_pesewas: number;
  fee_pesewas: number;
  description: string | null;
  counterparty: string | null;
  reference: string | null;
  source: TransactionSource;
  transaction_date: string;
  created_at: string;
  category_name: string | null;
  category_icon: string | null;
  account_name: string;
}

export interface DashboardData {
  month: string;
  accounts: {
    total_balance_pesewas: number;
    items: Array<Pick<Account, 'id' | 'name' | 'type' | 'provider' | 'balance_pesewas'>>;
  };
  summary: {
    total_income_pesewas: number;
    total_expenses_pesewas: number;
    total_fees_pesewas: number;
    transaction_count: number;
  };
  category_breakdown: CategoryBreakdownItem[];
  daily_trend: Array<{
    date: string;
    total_pesewas: number;
  }>;
  recent_transactions: DashboardRecentTransaction[];
}

// ─── Chat types ───────────────────────────────────────────────────────────────

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

export type ChatRole = 'user' | 'assistant';

// ─── Budget types ─────────────────────────────────────────────────────────────

export interface Budget {
  id: string;
  user_id: string;
  category_id: string;
  amount_pesewas: number;
  created_at: string;
  updated_at: string;
}

export type BudgetStatus = 'on_track' | 'warning' | 'exceeded';

export interface BudgetWithSpending extends Budget {
  category_name: string;
  category_icon: string;
  category_color: string;
  spent_pesewas: number;
  percentage: number;
  status: BudgetStatus;
  remaining_pesewas: number;
}

// ─── Savings Goal types ───────────────────────────────────────────────────────

export interface SavingsGoal {
  id: string;
  user_id: string;
  name: string;
  target_pesewas: number;
  current_pesewas: number;
  deadline: string | null;
  created_at: string;
  updated_at: string;
}

export interface SavingsGoalWithProgress extends SavingsGoal {
  percentage: number;
  days_remaining: number | null;
  is_complete: boolean;
}

// ─── Insights types ───────────────────────────────────────────────────────────

export interface MonthSummary {
  total_income_pesewas: number;
  total_expenses_pesewas: number;
  total_fees_pesewas: number;
  transaction_count: number;
}

export interface CategoryTrend {
  category_id: string;
  name: string;
  icon: string;
  color: string;
  current_pesewas: number;
  previous_pesewas: number;
  change_pesewas: number;
  change_percentage: number;
}

export type ChangeDirection = 'up' | 'down' | 'new';

export interface SpendingChange {
  category_name: string;
  icon: string;
  direction: ChangeDirection;
  change_percentage: number;
  current_pesewas: number;
  previous_pesewas: number;
}

export interface InsightsData {
  current_month: string;
  previous_month: string;
  current: MonthSummary;
  previous: MonthSummary;
  category_trends: CategoryTrend[];
  top_changes: SpendingChange[];
}

export interface InsightsReport {
  report: string;
  month: string;
}

// ─── Recurring types ──────────────────────────────────────────────────────────

export type RecurringFrequency = 'weekly' | 'biweekly' | 'monthly';
export type RecurringStatus = 'upcoming' | 'due_soon' | 'overdue';

export interface RecurringTransaction {
  id: string;
  user_id: string;
  counterparty: string;
  category_id: string | null;
  expected_amount_pesewas: number;
  amount_tolerance_percent: number;
  frequency: RecurringFrequency;
  next_due_date: string;
  reminder_days_before: number;
  is_active: boolean;
  last_detected_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface RecurringWithStatus extends RecurringTransaction {
  category_name: string | null;
  category_icon: string | null;
  days_until_due: number;
  status: RecurringStatus;
}

export interface RecurringCandidate {
  id: string;
  counterparty: string;
  category_id: string | null;
  avg_amount_pesewas: number;
  frequency: RecurringFrequency;
  occurrence_count: number;
  last_occurrence_date: string;
}

// ─── IOU types ────────────────────────────────────────────────────────────────

export type IOUDirection = 'owed_to_me' | 'i_owe';

export interface IOU {
  id: string;
  user_id: string;
  person_name: string;
  description: string | null;
  amount_pesewas: number;
  direction: IOUDirection;
  is_settled: boolean;
  transaction_id: string | null;
  settled_at: string | null;
  created_at: string;
}

// ─── Investment types ─────────────────────────────────────────────────────────

export type InvestmentType = 'tbill' | 'mutual_fund' | 'fixed_deposit' | 'other';

export interface Investment {
  id: string;
  user_id: string;
  type: InvestmentType;
  name: string;
  institution: string | null;
  amount_pesewas: number;
  rate_percent: number | null;
  purchase_date: string;
  maturity_date: string | null;
  current_value_pesewas: number | null;
  is_matured: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface InvestmentWithReturns extends Investment {
  expected_return_pesewas: number;
  current_value_computed_pesewas: number;
  days_held: number;
  days_to_maturity: number | null;
}

export interface InvestmentSummary {
  total_invested_pesewas: number;
  total_current_value_pesewas: number;
  total_returns_pesewas: number;
  by_type: Array<{ type: InvestmentType; count: number; total_pesewas: number }>;
}

// ─── Susu types ───────────────────────────────────────────────────────────────

export type SusuFrequency = 'daily' | 'weekly' | 'monthly';

export interface SusuGroup {
  id: string;
  name: string;
  creator_id: string;
  invite_code: string;
  contribution_pesewas: number;
  frequency: SusuFrequency;
  max_members: number;
  current_round: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SusuMember {
  id: string;
  group_id: string;
  user_id: string;
  display_name: string;
  payout_order: number;
  joined_at: string;
}

export interface SusuContribution {
  id: string;
  group_id: string;
  member_id: string;
  round: number;
  amount_pesewas: number;
  contributed_at: string;
}

export interface SusuPayout {
  id: string;
  group_id: string;
  member_id: string;
  round: number;
  amount_pesewas: number;
  paid_at: string;
}

export interface TrustScore {
  score: number;
  total_contributions: number;
  on_time_contributions: number;
  late_contributions: number;
  missed_contributions: number;
  groups_completed: number;
  label: 'Excellent' | 'Good' | 'Fair' | 'Poor';
}

export interface SusuGroupWithDetails extends SusuGroup {
  member_count: number;
  members: Array<SusuMember & { has_contributed_this_round: boolean; trust_score: number; trust_label: string }>;
  payout_recipient: SusuMember | null;
  my_member_id: string | null;
  is_creator: boolean;
}

export interface ContributionReceipt {
  receipt_number: string;
  group_name: string;
  member_name: string;
  round: number;
  total_rounds: number;
  amount_pesewas: number;
  contributed_at: string;
}

// ─── Early Payout types ──────────────────────────────────────────────────────

export type EarlyPayoutStatus = 'pending' | 'approved' | 'denied' | 'paid';

export interface EarlyPayoutRequest {
  id: string;
  group_id: string;
  requester_member_id: string;
  requester_name: string;
  reason: string | null;
  amount_pesewas: number;
  premium_percent: number;
  premium_pesewas: number;
  status: EarlyPayoutStatus;
  votes_for: number;
  votes_against: number;
  votes_needed: number;
  my_vote: 'for' | 'against' | null;
  created_at: string;
}

export interface EarlyPayoutVote {
  id: string;
  member_id: string;
  display_name: string;
  vote: 'for' | 'against';
  voted_at: string;
}
