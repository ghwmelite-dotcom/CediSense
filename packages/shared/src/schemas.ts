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
  phone: z.string().regex(ghanaPhoneRegex, 'Invalid Ghana phone number'),
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  pin: pinSchema,
});

export const loginSchema = z.object({
  phone: z.string().regex(ghanaPhoneRegex, 'Invalid Ghana phone number'),
  pin: z.string().regex(/^\d{4}$/, 'PIN must be 4 digits'),
});

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
