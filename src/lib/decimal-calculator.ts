/**
 * Safe financial calculations using Decimal.js
 *
 * All monetary arithmetic MUST go through these helpers to avoid
 * floating-point rounding errors (e.g. 0.1 + 0.2 !== 0.3).
 *
 * Prisma Decimal fields are safely converted via Decimal constructor.
 */

import Decimal from 'decimal.js';

// Configure for financial precision: 20 significant digits, ROUND_HALF_UP
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

// ---------------------------------------------------------------------------
// Core arithmetic
// ---------------------------------------------------------------------------

/** Multiply two values and round to 2 decimal places */
export function multiply(a: number | string | Decimal, b: number | string | Decimal): number {
  return new Decimal(a).times(new Decimal(b)).toDecimalPlaces(2).toNumber();
}

/** Add values and round to 2 decimal places */
export function add(...values: (number | string | Decimal)[]): number {
  let sum = new Decimal(0);
  for (const v of values) {
    sum = sum.plus(new Decimal(v));
  }
  return sum.toDecimalPlaces(2).toNumber();
}

/** Subtract b from a, rounded to 2 decimal places */
export function subtract(a: number | string | Decimal, b: number | string | Decimal): number {
  return new Decimal(a).minus(new Decimal(b)).toDecimalPlaces(2).toNumber();
}

/** Divide a by b, rounded to 2 decimal places */
export function divide(a: number | string | Decimal, b: number | string | Decimal): number {
  return new Decimal(a).dividedBy(new Decimal(b)).toDecimalPlaces(2).toNumber();
}

// ---------------------------------------------------------------------------
// Financial helpers
// ---------------------------------------------------------------------------

/** Calculate percentage: amount * (rate / 100), rounded to 2 dp */
export function percentage(amount: number | string | Decimal, rate: number | string | Decimal): number {
  return new Decimal(amount)
    .times(new Decimal(rate).dividedBy(100))
    .toDecimalPlaces(2)
    .toNumber();
}

/** Apply a tax rate (0.05 = 5%) to a subtotal, rounded to 2 dp */
export function applyRate(subtotal: number | string | Decimal, rate: number | string | Decimal): number {
  return new Decimal(subtotal).times(new Decimal(rate)).toDecimalPlaces(2).toNumber();
}

/** Convert an amount using an exchange rate, rounded to 2 dp */
export function convertCurrency(amount: number | string | Decimal, exchangeRate: number | string | Decimal): number {
  return new Decimal(amount).times(new Decimal(exchangeRate)).toDecimalPlaces(2).toNumber();
}

/** Convert a monetary amount to Stripe cents (integer) */
export function toCents(amount: number | string | Decimal): number {
  return new Decimal(amount).times(100).round().toNumber();
}

/** Calculate discount ratio and apply proportionally, returning the discount amount in cents */
export function proportionalDiscount(
  originalCents: number,
  totalDiscount: number | string | Decimal,
  subtotal: number | string | Decimal,
): number {
  const ratio = new Decimal(totalDiscount).dividedBy(new Decimal(subtotal));
  return new Decimal(originalCents).times(ratio).round().toNumber();
}

/** Clamp a value: max(0, min(value, cap)) */
export function clamp(value: number | string | Decimal, cap: number | string | Decimal): number {
  const v = new Decimal(value);
  const c = new Decimal(cap);
  if (v.lessThan(0)) return 0;
  return v.greaterThan(c) ? c.toDecimalPlaces(2).toNumber() : v.toDecimalPlaces(2).toNumber();
}
