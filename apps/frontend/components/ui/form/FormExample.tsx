'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { z } from 'zod';
import { useZodForm, validationSchemas, getFormErrorMessage } from '@/lib/utils/form-utils';
import { useState } from 'react';

// Define the form schema using Zod
const formSchema = z.object({
  email: validationSchemas.email,
  password: validationSchemas.password,
});

// Infer the form values type from the schema
type FormValues = z.infer<typeof formSchema>;

export function FormExample() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formResult, setFormResult] = useState<string | null>(null);

  // Initialize the form with our Zod schema
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useZodForm(formSchema, {
    email: '',
    password: '',
  });

  // Handle form submission
  const onSubmit = async (data: FormValues) => {
    setIsSubmitting(true);

    try {
      // In a real application, you would call your API here
      console.warn('Form data:', data);

      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));

      setFormResult('Form submitted successfully!');
      reset();
    } catch (error) {
      console.error('Error submitting form:', error);
      setFormResult('An error occurred while submitting the form.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-md">
      <div>
        <h2 className="text-2xl font-bold">Sample Form</h2>
        <p className="text-muted-foreground">Example using React Hook Form with Zod validation</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="email" className="text-sm font-medium">
            Email
          </label>
          <Input
            id="email"
            type="email"
            placeholder="your.email@example.com"
            {...register('email')}
            aria-invalid={!!errors.email}
          />
          {errors.email && (
            <p className="text-sm text-red-500">{getFormErrorMessage(errors.email)}</p>
          )}
        </div>

        <div className="space-y-2">
          <label htmlFor="password" className="text-sm font-medium">
            Password
          </label>
          <Input
            id="password"
            type="password"
            placeholder="••••••••"
            {...register('password')}
            aria-invalid={!!errors.password}
          />
          {errors.password && (
            <p className="text-sm text-red-500">{getFormErrorMessage(errors.password)}</p>
          )}
        </div>

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? 'Submitting...' : 'Submit'}
        </Button>
      </form>

      {formResult && (
        <div
          className={`p-4 rounded-md ${formResult.includes('error') ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}
        >
          {formResult}
        </div>
      )}
    </div>
  );
}
