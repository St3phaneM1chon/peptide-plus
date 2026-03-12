# MEGA AUDIT v4.0 -- Angle 8: Business Logic Audit

**Project**: BioCycle Peptides (peptide-plus)
**Date**: 2026-03-12
**Auditor**: Claude Code (Opus 4.6)
**Scope**: Tax calculation engine, accounting auto-entries, order state machine, loyalty/referral system, payment processing logic, financial precision

---

## 1. Executive Summary

| Metric | Value |
|---|---|
| **Overall Score** | **76 / 100** |
| **Rating** | GOOD (with gaps) |
| **P0 Issues** | 0 |
| **P1 Issues** | 3 |
| **P2 Issues** | 4 |
| **P3 Issues** | 3 |
| **Total Findings** | 10 |

The business logic layer of peptide-plus is **solid in its Canadian-market foundations but incomplete for international expansion**. Three pillars stand out as well-engineered:

1. **Canadian tax configuration is comprehensive.** All 13 provinces/territories are properly configured with dual-language names, correct GST/PST/HST rates, registration thresholds, effective dates, and even the Nova Scotia rate change (15% to 14% on 2025-04-01) handled via multiple historical entries. PST is correctly mapped to a separate account code (2150) for BC/SK/MB.
2. **Accounting auto-entries are well-architected.** Seven distinct entry generators cover the full order lifecycle (sale, fee, refund, payout, recurring, loyalty earn, loyalty redeem), all guarded by `assertJournalBalance()` which enforces debit === credit on every entry. Financial math uses a dedicated `decimal-calculator` library to avoid floating-point errors.
3. **Order state machine is properly constrained.** Terminal statuses prevent invalid transitions, cancellable statuses are a defined subset, and `validateTransition()` returns structured errors rather than throwing exceptions.

The principal weaknesses are: international tax (VAT) exists only as scattered references with no engine comparable to Canadian tax; loyalty fraud protections are absent; and refund edge cases (partial amounts, multi-tax-jurisdiction refunds) lack documented handling.

### Score Breakdown

| Category | Weight | Score | Weighted |
|---|---|---|---|
| Tax System (Canadian) | 20% | 95 | 19.0 |
| Tax System (International) | 10% | 30 | 3.0 |
| Accounting Auto-Entries | 20% | 90 | 18.0 |
| Financial Precision | 10% | 92 | 9.2 |
| Order State Machine | 15% | 88 | 13.2 |
| Loyalty & Referral System | 15% | 65 | 9.8 |
| Payment Processing Logic | 10% | 80 | 8.0 |
| **Total** | **100%** | | **80.2 -> 76** |

*A 4-point adjustment is applied for the cumulative risk of the international tax gap combined with untested loyalty fraud vectors.*

---

## 2. Tax System Audit

### 2.1 Canadian Provincial Taxes -- STRONG

| Check | Result |
|---|---|
| Provinces/territories configured | **13 / 13** |
| Province code present | YES (all 13) |
| Bilingual names (EN + FR) | YES (all 13) |
| GST rate configured | YES (5% federal, all provinces) |
| PST/QST/RST rate configured | YES (where applicable) |
| HST rate configured | YES (ON, NB, NL, NS, PE) |
| Total rate calculated | YES |
| PST name variant | QST (QC), PST (BC/SK), RST (MB), HST (ON/NB/NL/NS/PE), N/A (AB/NT/NU/YT) |
| Registration threshold | YES (all 13) |
| Effective date | YES (all 13) |
| Historical rate changes | YES (NS: 15% until 2025-03-31, 14% from 2025-04-01) |
| CCA classes | Configured |
| PST separate account code | YES (2150 for BC/SK/MB, distinct from QST) |

**Rate Verification (spot-check)**:

| Province | Expected Total | Configured | Status |
|---|---|---|---|
| QC | 14.975% (5% GST + 9.975% QST) | 14.975% | PASS |
| ON | 13% (HST) | 13% | PASS |
| AB | 5% (GST only) | 5% | PASS |
| BC | 12% (5% GST + 7% PST) | 12% | PASS |
| SK | 11% (5% GST + 6% PST) | 11% | PASS |
| MB | 12% (5% GST + 7% RST) | 12% | PASS |
| NB | 15% (HST) | 15% | PASS |
| NL | 15% (HST) | 15% | PASS |
| PE | 15% (HST) | 15% | PASS |
| NS (pre 2025-04) | 15% (HST) | 15% | PASS |
| NS (post 2025-04) | 14% (HST) | 14% | PASS |

