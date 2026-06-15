import { render } from '@testing-library/react';
import { ArrowRight } from 'lucide-react';
import { DirectionalIcon } from '../directional-icon';
import { useDirection } from '@/lib/hooks/useDirection';

describe('DirectionalIcon', () => {
  it('renders the icon without flip in LTR', () => {
    document.documentElement.dir = 'ltr';
    const { container } = render(<DirectionalIcon Icon={ArrowRight} className="h-4 w-4" />);
    const icon = container.querySelector('svg')!;
    expect(icon).toBeInTheDocument();
    expect(icon.className.baseVal).not.toMatch(/scale-x-\[-1\]/);
  });

  it('applies scale-x-[-1] in RTL', () => {
    document.documentElement.dir = 'rtl';
    const { container } = render(<DirectionalIcon Icon={ArrowRight} className="h-4 w-4" />);
    const icon = container.querySelector('svg')!;
    expect(icon.className.baseVal).toMatch(/scale-x-\[-1\]/);
    document.documentElement.dir = 'ltr';
  });
});

describe('useDirection', () => {
  it('returns ltr by default', () => {
    document.documentElement.dir = 'ltr';
    const { result, unmount } = renderHook();
    expect(result.current).toBe('ltr');
    unmount();
  });

  it('returns rtl when documentElement.dir is rtl', () => {
    document.documentElement.dir = 'rtl';
    const { result, unmount } = renderHook();
    expect(result.current).toBe('rtl');
    document.documentElement.dir = 'ltr';
    unmount();
  });
});

import { renderHook as rtlRenderHook } from '@testing-library/react';
function renderHook() {
  return rtlRenderHook(() => useDirection());
}
