/**
 * Financial Calculation Utilities
 *
 * JavaScript floating-point arithmetic is not safe for monetary values
 * (e.g. 0.1 + 0.2 === 0.30000000000000004). All financial computations
 * MUST pass through these helpers to ensure deterministic rounding.
 *
 * Strategy: round to the nearest cent (2 decimal places) after every
 * arithmetic step. This avoids accumulated drift across multi-step
 * calculations (subtotal -> discount -> tax -> total).
 */

/**
 * Round a monetary amount to 2 decimal places (cents).
 * FIX (F003): Implements true banker's rounding (round half to even),
 * which rounds 0.5 to the nearest even number to eliminate systematic bias.
 * Math.round(0.5) returns 1 (always rounds up), but banker's rounding
 * returns 0 (rounds to nearest even). This prevents cumulative rounding
 * errors across thousands of financial transactions.
 */
export function roundCurrency(amount: number): number {
  const shifted = amount * 100;
  const truncated = Math.trunc(shifted);
  const remainder = Math.abs(shifted - truncated);

  // If exactly at 0.5, round to nearest even (banker's rounding)
  if (Math.abs(remainder - 0.5) < 1e-10) {
    // If truncated is even, keep it; if odd, round away from zero
    if (truncated % 2 === 0) {
      return truncated / 100;
    }
    return (truncated + (shifted > 0 ? 1 : -1)) / 100;
  }

  // For all other cases, use standard rounding
  return Math.round(shifted) / 100;
}

/**
 * Calculate tax amount from a subtotal and a tax rate, rounded to the cent.
 */
export function calculateTax(subtotal: number, rate: number): number {
  return roundCurrency(subtotal * rate);
}

/**
 * Multiply price by quantity and round to the cent.
 */
export function lineTotal(price: number, quantity: number): number {
  return roundCurrency(price * quantity);
}

/**
 * Sum an array of monetary values, rounding the result.
 */
export function sumCurrency(values: number[]): number {
  return roundCurrency(values.reduce((acc, v) => acc + v, 0));
}

/**
 * Safely subtract b from a, rounded to the cent.
 */
export function subtractCurrency(a: number, b: number): number {
  return roundCurrency(a - b);
}

/**
 * Convert a Prisma Decimal field (returned as Decimal | string | number)
 * to a properly rounded JS number. Prisma Decimal fields are often returned
 * as Decimal objects that need explicit conversion.
 */
export function fromDecimal(value: unknown): number {
  if (value === null || value === undefined) return 0;
  const num = Number(value);
  return isNaN(num) ? 0 : roundCurrency(num);
}

/**
 * Convert a monetary amount in dollars to integer cents for payment
 * processors (Stripe, PayPal) that expect amounts in the smallest
 * currency unit.
 */
export function toCents(amount: number): number {
  return Math.round(amount * 100);
}

/**
 * Convert integer cents back to a dollar amount.
 */
export function fromCents(cents: number): number {
  return roundCurrency(cents / 100);
}

/**
 * Apply a percentage discount to a subtotal. Returns the discount amount.
 */
export function percentageDiscount(subtotal: number, percentOff: number): number {
  return roundCurrency(subtotal * (percentOff / 100));
}

/**
 * Compare two monetary amounts for equality within 1-cent tolerance.
 * Useful for balance checks where floating point drift may have occurred.
 */
export function amountsEqual(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.01;
}
