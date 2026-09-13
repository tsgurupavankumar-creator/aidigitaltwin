import { z } from 'zod';

export const studentLoginSchema = z.object({
  rollNumber: z.string().min(1),
  dob: z.string().min(1),
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
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string().min(1, 'Please confirm password'),
}).refine((d) => d.password === d.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

export const facultySignupSchema = z.object({
  fullName: z.string().min(1, 'Full name is required'),
  facultyId: z.string().min(1, 'Faculty ID is required'),
  department: z.string().min(1, 'Department is required'),
  email: z.string().email('Invalid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string().min(1, 'Please confirm password'),
}).refine((d) => d.password === d.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});