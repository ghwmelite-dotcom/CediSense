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
