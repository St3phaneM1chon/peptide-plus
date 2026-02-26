/**
 * AUDIT PROMPTS
 * Specialized prompt templates for each audit dimension.
 * Each prompt follows the "ONE function, ONE dimension" golden rule.
 */

import type { AuditDimension, AuditFinding, Severity } from './audit-config';
import type { ExtractedFunction } from './function-extractor';

// =====================================================
// CONTEXT BUILDER (wraps function with envelope)
// =====================================================

export function buildFunctionContext(fn: ExtractedFunction): string {
  const importBlock = fn.imports.length > 0
    ? `// === IMPORTS ===\n${fn.imports.join('\n')}\n`
    : '';

  const typeBlock = fn.types.length > 0
    ? `// === TYPES IN SCOPE ===\n${fn.types.join('\n\n')}\n`
    : '';

  const callerBlock = fn.internalCallers.length > 0
    ? `// === INTERNAL CALLERS: ${fn.internalCallers.join(', ')} ===\n`
    : '';

  return `// FILE: ${fn.relativePath}
// FUNCTION: ${fn.name} (${fn.kind}, line ${fn.line}-${fn.endLine})
// EXPORTED: ${fn.exported} | ASYNC: ${fn.async}
// DOMAIN: ${fn.domain || 'unknown'}

${importBlock}
${typeBlock}
${callerBlock}
// === FUNCTION UNDER AUDIT ===
${fn.body}
`;
}

// =====================================================
// FEW-SHOT EXAMPLES (real CVE patterns)
// =====================================================

const SECURITY_EXAMPLES = `
## Examples of real vulnerabilities to look for:

1. **SQL Injection (CWE-89)**: Raw string interpolation in queries
   \`\`\`typescript
   // VULNERABLE: User input directly in query
   prisma.$queryRaw\`SELECT * FROM users WHERE email = '\${email}'\`
   // SAFE: Parameterized query
   prisma.$queryRaw\`SELECT * FROM users WHERE email = \${email}\`
   \`\`\`

2. **Broken Access Control (CWE-862)**: Missing authorization check
   \`\`\`typescript
   // VULNERABLE: No role check before admin action
   export async function DELETE(req: Request) {
     const { id } = await req.json();
     await prisma.user.delete({ where: { id } });
   }
   // SAFE: Verify admin role
   const session = await auth();
   if (session?.user?.role !== 'ADMIN') return new Response('Forbidden', { status: 403 });
   \`\`\`

3. **Sensitive Data Exposure (CWE-200)**: Returning password hashes or secrets
   \`\`\`typescript
   // VULNERABLE: Returns all fields including password
   const user = await prisma.user.findUnique({ where: { id } });
   return Response.json(user);
   // SAFE: Select only needed fields
   const user = await prisma.user.findUnique({ where: { id }, select: { id: true, name: true } });
   \`\`\`

4. **SSRF (CWE-918)**: Fetching user-supplied URLs without validation
5. **Mass Assignment (CWE-915)**: Spreading user input directly into DB update
6. **XSS (CWE-79)**: Rendering user content with dangerouslySetInnerHTML
`;

const PERFORMANCE_EXAMPLES = `
## Examples of performance issues to look for:

1. **N+1 Query**: Querying in a loop instead of using includes/joins
   \`\`\`typescript
   // BAD: N+1 - one query per order
   const orders = await prisma.order.findMany();
   for (const order of orders) {
     order.items = await prisma.orderItem.findMany({ where: { orderId: order.id } });
   }
   // GOOD: Single query with include
   const orders = await prisma.order.findMany({ include: { items: true } });
   \`\`\`

2. **Unbounded Query**: No pagination, fetching all records
3. **Missing Index**: Filtering on unindexed field with large table
4. **Redundant Computation**: Recalculating what could be cached
5. **Large Payload**: Returning full objects when only IDs are needed
`;

const RELIABILITY_EXAMPLES = `
## Examples of reliability issues to look for:

1. **Unhandled Promise Rejection**: Missing try/catch on async operations
2. **Race Condition**: Concurrent updates without optimistic locking or transactions
3. **Silent Failure**: Catching error but not logging or rethrowing
4. **Missing Null Check**: Accessing .property on potentially null value
5. **Transaction Gap**: Multi-step DB operations not wrapped in $transaction
`;

// =====================================================
// DIMENSION-SPECIFIC PROMPTS
// =====================================================

export interface AuditPromptConfig {
  systemPrompt: string;
  userPromptTemplate: (context: string) => string;
  parseResponse: (response: string) => AuditFinding[];
}

