// lib/types/async-state.ts
export type EmptyReason = 'no-data' | 'no-results' | 'no-access' | 'coming-soon';

export type AsyncState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T[] }
  | { status: 'empty'; reason?: EmptyReason }
  | { status: 'error'; error: Error };
