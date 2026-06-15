import { render, act } from '@testing-library/react';
import { MotionProvider } from './motion-provider';

describe('MotionProvider', () => {
  let listeners: Array<(e: { matches: boolean }) => void> = [];
  let currentMatches = false;

  const mockMatchMedia = (matches: boolean) => {
    listeners = [];
    currentMatches = matches;
    window.matchMedia = jest.fn().mockImplementation((query: string) => ({
      matches: currentMatches,
      media: query,
      onchange: null,
      addEventListener: (_: string, cb: (e: { matches: boolean }) => void) => {
        listeners.push(cb);
      },
      removeEventListener: (_: string, cb: (e: { matches: boolean }) => void) => {
        listeners = listeners.filter((l) => l !== cb);
      },
      dispatchEvent: jest.fn(),
    }));
  };

  beforeEach(() => {
    document.body.dataset.reducedMotion = undefined as unknown as string;
  });

  it('sets data-reduced-motion=true when prefers-reduced-motion matches', () => {
    mockMatchMedia(true);
    render(<MotionProvider><div /></MotionProvider>);
    expect(document.body.dataset.reducedMotion).toBe('true');
  });

  it('sets data-reduced-motion=false when prefers-reduced-motion does not match', () => {
    mockMatchMedia(false);
    render(<MotionProvider><div /></MotionProvider>);
    expect(document.body.dataset.reducedMotion).toBe('false');
  });

  it('updates data-reduced-motion when the OS setting changes', () => {
    let dispatch: (matches: boolean) => void = () => {};
    window.matchMedia = jest.fn().mockImplementation((query: string) => {
      const listeners: Array<(e: { matches: boolean }) => void> = [];
      let matches = false;
      dispatch = (m: boolean) => {
        matches = m;
        listeners.forEach((l) => l({ matches }));
      };
      return {
        get matches() {
          return matches;
        },
        media: query,
        onchange: null,
        addEventListener: (_: string, cb: (e: { matches: boolean }) => void) => {
          listeners.push(cb);
        },
        removeEventListener: (_: string, cb: (e: { matches: boolean }) => void) => {
          const i = listeners.indexOf(cb);
          if (i >= 0) listeners.splice(i, 1);
        },
        dispatchEvent: jest.fn(),
      };
    });

    render(<MotionProvider><div /></MotionProvider>);
    expect(document.body.dataset.reducedMotion).toBe('false');

    act(() => {
      dispatch(true);
    });
    expect(document.body.dataset.reducedMotion).toBe('true');
  });
});