**Key Files**:
- `src/lib/accounting/canadian-tax-config.ts` -- comprehensive provincial configuration
- `src/lib/tax/canadian-tax-engine.ts` -- calculation engine
- `src/lib/tax/tax-constants.ts` -- tax constants

**Assessment**: The Canadian tax implementation is production-grade. The Nova Scotia historical rate change via multiple entries demonstrates proper temporal tax handling. The separation of PST into account code 2150 for provinces that collect PST independently (BC, SK, MB) is correct accounting practice, distinguishing it from QST (Quebec) which has its own remittance process.

### 2.2 International Tax (VAT) -- WEAK

| Check | Result |
|---|---|
| VAT engine present | **NO** (no dedicated engine) |
| VAT references found | YES (5 files: inventory.service, forecasting.service, types.ts, currency.service, integrations.service) |
| VAT calculation logic | NOT FOUND |
| EU country rates configured | NOT FOUND |
| VAT registration / reverse charge | NOT FOUND |
| Digital services tax (MOSS/OSS) | NOT FOUND |

**Assessment**: VAT exists as a concept in type definitions and service interfaces but lacks a calculation engine, country-rate configuration, or compliance logic. This is acceptable if BioCycle Peptides currently sells only within Canada, but becomes a **P1 blocker** the moment international sales begin. EU VAT alone requires rate tables for 27 member states, place-of-supply rules, and reverse-charge handling for B2B transactions.

---

## 3. Accounting Engine Audit

### 3.1 Auto-Entry Generators (7 types)

| # | Generator | Purpose | Entries Produced | Balance Guard |
|---|---|---|---|---|
| 1 | `generateSaleEntry(order)` | Revenue recognition on order completion | Revenue (CR), Receivables (DR), Tax Payable (CR) | assertJournalBalance |
| 2 | `generateFeeEntry()` | Payment processing fees (Stripe/PayPal) | Fee Expense (DR), Receivable offset (CR) | assertJournalBalance |
| 3 | `generateRefundEntry(refund)` | Order refund reversal | Reversal entries with tax adjustment | assertJournalBalance |
| 4 | `generateStripePayoutEntry(payout)` | Stripe payout reconciliation | Gross (DR Bank), Fees (DR Expense), Net (CR Stripe) | assertJournalBalance |
| 5 | `generateRecurringEntry()` | Amortization, hosting, domains, provisions | Periodic expense accruals | assertJournalBalance |
| 6 | `generateLoyaltyAwardEntry(data)` | Points earned by customer | Loyalty Expense (DR), Loyalty Liability (CR) | assertJournalBalance |
| 7 | `generateLoyaltyRedeemEntry(data)` | Points redeemed against purchase | Loyalty Liability (DR), Revenue offset (CR) | assertJournalBalance |

**Assessment**: The seven generators cover the complete order-to-cash cycle plus loyalty accounting. Each generator passes through the balance assertion. This is a well-designed chart-of-accounts-driven system.

### 3.2 Balance Validation -- STRONG

| Check | Result |
|---|---|
| `assertJournalBalance()` present | YES |
| Validates debit === credit | YES |
| Uses `roundCurrency()` | YES (precision-safe) |
| Throws on imbalance | YES (includes debit, credit, diff amounts) |
| Imported in auto-entries.service.ts | YES |
| Covers all 7 generators | YES |

**Assessment**: The balance validation is the most critical control in the accounting engine. It correctly uses `roundCurrency()` to handle floating-point precision before comparison, preventing false positives from epsilon differences (e.g., 10.00 vs 9.999999999999998). The error message includes the actual debit, credit, and difference amounts, which is essential for debugging production imbalances.

### 3.3 Recurring Entry Templates

| Template | Debit Account | Credit Account | Purpose |
|---|---|---|---|
| Amortization | 6800 | 1590 | Intangible asset amortization |
| Hosting (Azure) | 6310 | 2000 | Cloud hosting expense |
| Domains & SSL | 6320 | 1010 | Domain/certificate renewal |
| Bad Debt Provision | 6900 | 1190 | Allowance for doubtful accounts |

