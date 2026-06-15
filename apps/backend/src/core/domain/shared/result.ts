// apps/backend/src/core/domain/shared/result.ts
// Discriminated-union Result. Replaces throw-based control flow at boundaries.
// Pure, no framework imports.

export class UnwrapError extends Error {
  constructor() { super('Called unwrap on a failed Result'); this.name = 'UnwrapError'; }
}

/**
 * Result is implemented as a class that carries the chainable prototype
 * methods (isOk, isErr, map, unwrap, …) directly. The `ok` discriminant is
 * preserved as a property so existing narrowing with `if (r.ok)` keeps
 * working.
 *
 * The original prototype-with-this-binding design failed under tsc 5.7+ with
 * `strictNullChecks: true` because the implementation signature uses generic
 * `this: Result<unknown, Error>` which the type checker refuses to narrow
 * with a `this is { ... }` predicate. The class-with-methods approach is the
 * simplest fix that preserves both ergonomics (`r.isOk()`, `r.value`) and
 * the original public API.
 */
export class Result<T, E extends Error = Error> {
  /** Discriminant: true for ok, false for err. */
  readonly ok: boolean;
  private readonly _value?: T;
  private readonly _error?: E;

  private constructor(ok: boolean, value: T | undefined, error: E | undefined) {
    this.ok = ok;
    this._value = value;
    this._error = error;
  }

  /** The success value. Throws UnwrapError if accessed on an err result. */
  get value(): T {
    if (!this.ok) throw new UnwrapError();
    return this._value as T;
  }

  /** The error. Throws UnwrapError if accessed on an ok result. */
  get error(): E {
    if (this.ok) throw new UnwrapError();
    return this._error as E;
  }

  isOk(): this is { ok: true; value: T } { return this.ok; }
  isErr(): this is { ok: false; error: E } { return !this.ok; }

  map<U>(fn: (v: T) => U): Result<U, E> {
    return this.ok
      ? Result.ok(fn(this._value as T))
      : (this as unknown as Result<U, E>);
  }

  mapErr<F extends Error>(fn: (e: E) => F): Result<T, F> {
    return this.ok
      ? (this as unknown as Result<T, F>)
      : Result.err(fn(this._error as E));
  }

  unwrap(): T {
    if (!this.ok) throw new UnwrapError();
    return this._value as T;
  }

  unwrapOr(defaultValue: T): T {
    return this.ok ? (this._value as T) : defaultValue;
  }

  tap(fn: (v: T) => void): Result<T, E> {
    if (this.ok) fn(this._value as T);
    return this;
  }

  tapErr(fn: (e: E) => void): Result<T, E> {
    if (!this.ok) fn(this._error as E);
    return this;
  }

  // Constructors
  static ok<T>(value: T): Result<T, never> {
    return new Result<T, never>(true, value, undefined);
  }

  static err<E extends Error>(error: E): Result<never, E> {
    return new Result<never, E>(false, undefined, error);
  }

  static from<T>(fn: () => T): Result<T, Error> {
    try { return Result.ok(fn()); } catch (e) { return Result.err(e as Error); }
  }

  static async fromPromise<T>(p: Promise<T>): Promise<Result<T, Error>> {
    try { return Result.ok(await p); } catch (e) { return Result.err(e as Error); }
  }
}