export const DIMENSION_PROMPTS: Record<AuditDimension, AuditPromptConfig> = {
  security: {
    systemPrompt: `You are a senior security auditor specializing in Next.js / TypeScript / Prisma applications.
Your task is to audit ONE function for security vulnerabilities.

Rules:
- Report ONLY concrete, exploitable vulnerabilities with specific attack scenarios
- For each finding, provide: exact line number, CWE ID, OWASP category, severity, and suggested fix
- Confidence must reflect how certain you are (0.0 to 1.0)
- Do NOT report theoretical issues — only issues with a clear exploit path
- Do NOT report style issues, naming conventions, or missing comments
- Severity: critical = RCE/auth bypass/data breach, high = privilege escalation/injection, medium = info disclosure/weak crypto, low = minor hardening

${SECURITY_EXAMPLES}

Respond in JSON format ONLY (no markdown fences, no extra text):
[
  {
    "id": "SEC-001",
    "title": "Brief title",
    "description": "Detailed description with exploit scenario",
    "severity": "critical|high|medium|low|info",
    "confidence": 0.95,
    "line": 42,
    "endLine": 45,
    "codeSnippet": "the vulnerable code",
    "suggestedFix": "the fixed code",
    "cweId": "CWE-XXX",
    "owaspCategory": "A01:2021-Broken Access Control"
  }
]

If no findings, return: []`,

    userPromptTemplate: (context: string) =>
      `Audit this function for SECURITY vulnerabilities:\n\n${context}`,

    parseResponse: (response: string) => parseJsonFindings(response, 'security'),
  },

  performance: {
    systemPrompt: `You are a senior performance engineer specializing in Next.js / TypeScript / Prisma applications.
Your task is to audit ONE function for performance issues.

Rules:
- Report ONLY concrete performance issues with measurable impact
- Focus on: N+1 queries, unbounded fetches, missing pagination, redundant computation, memory leaks, missing caching opportunities
- For each finding, provide: exact line number, severity, and suggested fix
- Severity: critical = will crash/OOM in production, high = >1s latency or >100MB memory, medium = noticeable slowdown, low = minor optimization

${PERFORMANCE_EXAMPLES}

Respond in JSON format ONLY (no markdown fences, no extra text):
[
  {
    "id": "PERF-001",
    "title": "Brief title",
    "description": "Detailed description with impact estimate",
    "severity": "critical|high|medium|low|info",
    "confidence": 0.9,
    "line": 42,
    "codeSnippet": "the slow code",
    "suggestedFix": "the optimized code"
  }
]

If no findings, return: []`,

    userPromptTemplate: (context: string) =>
      `Audit this function for PERFORMANCE issues:\n\n${context}`,

    parseResponse: (response: string) => parseJsonFindings(response, 'performance'),
  },

  reliability: {
    systemPrompt: `You are a senior reliability engineer specializing in Next.js / TypeScript / Prisma applications.
Your task is to audit ONE function for reliability issues.

Rules:
- Report ONLY concrete reliability risks: unhandled errors, race conditions, data corruption, silent failures, missing transactions
- For each finding, provide: exact line number, failure scenario, severity, and suggested fix
- Severity: critical = data corruption/loss, high = service outage/wrong results, medium = degraded experience, low = minor edge case

${RELIABILITY_EXAMPLES}

Respond in JSON format ONLY (no markdown fences, no extra text):
[
  {
    "id": "REL-001",
    "title": "Brief title",
    "description": "Detailed description with failure scenario",
    "severity": "critical|high|medium|low|info",
    "confidence": 0.9,
    "line": 42,
    "codeSnippet": "the unreliable code",
    "suggestedFix": "the reliable code"
  }
]

If no findings, return: []`,

    userPromptTemplate: (context: string) =>
      `Audit this function for RELIABILITY issues:\n\n${context}`,

    parseResponse: (response: string) => parseJsonFindings(response, 'reliability'),
  },

  maintainability: {
    systemPrompt: `You are a senior software architect specializing in Next.js / TypeScript / Prisma applications.
Your task is to audit ONE function for maintainability issues.

Rules:
- Report ONLY significant maintainability issues: excessive complexity (cyclomatic >15), code duplication, missing types (explicit any), dead code, tight coupling
- Do NOT report: missing comments, naming preferences, formatting
- For each finding, provide: exact line number, severity, and suggested fix
- Severity: critical = unmaintainable/untestable, high = very hard to modify safely, medium = confusing/error-prone, low = minor cleanup

Respond in JSON format ONLY (no markdown fences, no extra text):
[
  {
    "id": "MAINT-001",
    "title": "Brief title",
    "description": "Detailed description of maintainability impact",
    "severity": "critical|high|medium|low|info",
    "confidence": 0.85,
    "line": 42,
    "codeSnippet": "the problematic code",
    "suggestedFix": "the improved code"
  }
]

If no findings, return: []`,

    userPromptTemplate: (context: string) =>
      `Audit this function for MAINTAINABILITY issues:\n\n${context}`,

    parseResponse: (response: string) => parseJsonFindings(response, 'maintainability'),
  },

  compliance: {
    systemPrompt: `You are a senior compliance auditor specializing in RGPD, PCI-DSS, CASL, and WCAG for e-commerce applications.
Your task is to audit ONE function for compliance violations.

Rules:
- Report ONLY concrete compliance violations: PII exposure without consent, missing data retention controls, PCI violations (card data handling), CASL (anti-spam), WCAG accessibility issues
- For each finding, cite the specific regulation/article violated
- Severity: critical = legal liability/fine risk, high = regulatory non-compliance, medium = best practice violation, low = advisory

Respond in JSON format ONLY (no markdown fences, no extra text):
[
  {
    "id": "COMP-001",
    "title": "Brief title",
    "description": "Detailed description with regulation reference",
    "severity": "critical|high|medium|low|info",
    "confidence": 0.8,
    "line": 42,
    "codeSnippet": "the non-compliant code",
    "suggestedFix": "the compliant code",
    "references": ["RGPD Art. 17", "PCI-DSS Req 3.4"]
  }
]

If no findings, return: []`,

    userPromptTemplate: (context: string) =>
      `Audit this function for COMPLIANCE violations (RGPD, PCI-DSS, CASL, WCAG):\n\n${context}`,

    parseResponse: (response: string) => parseJsonFindings(response, 'compliance'),
  },
};