**Assessment**: Recurring templates follow standard accounting conventions. Account codes are mapped to named chart-of-accounts entries. The bad debt provision (6900 DR / 1190 CR) is a prudent practice for an e-commerce business.

### 3.4 Financial Precision -- STRONG

| Check | Result |
|---|---|
| Decimal calculator library | YES (`decimal-calculator`) |
| Functions used | `subtract()`, `applyRate()` |
| Native JS floating point | AVOIDED in financial calculations |
| `roundCurrency()` for comparisons | YES |

**Assessment**: Using a dedicated decimal calculator library for financial math is the correct approach. JavaScript's IEEE 754 floating-point arithmetic is notoriously imprecise for currency (e.g., `0.1 + 0.2 = 0.30000000000000004`). The `decimal-calculator` library eliminates this class of bugs entirely.

---

## 4. Order State Machine Audit

### 4.1 State Machine Structure

| Check | Result |
|---|---|
| `VALID_TRANSITIONS` map | YES (explicit allowed transitions) |
| `TERMINAL_STATUSES` defined | YES (no transitions out) |
| `CANCELLABLE_STATUSES` subset | YES |
| `validateTransition()` function | YES |
| Returns structured result | YES (`{ valid, error }`) |
| Throws exceptions | NO (returns error object -- good practice) |
| `canCancel()` helper | YES |
| `isPreOrder()` helper | YES |
| Used in Stripe webhook | YES (order status updates on payment events) |

**Assessment**: The state machine follows best practices:

- **Whitelist approach**: Only explicitly listed transitions are allowed (deny by default).
- **Terminal states**: Clearly defined statuses from which no transition is possible (e.g., DELIVERED, REFUNDED), preventing orders from being resurrected.
- **Non-throwing validation**: `validateTransition()` returns a result object rather than throwing, allowing callers to handle invalid transitions gracefully.
- **Integration with webhooks**: Stripe webhook handlers use the state machine to advance order status, ensuring consistency between payment events and order state.

### 4.2 Concerns

| Concern | Severity | Detail |
|---|---|---|
| Concurrent state transitions | P2 | No optimistic locking or version check documented. Two simultaneous webhook events could race on the same order. |
| Audit trail | P3 | State transitions should be logged to a history table for dispute resolution and compliance. Not confirmed whether this exists. |

---

## 5. Loyalty & Referral System Audit

### 5.1 Earn Types

| Earn Type | Mechanism | Notes |
|---|---|---|
| PURCHASE | Points per dollar spent | Core earn mechanism |
| REFERRAL | Bonus per successful referral | One-time per referred user |
| BIRTHDAY | Annual birthday bonus | Calendar-driven |
| NEWSLETTER_SIGNUP | 50 points fixed | One-time |
| REFERRAL_MILESTONE | Escalating rewards at thresholds | Tiered bonuses |

### 5.2 Referral Milestones

| Check | Result |
|---|---|
| Defined thresholds | YES (escalating rewards) |
| Duplicate award prevention | YES (checks if already awarded) |
| Transaction type | EARN_REFERRAL_MILESTONE |

**Assessment**: The duplicate-award check for referral milestones is critical and correctly implemented. Without it, a user could repeatedly trigger the same milestone threshold.

### 5.3 Tier System

| Check | Result |
|---|---|
| `calculateTierFromPoints()` | YES |
| `LoyaltyTierConfig` model | YES (in DB) |
| Tier progression | Points-based |

### 5.4 Fraud & Abuse Protections -- WEAK

| Check | Result | Risk |
|---|---|---|
| Daily/weekly point earn cap | **NOT FOUND** | P1 -- Automated purchases could accumulate unlimited points |
| Velocity checks on referrals | **NOT FOUND** | P1 -- Referral farming with fake accounts |
| Points expiry policy | **NOT FOUND** | P2 -- Liability accumulates indefinitely on balance sheet |
| Self-referral prevention | **NOT FOUND** | P2 -- Same IP/device/payment method checks |
| Minimum order value for points | **NOT FOUND** | P3 -- Micro-purchases to farm points |

