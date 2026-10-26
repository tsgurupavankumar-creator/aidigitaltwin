import { z } from 'zod';
import { validatePasswordStrength } from '@/lib/auth/password';

// Same rules as the signup form and the reset-password route (8+ characters with
// lowercase, uppercase, a digit and a special character). Signup used to enforce
// only 6 characters on the server, so anyone calling the API directly could create
// an account with a password like "123456".
const strongPassword = z.string().superRefine((value, ctx) => {
  const { valid, errors } = validatePasswordStrength(value);
  if (!valid) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Password must include: ${errors.join(', ')}` });
  }
});

export const studentLoginSchema = z.object({
  rollNumber: z.string().min(1),
  dob: z.string().min(1),
  password: z.string().min(1),
});

export const facultyLoginSchema = z.object({
  facultyId: z.string().min(1),
  password: z.string().min(1),
});

export const studentSignupSchema = z.object({
  fullName: z.string().min(1, 'Full name is required'),
  rollNumber: z.string().min(1, 'Roll number is required'),
  email: z.string().email('Invalid email'),
  dob: z.string().min(1, 'Date of birth is required'),
  password: strongPassword,
  confirmPassword: z.string().min(1, 'Please confirm password'),
}).refine((d) => d.password === d.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

export const facultyAddStudentSchema = z.object({
  fullName: z.string().trim().min(1, 'Full name is required').max(120),
  rollNumber: z.string().trim().min(1, 'Roll number is required').max(50).transform((value) => value.toUpperCase()),
  dob: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date of birth must be a valid date')
    .refine((value) => {
      const date = new Date(`${value}T00:00:00.000Z`);
      return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
    }, 'Date of birth must be a valid date')
    .refine((value) => value <= new Date().toISOString().slice(0, 10), 'Date of birth cannot be in the future'),
  email: z.string().trim().email('Enter a valid email address').max(254).transform((value) => value.toLowerCase()),
  department: z.string().trim().min(1, 'Department is required').max(100),
  year: z.number().int().min(1).max(8),
  semester: z.number().int().min(1).max(12),
  section: z.string().trim().min(1, 'Section is required').max(20),
  courseId: z.string().trim().min(1, 'Course is required').max(100),
});

export const facultySignupSchema = z.object({
  fullName: z.string().min(1, 'Full name is required'),
  facultyId: z.string().min(1, 'Faculty ID is required'),
  department: z.string().min(1, 'Department is required'),
  email: z.string().email('Invalid email'),
  password: strongPassword,
  confirmPassword: z.string().min(1, 'Please confirm password'),
}).refine((d) => d.password === d.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

export const requestPasswordResetSchema = z.object({
  email: z.string().email('Enter a valid email address'),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string().min(1, 'Please confirm password'),
}).refine((d) => d.password === d.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});