// User types
export type UserRole = 'user' | 'admin' | 'superadmin';

export interface User {
  id: string;
  phone: string;
  name: string;
  email: string | null;
  country_code: string | null;
  monthly_income_ghs: number | null;
  preferred_language: 'en' | 'tw' | 'ee' | 'dag';
  onboarding_completed: 0 | 1;
  role: UserRole;
  is_active: 0 | 1;
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
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
    cursor?: string | null;
    has_more?: boolean;
  };
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

export type SusuVariant = 'rotating' | 'accumulating' | 'goal_based' | 'bidding' | 'funeral_fund' | 'school_fees' | 'diaspora' | 'event_fund' | 'bulk_purchase' | 'agricultural' | 'welfare';

export type DiasporaCurrency = 'GHS' | 'GBP' | 'USD' | 'EUR' | 'CAD';

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
  variant: SusuVariant;
  goal_amount_pesewas: number | null;
  goal_description: string | null;
  penalty_percent: number;
  penalty_pool_pesewas: number;
  // School Fees fields
  target_term: string | null;
  school_name: string | null;
  // Diaspora fields
  base_currency: DiasporaCurrency | null;
  // Event Fund fields
  event_name: string | null;
  event_date: string | null;
  // Guarantee Fund fields
  guarantee_percent: number;
  guarantee_pool_pesewas: number;
  // Bulk Purchase fields
  supplier_name: string | null;
  supplier_contact: string | null;
  item_description: string | null;
  estimated_savings_percent: number | null;
  // Agricultural fields
  crop_type: string | null;
  planting_month: number | null;
  harvest_month: number | null;
  // Welfare fields
  organization_name: string | null;
  organization_type: 'church' | 'mosque' | 'community' | 'other' | null;
  created_at: string;
  updated_at: string;
}

export interface SusuPenalty {
  id: string;
  group_id: string;
  member_id: string;
  member_name?: string;
  round: number;
  penalty_pesewas: number;
  reason: string;
  created_at: string;
}

export interface SusuMember {
  id: string;
  group_id: string;
  user_id: string;
  display_name: string;
  payout_order: number;
  pre_paid: boolean;
  joined_at: string;
}