**Assessment**: The loyalty system has correct functional logic (earn, redeem, tiers, milestones) but lacks fraud prevention mechanisms. For a peptide supplement e-commerce site, the financial exposure from loyalty fraud is moderate but real. Referral farming is the highest risk vector -- a single actor creating multiple accounts to trigger escalating milestone rewards.

---

## 6. Payment Processing Logic Audit

### 6.1 Payment Method Mapping

| Payment Method | Account Code | Account Name |
|---|---|---|
| STRIPE | 1040 | CASH_STRIPE |
| PAYPAL | Separate account | PayPal clearing |
| BANK_TRANSFER | Bank account | Direct bank |
| OTHER | Fallback | Generic clearing |

**Assessment**: Each payment method maps to a distinct account code, enabling clean reconciliation. The STRIPE -> 1040 mapping integrates with the Stripe payout entry generator (type 4), which reconciles gross/fees/net amounts.

### 6.2 Stripe Integration

| Check | Result |
|---|---|
| Webhook-driven order updates | YES |
| Uses order state machine | YES |
| Payout reconciliation | YES (auto-entry type 4) |
| Fee tracking | YES (auto-entry type 2) |

### 6.3 Concerns

| Concern | Severity | Detail |
|---|---|---|
| Refund partial amounts | P2 | Edge cases for partial refunds across multi-tax-jurisdiction orders unclear. If a QC order is partially refunded, does the tax reversal proportionally split GST and QST? |
| Multi-currency exchange rates | P2 | Currency service references VAT but exchange rate fluctuation accounting for multi-currency orders is not detailed. Unrealized gains/losses on pending foreign-currency receivables may not be captured. |
| PayPal reconciliation depth | P3 | PayPal has a separate account but no dedicated payout reconciliation generator comparable to Stripe's `generateStripePayoutEntry()`. |

---

## 7. Financial Precision & Rounding Audit

### 7.1 Precision Stack

| Layer | Mechanism | Status |
|---|---|---|
| Calculation | `decimal-calculator` library | GOOD -- avoids IEEE 754 errors |
| Tax rates | Stored as decimal values (e.g., 14.975) | GOOD |
| Currency rounding | `roundCurrency()` function | GOOD -- used before balance comparison |
| Balance assertion | Uses `roundCurrency()` before debit/credit check | GOOD |
| Persistence | Prisma Decimal type (where applicable) | Assumed |

**Assessment**: The precision stack is well-layered. The most common financial bug in Node.js applications -- using native arithmetic for currency -- is avoided through the `decimal-calculator` library. The `roundCurrency()` function as a gate before balance assertions prevents epsilon-level floating-point differences from triggering false imbalance errors.

### 7.2 Remaining Risk

| Risk | Detail |
|---|---|
| `applyRate()` rounding mode | Need to verify whether the decimal calculator uses banker's rounding (round-half-to-even) for tax calculations. Canadian tax authorities may require specific rounding rules for per-line-item vs per-invoice tax calculation. |

---

## 8. Findings Table

| ID | Severity | Category | Finding | Impact | Recommendation |
|---|---|---|---|---|---|
| BL-001 | **P1** | Tax | International VAT has no calculation engine | Blocks international sales; no EU/UK/AU tax compliance | Build a VAT engine comparable to Canadian tax, with per-country rate tables, place-of-supply rules, and reverse-charge for B2B |
| BL-002 | **P1** | Loyalty | No point accumulation caps or velocity limits | Unlimited point farming via automated purchases or referral fraud | Implement daily earn caps, referral velocity checks, and minimum order thresholds |
| BL-003 | **P1** | Loyalty | No points expiry policy | Loyalty liability grows indefinitely on balance sheet; IFRS/ASPE compliance risk | Define expiry period (12-24 months), implement expiry batch job, add breakage rate estimate |
| BL-004 | **P2** | Payment | Partial refund tax reversal logic unclear for multi-tax jurisdictions | May produce incorrect tax reversal amounts (e.g., QC GST+QST split on partial refund) | Document and unit-test partial refund scenarios for each province type (HST, GST+PST, GST+QST, GST-only) |
| BL-005 | **P2** | Payment | Multi-currency exchange rate accounting gaps | Unrealized FX gains/losses on foreign-currency receivables may not be captured | Add exchange rate snapshot at order time; implement periodic FX revaluation entries |
| BL-006 | **P2** | Order | No optimistic locking on state transitions | Concurrent webhook events could race on order status | Add version/updatedAt check in validateTransition or use Prisma `@@version` |
| BL-007 | **P2** | Loyalty | No self-referral prevention | Same person can create accounts to refer themselves | Add IP/device fingerprint/payment method checks on referral validation |
| BL-008 | **P3** | Order | State transition audit trail not confirmed | Dispute resolution and compliance require historical state log | Ensure OrderStatusHistory table captures every transition with timestamp, actor, and previous state |
| BL-009 | **P3** | Payment | No PayPal payout reconciliation generator | PayPal payouts lack the reconciliation depth of Stripe | Build `generatePayPalPayoutEntry()` mirroring the Stripe payout generator |
| BL-010 | **P3** | Tax | Rounding mode for tax calculations unverified | Canadian tax authorities may require specific rounding rules (per-line vs per-invoice) | Verify `decimal-calculator` rounding mode; add unit tests for known CRA rounding expectations |

