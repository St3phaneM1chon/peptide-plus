import { useState, useCallback } from 'react';

export interface DiscountCodeState {
  /** The input code value */
  code: string;
  /** The discount amount applied */
  discount: number;
  /** The code that was successfully applied (null if none) */
  appliedCode: string | null;
  /** Error message from validation */
  error: string;
  /** Whether validation is in progress */
  loading: boolean;
}

export interface DiscountCodeActions {
  /** Update the input code value */
  setCode: (code: string) => void;
  /** Apply the code (calls the validate function) */
  apply: () => Promise<void>;
  /** Remove the applied code and reset state */
  remove: () => void;
}

interface UseDiscountCodeOptions {
  /** Async function that validates the code and returns { valid, discount, code?, error? } */
  validateFn: (code: string) => Promise<{
    valid: boolean;
    discount: number;
    code?: string;
    error?: string;
  }>;
  /** Called on successful application */
  onSuccess?: (code: string, discount: number) => void;
  /** Called on validation failure */
  onError?: (error: string) => void;
  /** Called on network/unexpected error */
  onFail?: () => void;
  /** Default error message when validation returns invalid */
  defaultErrorMessage?: string;
  /** Default error message for network failures */
  failureErrorMessage?: string;
}

/**
 * Reusable hook for managing promo code / gift card / discount code state.
 * Eliminates duplication between promo and gift card logic in checkout.
 */
export function useDiscountCode({
  validateFn,
  onSuccess,
  onError,
  onFail,
  defaultErrorMessage = 'Invalid code',
  failureErrorMessage = 'Validation failed',
}: UseDiscountCodeOptions): [DiscountCodeState, DiscountCodeActions] {
  const [code, setCode] = useState('');
  const [discount, setDiscount] = useState(0);
  const [appliedCode, setAppliedCode] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const apply = useCallback(async () => {
    if (!code.trim()) return;

    setLoading(true);
    setError('');

    try {
      const result = await validateFn(code);

      if (result.valid) {
        setDiscount(result.discount);
        setAppliedCode(result.code || code);
        setError('');
        onSuccess?.(result.code || code, result.discount);
      } else {
        setError(result.error || defaultErrorMessage);
        setDiscount(0);
        setAppliedCode(null);
        onError?.(result.error || defaultErrorMessage);
      }
    } catch {
      setError(failureErrorMessage);
      onFail?.();
    } finally {
      setLoading(false);
    }
  }, [code, validateFn, onSuccess, onError, onFail, defaultErrorMessage, failureErrorMessage]);

  const remove = useCallback(() => {
    setCode('');
    setDiscount(0);
    setAppliedCode(null);
    setError('');
  }, []);

  const state: DiscountCodeState = {
    code,
    discount,
    appliedCode,
    error,
    loading,
  };

  const actions: DiscountCodeActions = {
    setCode,
    apply,
    remove,
  };

  return [state, actions];
}
