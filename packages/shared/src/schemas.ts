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
  balance_ghs: z.number().min(0).default(0),
  is_primary: z.boolean().default(false),
});

export const updateAccountSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  balance_ghs: z.number().min(0).optional(),
  is_primary: z.boolean().optional(),
});

// Inferred types for request bodies
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type CreateAccountInput = z.infer<typeof createAccountSchema>;
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;
