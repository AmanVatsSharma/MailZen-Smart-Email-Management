import { render, screen } from '@testing-library/react';
import { Field } from './field';
import { FormSection } from './form-section';

describe('Field', () => {
  it('renders label and associates with input via htmlFor', () => {
    render(
      <Field label="Email" htmlFor="email-input">
        <input id="email-input" type="email" />
      </Field>
    );
    const label = screen.getByText('Email');
    expect(label).toHaveAttribute('for', 'email-input');
  });

  it('renders required indicator when required=true', () => {
    render(
      <Field label="Password" htmlFor="pwd" required>
        <input id="pwd" type="password" />
      </Field>
    );
    expect(screen.getByText('*')).toBeInTheDocument();
  });

  it('shows error with role=alert and aria-describedby on input', () => {
    render(
      <Field label="Email" htmlFor="email-input" error="Invalid email">
        <input id="email-input" type="email" />
      </Field>
    );
    const errorEl = screen.getByRole('alert');
    expect(errorEl).toHaveTextContent('Invalid email');
    expect(errorEl).toHaveAttribute('id');
    const errorId = errorEl.getAttribute('id');
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-describedby', errorId);
  });

  it('shows description with aria-describedby when no error', () => {
    render(
      <Field label="Bio" htmlFor="bio" description="Tell us about yourself">
        <input id="bio" />
      </Field>
    );
    const descEl = screen.getByText('Tell us about yourself');
    const descId = descEl.getAttribute('id');
    expect(screen.getByLabelText('Bio')).toHaveAttribute('aria-describedby', descId);
  });
});

describe('FormSection', () => {
  it('renders title and description', () => {
    render(
      <FormSection
        title="Profile"
        description="Public information"
      >
        <div>content</div>
      </FormSection>
    );
    expect(screen.getByText('Profile')).toBeInTheDocument();
    expect(screen.getByText('Public information')).toBeInTheDocument();
  });
});