---

## 9. Recommendations

### Priority 1 -- Before International Launch

| # | Action | Effort | Files Affected |
|---|---|---|---|
| R1 | **Build International VAT Engine** | HIGH (2-3 weeks) | New: `src/lib/tax/vat-engine.ts`, `src/lib/tax/vat-rates.ts`; Modify: `inventory.service.ts`, `forecasting.service.ts`, `currency.service.ts` |
| R2 | **Implement Loyalty Fraud Controls** | MEDIUM (1 week) | New: `src/lib/loyalty/fraud-prevention.ts`; Modify: loyalty earn handlers, referral validation |
| R3 | **Define Points Expiry Policy** | MEDIUM (1 week) | New: expiry cron job; Modify: `LoyaltyTierConfig`, loyalty accounting entries, `generateLoyaltyAwardEntry()` |

### Priority 2 -- Before Production Scale

| # | Action | Effort | Files Affected |
|---|---|---|---|
| R4 | **Unit-test partial refunds per province type** | LOW (2-3 days) | New test files covering HST, GST+PST, GST+QST, GST-only refund scenarios |
| R5 | **Add optimistic locking to order state machine** | LOW (1-2 days) | Modify: order service, state machine validation |
| R6 | **Add FX rate capture and revaluation** | MEDIUM (1 week) | Modify: `currency.service.ts`, new revaluation entry generator |
| R7 | **Add self-referral prevention** | LOW (2-3 days) | Modify: referral validation logic |

### Priority 3 -- Operational Excellence

| # | Action | Effort | Files Affected |
|---|---|---|---|
| R8 | **Confirm order state audit trail** | LOW (1 day) | Verify OrderStatusHistory table exists and is populated on every transition |
| R9 | **Build PayPal payout reconciliation** | LOW (2-3 days) | New: PayPal payout entry generator mirroring Stripe |
| R10 | **Verify tax rounding mode compliance** | LOW (1 day) | Add CRA-specific rounding test cases to tax engine unit tests |

---

## 10. Summary

The business logic layer of peptide-plus is **well-engineered for its current Canadian-market scope**. The tax system, accounting engine, and order state machine reflect mature design decisions: temporal rate handling, mandatory balance assertions, whitelist-only state transitions, and precision-safe financial math.

The three areas requiring attention before growth are:

1. **International tax** -- currently a concept without an engine. Must be built before selling outside Canada.
2. **Loyalty fraud prevention** -- the earn/redeem mechanics are sound, but the absence of caps, velocity checks, and expiry creates financial and compliance risk.
3. **Edge-case coverage** -- partial refunds across tax jurisdictions, concurrent state transitions, and multi-currency accounting need explicit handling and testing.

None of these are blocking for current Canadian-only operations, but all three become P0 the moment the business expands internationally or scales significantly.

| Metric | Value |
|---|---|
| **Final Score** | **76 / 100** |
| **Canadian Tax** | 95/100 (production-grade) |
| **International Tax** | 30/100 (concept only) |
| **Accounting Engine** | 90/100 (7 balanced generators) |
| **Order State Machine** | 88/100 (well-constrained) |
| **Loyalty System** | 65/100 (functional, no fraud controls) |
| **Payment Processing** | 80/100 (Stripe strong, PayPal weaker) |
| **Financial Precision** | 92/100 (decimal-calculator + roundCurrency) |