// =====================================================
// ADVERSARIAL VALIDATION PROMPT
// =====================================================

export const ADVERSARIAL_PROMPT = {
  systemPrompt: `You are a skeptical security researcher who CHALLENGES audit findings.
Your job is to verify if reported findings are real or false positives.

For each finding, evaluate:
1. Is the exploit scenario actually possible given the application context?
2. Are there existing mitigations (middleware, framework protections) that the auditor missed?
3. Is the severity rating accurate or inflated?
4. Is the confidence justified?

Respond in JSON format ONLY:
[
  {
    "findingId": "SEC-001",
    "verdict": "confirmed|downgraded|false_positive",
    "adjustedSeverity": "critical|high|medium|low|info",
    "adjustedConfidence": 0.85,
    "reasoning": "Why this finding is valid/invalid"
  }
]`,

  userPromptTemplate: (functionContext: string, findings: AuditFinding[]) =>
    `Review these audit findings for false positives.

## Function Context:
${functionContext}

## Reported Findings:
${JSON.stringify(findings, null, 2)}

Validate each finding. Are they real?`,
};

// =====================================================
// TRIAGE PROMPT (quick classification)
// =====================================================

export const TRIAGE_PROMPT = {
  systemPrompt: `You are a code triage specialist. Quickly classify functions by risk level.
Respond in JSON ONLY:
[
  { "name": "functionName", "risk": "high|medium|low", "reason": "brief reason" }
]

High risk: handles auth, payment, PII, file uploads, external APIs, admin actions
Medium risk: business logic, data transformation, API routes
Low risk: pure utility, formatting, constants, type definitions`,

  userPromptTemplate: (functions: { name: string; kind: string; file: string }[]) =>
    `Classify these functions by risk level:\n${JSON.stringify(functions, null, 2)}`,
};

// =====================================================
// JSON RESPONSE PARSER
// =====================================================

function parseJsonFindings(response: string, dimension: AuditDimension): AuditFinding[] {
  try {
    // Strip markdown code fences if present
    let cleaned = response.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }

    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) return [];

    return parsed.map((f: Record<string, unknown>) => ({
      id: String(f.id || `${dimension.toUpperCase()}-???`),
      dimension,
      severity: (f.severity as Severity) || 'info',
      confidence: typeof f.confidence === 'number' ? f.confidence : 0.5,
      title: String(f.title || 'Untitled finding'),
      description: String(f.description || ''),
      file: String(f.file || ''),
      line: typeof f.line === 'number' ? f.line : 0,
      endLine: typeof f.endLine === 'number' ? f.endLine : undefined,
      codeSnippet: f.codeSnippet ? String(f.codeSnippet) : undefined,
      suggestedFix: f.suggestedFix ? String(f.suggestedFix) : undefined,
      cweId: f.cweId ? String(f.cweId) : undefined,
      owaspCategory: f.owaspCategory ? String(f.owaspCategory) : undefined,
      references: Array.isArray(f.references) ? f.references.map(String) : undefined,
    }));
  } catch (err) {
    console.error(`[prompts] Failed to parse ${dimension} response:`, err);
    return [];
  }
}
