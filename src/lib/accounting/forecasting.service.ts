/**
 * Financial Forecasting Service
 * Cash flow projections, revenue forecasting, and scenario analysis
 */

/* For future use with actual historical data
interface HistoricalData {
  date: Date;
  revenue: number;
  expenses: number;
  cashBalance: number;
}
*/

interface Forecast {
  date: Date;
  projectedRevenue: number;
  projectedExpenses: number;
  projectedCashBalance: number;
  confidence: number;
  range: { min: number; max: number };
}

interface CashFlowProjection {
  period: string;
  openingBalance: number;
  inflows: {
    sales: number;
    otherIncome: number;
    total: number;
  };
  outflows: {
    purchases: number;
    payroll: number;
    rent: number;
    utilities: number;
    marketing: number;
    taxes: number;
    other: number;
    total: number;
  };
  netCashFlow: number;
  closingBalance: number;
  isProjected: boolean;
}

interface ScenarioResult {
  scenario: string;
  assumptions: Record<string, number>;
  projections: CashFlowProjection[];
  summary: {
    totalRevenue: number;
    totalExpenses: number;
    netProfit: number;
    finalCashBalance: number;
    lowestCashPoint: number;
    lowestCashDate: string;
  };
}

/**
 * Simple linear regression for trend analysis
 */
function linearRegression(data: number[]): { slope: number; intercept: number; r2: number } {
  const n = data.length;
  if (n < 2) return { slope: 0, intercept: data[0] || 0, r2: 0 };

  const xMean = (n - 1) / 2;
  const yMean = data.reduce((a, b) => a + b, 0) / n;

  let numerator = 0;
  let denominator = 0;
  let ssRes = 0;
  let ssTot = 0;

  for (let i = 0; i < n; i++) {
    const xDiff = i - xMean;
    const yDiff = data[i] - yMean;
    numerator += xDiff * yDiff;
    denominator += xDiff * xDiff;
  }

  const slope = denominator !== 0 ? numerator / denominator : 0;
  const intercept = yMean - slope * xMean;

  // Calculate R²
  for (let i = 0; i < n; i++) {
    const predicted = slope * i + intercept;
    ssRes += Math.pow(data[i] - predicted, 2);
    ssTot += Math.pow(data[i] - yMean, 2);
  }

  const r2 = ssTot !== 0 ? 1 - (ssRes / ssTot) : 0;

  return { slope, intercept, r2 };
}

/**
 * Exponential smoothing for seasonality
 */
function exponentialSmoothing(data: number[], alpha: number = 0.3): number[] {
  if (data.length === 0) return [];

  const smoothed: number[] = [data[0]];
  for (let i = 1; i < data.length; i++) {
    smoothed.push(alpha * data[i] + (1 - alpha) * smoothed[i - 1]);
  }

  return smoothed;
}

/**
 * Calculate seasonal indices (monthly)
 */
function calculateSeasonalIndices(monthlyData: number[]): number[] {
  if (monthlyData.length < 12) {
    return Array(12).fill(1);
  }

  const avgByMonth: number[] = Array(12).fill(0);
  const countByMonth: number[] = Array(12).fill(0);

  monthlyData.forEach((value, index) => {
    const month = index % 12;
    avgByMonth[month] += value;
    countByMonth[month]++;
  });

  const overall = monthlyData.reduce((a, b) => a + b, 0) / monthlyData.length;
  const indices: number[] = [];

  for (let i = 0; i < 12; i++) {
    const monthAvg = countByMonth[i] > 0 ? avgByMonth[i] / countByMonth[i] : overall;
    indices.push(overall > 0 ? monthAvg / overall : 1);
  }

  return indices;
}

/**
 * Generate revenue forecast
 * #71 Audit: Uses seasonal decomposition + linear trend + exponential smoothing.
 * For improved accuracy, provide at least 24 months of historical data (2 full seasonal cycles).
 * TODO: Consider Holt-Winters triple exponential smoothing for better multi-year seasonality.
 */
