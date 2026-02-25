/**
 * Fraud Detection Engine
 * Risk scoring based on address mismatch, order velocity, suspicious patterns
 */

export interface FraudSignal {
  type: string;
  score: number; // 0-100
  description: string;
}

export interface FraudResult {
  riskScore: number; // 0-100
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  signals: FraudSignal[];
  recommendation: 'APPROVE' | 'REVIEW' | 'DECLINE';
}

interface OrderData {
  userId: string;
  email: string;
  total: number;
  shippingCountry: string;
  billingCountry?: string;
  shippingAddress: string;
  billingAddress?: string;
  ipAddress?: string;
  previousOrders?: number;
  orderTimestamp: Date;
  recentOrderCount?: number; // orders in last 24h
  paymentMethod?: string;
}

export function assessFraudRisk(order: OrderData): FraudResult {
  const signals: FraudSignal[] = [];

  // 1. Address mismatch
  if (order.billingCountry && order.billingCountry !== order.shippingCountry) {
    signals.push({ type: 'ADDRESS_COUNTRY_MISMATCH', score: 25, description: `Shipping: ${order.shippingCountry}, Billing: ${order.billingCountry}` });
  }
  if (order.billingAddress && order.shippingAddress && order.billingAddress !== order.shippingAddress && !order.billingCountry) {
    signals.push({ type: 'ADDRESS_MISMATCH', score: 10, description: 'Billing and shipping addresses differ' });
  }

  // 2. Order velocity (many orders in short time)
  if (order.recentOrderCount && order.recentOrderCount > 3) {
    signals.push({ type: 'HIGH_VELOCITY', score: 30, description: `${order.recentOrderCount} orders in 24h` });
  } else if (order.recentOrderCount && order.recentOrderCount > 1) {
    signals.push({ type: 'MODERATE_VELOCITY', score: 10, description: `${order.recentOrderCount} orders in 24h` });
  }

  // 3. High-value first order
  if (order.previousOrders === 0 && order.total > 500) {
    signals.push({ type: 'HIGH_VALUE_FIRST_ORDER', score: 20, description: `First order: $${order.total.toFixed(2)}` });
  }

  // 4. Very high order value
  if (order.total > 2000) {
    signals.push({ type: 'VERY_HIGH_VALUE', score: 15, description: `Order total: $${order.total.toFixed(2)}` });
  }

  // 5. New account (no previous orders)
  if (order.previousOrders === 0) {
    signals.push({ type: 'NEW_CUSTOMER', score: 5, description: 'First-time buyer' });
  }

  // 6. Unusual hours (2AM-5AM local)
  const hour = order.orderTimestamp.getHours();
  if (hour >= 2 && hour <= 5) {
    signals.push({ type: 'ODD_HOURS', score: 5, description: `Order placed at ${hour}:00` });
  }

  // Calculate total risk score
  const riskScore = Math.min(100, signals.reduce((sum, s) => sum + s.score, 0));

  // Determine risk level and recommendation
  let riskLevel: FraudResult['riskLevel'];
  let recommendation: FraudResult['recommendation'];

  if (riskScore >= 60) {
    riskLevel = 'CRITICAL';
    recommendation = 'DECLINE';
  } else if (riskScore >= 40) {
    riskLevel = 'HIGH';
    recommendation = 'REVIEW';
  } else if (riskScore >= 20) {
    riskLevel = 'MEDIUM';
    recommendation = 'REVIEW';
  } else {
    riskLevel = 'LOW';
    recommendation = 'APPROVE';
  }

  return { riskScore, riskLevel, signals, recommendation };
}
