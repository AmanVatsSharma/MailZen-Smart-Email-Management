import { ReactNode } from 'react';
import { cn } from '@/lib/tokens/cn';

type FormSectionProps = {
  title: string;
  description?: string;
  className?: string;
  children: ReactNode;
};

export function FormSection({ title, description, className, children }: FormSectionProps) {
  return (
    <section className={cn('space-y-4', className)}>
      <div className="space-y-1">
        <h3 className="text-lg font-semibold">{title}</h3>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}