export function forecastRevenue(
  historicalRevenue: number[], // Last 12+ months for seasonal accuracy
  monthsAhead: number = 6
): Forecast[] {
  const forecasts: Forecast[] = [];

  // Calculate trend using linear regression
  const trend = linearRegression(historicalRevenue);

  // Calculate seasonality indices (requires 12+ months for meaningful decomposition)
  const seasonalIndices = calculateSeasonalIndices(historicalRevenue);

  // Apply exponential smoothing for noise reduction
  const smoothedData = exponentialSmoothing(historicalRevenue);
  // Use smoothed last value as a secondary signal
  const smoothedLastValue = smoothedData.length > 0 ? smoothedData[smoothedData.length - 1] : 0;

  const now = new Date();
  const currentMonth = now.getMonth();

  for (let i = 1; i <= monthsAhead; i++) {
    const forecastMonth = (currentMonth + i) % 12;
    const trendProjection = trend.slope * (historicalRevenue.length + i - 1) + trend.intercept;
    const seasonalAdjustment = seasonalIndices[forecastMonth];
    // #71 Audit: Blend linear trend with smoothed recent level for better short-term accuracy
    const blendWeight = Math.min(0.4, i * 0.1); // More trend weight for distant forecasts
    const baseProjection = (1 - blendWeight) * smoothedLastValue + blendWeight * trendProjection;
    const projectedRevenue = Math.max(0, baseProjection * seasonalAdjustment);

    // Confidence decreases with distance
    const confidence = Math.max(0.5, 1 - (i * 0.08));
    
    // Range based on historical variance
    const variance = calculateVariance(historicalRevenue);
    const stdDev = Math.sqrt(variance);
    const range = {
      min: Math.max(0, projectedRevenue - stdDev * 1.5 * i),
      max: projectedRevenue + stdDev * 1.5 * i,
    };

    const forecastDate = new Date(now);
    forecastDate.setMonth(forecastDate.getMonth() + i);

    forecasts.push({
      date: forecastDate,
      projectedRevenue: Math.round(projectedRevenue * 100) / 100,
      projectedExpenses: 0, // Will be calculated separately
      projectedCashBalance: 0,
      confidence,
      range: {
        min: Math.round(range.min * 100) / 100,
        max: Math.round(range.max * 100) / 100,
      },
    });
  }

  return forecasts;
}

/**
 * Generate cash flow projections
 */
export function generateCashFlowProjection(
  currentCashBalance: number,
  historicalData: {
    revenue: number[];
    purchases: number[];
    operating: number[];
    marketing: number[];
    taxes: number[];
  },
  monthsAhead: number = 3,
  assumptions: {
    revenueGrowth?: number; // Percentage
    expenseGrowth?: number;
    taxRate?: number;
  } = {}
): CashFlowProjection[] {
  const {
    revenueGrowth = 0.05, // 5% default
    expenseGrowth = 0.03, // 3% default
    taxRate = 0.15, // 15% tax rate
  } = assumptions;

  const projections: CashFlowProjection[] = [];
  let runningBalance = currentCashBalance;

  // Calculate averages from historical data
  const avgRevenue = average(historicalData.revenue);
  const avgPurchases = average(historicalData.purchases);
  const avgOperating = average(historicalData.operating);
  const avgMarketing = average(historicalData.marketing);
  // const avgTaxes = average(historicalData.taxes); // For future use

  const now = new Date();

  for (let i = 0; i < monthsAhead; i++) {
    const periodDate = new Date(now);
    periodDate.setMonth(periodDate.getMonth() + i + 1);
    const period = periodDate.toLocaleDateString('fr-CA', { year: 'numeric', month: 'short' });

    // Apply growth rates
    const growthMultiplier = Math.pow(1 + revenueGrowth, i);
    const expenseMultiplier = Math.pow(1 + expenseGrowth, i);

    const sales = avgRevenue * growthMultiplier;
    const purchases = avgPurchases * expenseMultiplier;
    const operating = avgOperating * expenseMultiplier;
    const marketing = avgMarketing * expenseMultiplier;
    const taxes = (sales - purchases - operating - marketing) * taxRate;

    const totalInflows = sales;
    const totalOutflows = purchases + operating + marketing + Math.max(0, taxes);
    const netCashFlow = totalInflows - totalOutflows;
    const closingBalance = runningBalance + netCashFlow;

    projections.push({
      period,
      openingBalance: runningBalance,
      inflows: {
        sales,
        otherIncome: 0,
        total: totalInflows,
      },
      outflows: {
        purchases,
        payroll: 0,
        rent: 0,
        utilities: 0,
        marketing,
        taxes: Math.max(0, taxes),
        other: operating,
        total: totalOutflows,
      },
      netCashFlow,
      closingBalance,
      isProjected: true,
    });

    runningBalance = closingBalance;
  }

  return projections;
}

/**
 * What-if scenario analysis
 */
