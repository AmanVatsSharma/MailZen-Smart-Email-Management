import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

/**
 * Custom hook to create a form with Zod validation
 * @param schema Zod schema for form validation
 * @param defaultValues Default values for the form
 * @returns React Hook Form methods and state
 */
export function useZodForm<TSchema extends z.ZodType>(
  schema: TSchema,
  defaultValues?: z.infer<TSchema>
) {
  return useForm<z.infer<TSchema>>({
    resolver: zodResolver(schema),
    defaultValues,
  });
}

/**
 * Common validation schemas
 */
export const validationSchemas = {
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  required: z.string().min(1, 'This field is required'),
  phone: z.string().regex(/^\+?[0-9]{10,15}$/, 'Please enter a valid phone number'),
  url: z.string().url('Please enter a valid URL'),
};

/**
 * Helper to get form error message
 * @param error Form error object
 * @returns Error message as string
 */
export function getFormErrorMessage(error?: { message?: string }) {
  return error?.message || 'This field is invalid';
}