export interface SusuContribution {
  id: string;
  group_id: string;
  member_id: string;
  round: number;
  amount_pesewas: number;
  contributed_at: string;
  // Diaspora currency fields
  original_currency: DiasporaCurrency | null;
  original_amount: number | null;
  exchange_rate: number | null;
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

export interface SusuGoalProgress {
  total_contributed_pesewas: number;
  goal_amount_pesewas: number;
  goal_description: string | null;
  percentage: number;
  is_complete: boolean;
}

export interface SusuAccumulatingInfo {
  total_pool_pesewas: number;
  your_share_pesewas: number;
}

// ─── Funeral Fund types ──────────────────────────────────────────────────────

export type FuneralClaimStatus = 'pending' | 'approved' | 'paid' | 'denied';

export interface FuneralClaim {
  id: string;
  group_id: string;
  claimant_member_id: string;
  claimant_name: string;
  deceased_name: string;
  relationship: string;
  description: string | null;
  amount_pesewas: number;
  status: FuneralClaimStatus;
  approved_by_count: number;
  denied_by_count: number;
  approval_threshold: number;
  my_vote: 'approve' | 'deny' | null;
  created_at: string;
}

export interface FuneralFundInfo {
  total_pool_pesewas: number;
  total_paid_out_pesewas: number;
  available_pool_pesewas: number;
}

export interface SchoolFeesInfo {
  target_term: string;
  school_name: string | null;
  next_payout_date: string;
  days_until_payout: number;
  required_weekly_pesewas: number;
  required_monthly_pesewas: number;
}

export interface DiasporaInfo {
  base_currency: DiasporaCurrency;
  contributions_with_currency: Array<{
    member_name: string;
    amount_pesewas: number;
    original_currency: DiasporaCurrency;
    original_amount: number;
    exchange_rate: number;
    contributed_at: string;
  }>;
}

export interface EventFundInfo {
  event_name: string;
  event_date: string | null;
  target_amount_pesewas: number;
  total_contributed_pesewas: number;
  percentage: number;
  days_until_event: number | null;
  contributors: Array<{
    member_name: string;
    amount_pesewas: number;
    contributed_at: string;
  }>;
}

export interface GuaranteeClaim {
  id: string;
  group_id: string;
  defaulting_member_id: string;
  defaulting_member_name?: string;
  round: number;
  covered_amount_pesewas: number;
  created_at: string;
}

export interface BulkPurchaseInfo {
  total_pool_pesewas: number;
  per_member_share_pesewas: number;
  supplier_name: string | null;
  supplier_contact: string | null;
  item_description: string | null;
  estimated_savings_percent: number | null;
}

// ─── Agricultural types ──────────────────────────────────────────────────────

export type AgriculturalPhase = 'planting' | 'growing' | 'harvest';

export interface AgriculturalInfo {
  crop_type: string;
  planting_month: number;
  harvest_month: number;
  current_phase: AgriculturalPhase;
  days_to_next_phase: number;
  recommended_contribution_schedule: string;
}

// ─── Welfare types ───────────────────────────────────────────────────────────

export type WelfareClaimType = 'medical' | 'funeral' | 'education' | 'emergency' | 'other';
export type WelfareClaimStatus = 'pending' | 'approved' | 'partially_approved' | 'denied' | 'paid';
export type WelfareOrganizationType = 'church' | 'mosque' | 'community' | 'other';

export interface WelfareClaim {
  id: string;
  group_id: string;
  claimant_member_id: string;
  claimant_name: string;
  claim_type: WelfareClaimType;
  description: string;
  amount_requested_pesewas: number;
  amount_approved_pesewas: number | null;
  status: WelfareClaimStatus;
  approved_by: string | null;
  created_at: string;
  resolved_at: string | null;
}

export interface WelfareInfo {
  organization_name: string;
  organization_type: WelfareOrganizationType;
  total_pool_pesewas: number;
  total_paid_out_pesewas: number;
  available_pool_pesewas: number;
  pending_claims: WelfareClaim[];
  resolved_claims: WelfareClaim[];
}

export interface SusuGroupWithDetails extends SusuGroup {
  member_count: number;
  members: Array<SusuMember & { has_contributed_this_round: boolean; trust_score: number; trust_label: string }>;
  payout_recipient: SusuMember | null;
  my_member_id: string | null;
  is_creator: boolean;
  goal_progress: SusuGoalProgress | null;
  accumulating_info: SusuAccumulatingInfo | null;
  funeral_fund_info: FuneralFundInfo | null;
  funeral_claim: FuneralClaim | null;
  school_fees_info: SchoolFeesInfo | null;
  diaspora_info: DiasporaInfo | null;
  event_fund_info: EventFundInfo | null;
  guarantee_claims: GuaranteeClaim[];
  bulk_purchase_info: BulkPurchaseInfo | null;
  agricultural_info: AgriculturalInfo | null;
  welfare_info: WelfareInfo | null;
  unread_count: number;
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

// ─── Susu Analytics types ─────────────────────────────────────────────────────

export interface SusuAnalytics {
  total_contributed_pesewas: number;
  total_payouts_pesewas: number;
  penalty_pool_pesewas: number;
  contribution_rate: number;
  on_time_rate: number;
  rounds_completed: number;
  total_rounds: number;
  projected_completion_date: string | null;
  per_round: Array<{
    round: number;
    total_pesewas: number;
    contributions: number;
    expected: number;
  }>;
  per_member: Array<{
    member_name: string;
    contributions: number;
    on_time: number;
    total_pesewas: number;
  }>;
}

// ─── Susu Chat types ──────────────────────────────────────────────────────────

export interface SusuMessage {
  id: string;
  content: string;
  sender_name: string;
  sender_user_id: string;
  created_at: string;
  reply_to_id: string | null;
  reply_to_content: string | null;
  reply_to_sender: string | null;
  edited_at: string | null;
  is_deleted: boolean;
  reactions: Array<{ emoji: string; count: number; reacted_by_me: boolean }>;
  read_by_count: number;
  attachment_url: string | null;
  attachment_type: string | null;
  attachment_name: string | null;
  attachment_size: number | null;
  mentions: string[]; // array of user_ids mentioned in message
}

export interface PinnedMessage {
  id: string;
  message_id: string;
  group_id: string;
  pinned_by: string;
  pinned_by_name: string;
  message_content: string;
  message_sender: string;
  pinned_at: string;
}

export interface TypingUser {
  member_id: string;
  display_name: string;
}

// ─── Gamification types ───────────────────────────────────────────────────────

export type BadgeType =
  | 'first_contribution'
  | 'first_payout'
  | 'perfect_round'
  | 'streak_5'
  | 'streak_10'
  | 'streak_20'
  | 'group_founder'
  | 'group_completed';

export interface SusuBadge {
  id: string;
  badge_type: BadgeType;
  badge_name: string;
  earned_at: string;
}

export interface LeaderboardEntry {
  member_name: string;
  trust_score: number;
  current_streak: number;
  total_contributions: number;
  badges_count: number;
}

// ─── Micro-Credit Certificate types ─────────────────────────────────────────

// ─── Collector types ─────────────────────────────────────────────────────────

export interface CollectorProfile {
  user_id: string;
  business_name: string;
  market_area: string | null;
  commission_days: number;
  is_active: boolean;
  total_clients: number;
  created_at: string;
}

export interface CollectorClient {
  id: string;
  collector_id: string;
  client_name: string;
  client_phone: string | null;
  daily_amount_pesewas: number;
  cycle_days: number;
  current_cycle_start: string;
  is_active: boolean;
  deposits_this_cycle: number;
  total_deposited_this_cycle_pesewas: number;
  days_remaining: number;
}

export interface CollectorDeposit {
  id: string;
  client_id: string;
  amount_pesewas: number;
  deposit_date: string;
}

export interface CollectorDashboard {
  profile: CollectorProfile;
  clients: CollectorClient[];
  today_collections: number;
  today_amount_pesewas: number;
  cycle_total_pesewas: number;
}

// ─── Micro-Credit Certificate types ─────────────────────────────────────────

export interface CreditCertificate {
  certificate_id: string;
  user_name: string;
  user_phone: string;
  generated_at: string;
  trust_score: number;
  trust_label: string;
  total_groups_participated: number;
  total_groups_completed: number;
  total_contributed_pesewas: number;
  total_contributions: number;
  on_time_rate: number;
  current_streak: number;
  longest_streak: number;
  member_since: string;
  badges_earned: string[];
  summary: string;
}