export function runScenarioAnalysis(
  currentCashBalance: number,
  historicalData: {
    revenue: number[];
    purchases: number[];
    operating: number[];
    marketing: number[];
    taxes: number[];
  },
  scenarios: {
    name: string;
    assumptions: {
      revenueGrowth: number;
      expenseGrowth: number;
      marketingChange: number;
    };
  }[]
): ScenarioResult[] {
  const results: ScenarioResult[] = [];

  for (const scenario of scenarios) {
    const projections = generateCashFlowProjection(
      currentCashBalance,
      {
        ...historicalData,
        marketing: historicalData.marketing.map(m => m * (1 + scenario.assumptions.marketingChange)),
      },
      6,
      {
        revenueGrowth: scenario.assumptions.revenueGrowth,
        expenseGrowth: scenario.assumptions.expenseGrowth,
      }
    );

    const totalRevenue = projections.reduce((sum, p) => sum + p.inflows.total, 0);
    const totalExpenses = projections.reduce((sum, p) => sum + p.outflows.total, 0);
    const finalCashBalance = projections[projections.length - 1]?.closingBalance || currentCashBalance;

    let lowestCashPoint = currentCashBalance;
    let lowestCashDate = 'Début';

    for (const proj of projections) {
      if (proj.closingBalance < lowestCashPoint) {
        lowestCashPoint = proj.closingBalance;
        lowestCashDate = proj.period;
      }
    }

    results.push({
      scenario: scenario.name,
      assumptions: {
        revenueGrowth: scenario.assumptions.revenueGrowth * 100,
        expenseGrowth: scenario.assumptions.expenseGrowth * 100,
        marketingChange: scenario.assumptions.marketingChange * 100,
      },
      projections,
      summary: {
        totalRevenue,
        totalExpenses,
        netProfit: totalRevenue - totalExpenses,
        finalCashBalance,
        lowestCashPoint,
        lowestCashDate,
      },
    });
  }

  return results;
}

/**
 * Predefined scenarios for quick analysis
 */
export const STANDARD_SCENARIOS = [
  {
    name: 'Scénario de base',
    assumptions: { revenueGrowth: 0.05, expenseGrowth: 0.03, marketingChange: 0 },
  },
  {
    name: 'Croissance agressive',
    assumptions: { revenueGrowth: 0.15, expenseGrowth: 0.08, marketingChange: 0.5 },
  },
  {
    name: 'Conservateur',
    assumptions: { revenueGrowth: 0.02, expenseGrowth: 0.02, marketingChange: -0.2 },
  },
  {
    name: 'Réduction des coûts',
    assumptions: { revenueGrowth: 0, expenseGrowth: -0.1, marketingChange: -0.3 },
  },
  {
    name: 'Pire scénario',
    assumptions: { revenueGrowth: -0.2, expenseGrowth: 0.05, marketingChange: 0 },
  },
];

/**
 * Generate cash flow alerts based on projections
 */
export function generateCashFlowAlerts(
  projections: CashFlowProjection[],
  minimumCashBalance: number = 10000
): { type: 'WARNING' | 'CRITICAL'; message: string; period: string }[] {
  const alerts: { type: 'WARNING' | 'CRITICAL'; message: string; period: string }[] = [];

  for (const proj of projections) {
    if (proj.closingBalance < 0) {
      alerts.push({
        type: 'CRITICAL',
        message: `Solde de trésorerie négatif projeté: ${proj.closingBalance.toLocaleString('fr-CA', { style: 'currency', currency: 'CAD' })}`,
        period: proj.period,
      });
    } else if (proj.closingBalance < minimumCashBalance) {
      alerts.push({
        type: 'WARNING',
        message: `Solde sous le minimum (${minimumCashBalance.toLocaleString('fr-CA', { style: 'currency', currency: 'CAD' })}): ${proj.closingBalance.toLocaleString('fr-CA', { style: 'currency', currency: 'CAD' })}`,
        period: proj.period,
      });
    }
  }

  return alerts;
}

/**
 * Expose r2 and trend.slope for forecast response transparency
 */
export function getForecastMetrics(historicalRevenue: number[]): {
  r2: number;
  trendSlope: number;
  trendIntercept: number;
  dataPoints: number;
} {
  const trend = linearRegression(historicalRevenue);
  return {
    r2: Math.round(trend.r2 * 10000) / 10000,
    trendSlope: Math.round(trend.slope * 100) / 100,
    trendIntercept: Math.round(trend.intercept * 100) / 100,
    dataPoints: historicalRevenue.length,
  };
}

// Helper functions
function average(arr: number[]): number {
  return arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}

function calculateVariance(arr: number[]): number {
  const avg = average(arr);
  return arr.length > 0
    ? arr.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / arr.length
    : 0;
}

/**
 * Format projection for display
 */
export function formatProjectionSummary(projections: CashFlowProjection[]): string {
  if (projections.length === 0) return 'Aucune projection disponible';

  const totalInflows = projections.reduce((sum, p) => sum + p.inflows.total, 0);
  const totalOutflows = projections.reduce((sum, p) => sum + p.outflows.total, 0);
  const netChange = totalInflows - totalOutflows;
  const finalBalance = projections[projections.length - 1].closingBalance;

  return `
Sur ${projections.length} mois:
- Entrées totales: ${totalInflows.toLocaleString('fr-CA', { style: 'currency', currency: 'CAD' })}
- Sorties totales: ${totalOutflows.toLocaleString('fr-CA', { style: 'currency', currency: 'CAD' })}
- Variation nette: ${netChange.toLocaleString('fr-CA', { style: 'currency', currency: 'CAD' })}
- Solde final projeté: ${finalBalance.toLocaleString('fr-CA', { style: 'currency', currency: 'CAD' })}
  `.trim();
}
