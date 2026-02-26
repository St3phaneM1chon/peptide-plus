'use client';

import { useState } from 'react';
import {
  Key,
  ShieldCheck,
  Zap,
  Code,
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
  Globe,
  AlertTriangle,
  Clock,
} from 'lucide-react';
import { useTranslations } from '@/hooks/useTranslations';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EndpointDef {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  permission: string;
  descKey: string;
  params?: { name: string; type: string; required: boolean; description: string }[];
  bodyFields?: { name: string; type: string; required: boolean; description: string }[];
  exampleResponse: string;
}

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

const BASE_URL = 'https://biocyclepeptides.com';

const ENDPOINTS: EndpointDef[] = [
  {
    method: 'GET',
    path: '/api/v1/products',
    permission: 'products:read',
    descKey: 'apiDocs.endpoints.listProducts',
    params: [
      { name: 'page', type: 'number', required: false, description: 'Page number (default: 1)' },
      { name: 'limit', type: 'number', required: false, description: 'Items per page (1-100, default: 20)' },
      { name: 'categoryId', type: 'string', required: false, description: 'Filter by category ID' },
      { name: 'search', type: 'string', required: false, description: 'Search by name, description, or SKU' },
      { name: 'isFeatured', type: 'boolean', required: false, description: 'Filter featured products' },
      { name: 'productType', type: 'string', required: false, description: 'Filter by product type (PEPTIDE, etc.)' },
      { name: 'sortBy', type: 'string', required: false, description: 'Sort field (name, price, createdAt, purchaseCount, averageRating)' },
      { name: 'sortOrder', type: 'string', required: false, description: 'Sort order (asc, desc)' },
    ],
    exampleResponse: `{
  "success": true,
  "data": [
    {
      "id": "clx...",
      "name": "BPC-157",
      "slug": "bpc-157",
      "price": "45.99",
      "sku": "PEP-BPC157-5",
      "stockQuantity": 150,
      "category": { "id": "...", "name": "Peptides", "slug": "peptides" },
      "formats": [...]
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 25, "totalPages": 2 }
}`,
  },
  {
    method: 'GET',
    path: '/api/v1/products/:id',
    permission: 'products:read',
    descKey: 'apiDocs.endpoints.getProduct',
    params: [
      { name: 'id', type: 'string', required: true, description: 'Product ID or slug' },
    ],
    exampleResponse: `{
  "success": true,
  "data": {
    "id": "clx...",
    "name": "BPC-157",
    "slug": "bpc-157",
    "description": "Body Protection Compound...",
    "price": "45.99",
    "formats": [...],
    "images": [...],
    "quantityDiscounts": [...]
  }
}`,
  },
  {
    method: 'GET',
    path: '/api/v1/orders',
    permission: 'orders:read',
    descKey: 'apiDocs.endpoints.listOrders',
    params: [
      { name: 'page', type: 'number', required: false, description: 'Page number' },
      { name: 'limit', type: 'number', required: false, description: 'Items per page (1-100)' },
      { name: 'status', type: 'string', required: false, description: 'Filter by status (PENDING, CONFIRMED, SHIPPED, DELIVERED, CANCELLED)' },
      { name: 'paymentStatus', type: 'string', required: false, description: 'Filter by payment status' },
      { name: 'userId', type: 'string', required: false, description: 'Filter by user ID' },
      { name: 'dateFrom', type: 'string', required: false, description: 'Start date (ISO 8601)' },
      { name: 'dateTo', type: 'string', required: false, description: 'End date (ISO 8601)' },
    ],
    exampleResponse: `{
  "success": true,
  "data": [
    {
      "id": "clx...",
      "orderNumber": "BP-010001",
      "total": "129.97",
      "status": "CONFIRMED",
      "paymentStatus": "PAID",
      "items": [...],
      "currency": { "code": "CAD", "symbol": "$" }
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 342, "totalPages": 18 }
}`,
  },
  {
    method: 'POST',
    path: '/api/v1/orders',
    permission: 'orders:write',
    descKey: 'apiDocs.endpoints.createOrder',
    bodyFields: [
      { name: 'shippingName', type: 'string', required: true, description: 'Full name of recipient' },
      { name: 'shippingAddress1', type: 'string', required: true, description: 'Street address' },
      { name: 'shippingCity', type: 'string', required: true, description: 'City' },
      { name: 'shippingState', type: 'string', required: true, description: 'State/Province' },
      { name: 'shippingPostal', type: 'string', required: true, description: 'Postal/ZIP code' },
      { name: 'shippingCountry', type: 'string', required: true, description: 'Country code (default: CA)' },
      { name: 'items', type: 'array', required: true, description: 'Array of { productId, formatId?, quantity }' },
      { name: 'userId', type: 'string', required: false, description: 'Link order to existing user' },
      { name: 'customerNotes', type: 'string', required: false, description: 'Customer notes' },
    ],
    exampleResponse: `{
  "success": true,
  "data": {
    "id": "clx...",
    "orderNumber": "BP-010042",
    "total": "91.98",
    "status": "PENDING",
    "paymentStatus": "PENDING",
    "items": [
      { "productName": "BPC-157", "quantity": 2, "unitPrice": "45.99", "total": "91.98" }
    ]
  }
}`,
  },
  {
    method: 'GET',
    path: '/api/v1/orders/:id',
    permission: 'orders:read',
    descKey: 'apiDocs.endpoints.getOrder',
    params: [
      { name: 'id', type: 'string', required: true, description: 'Order ID or order number' },
    ],
    exampleResponse: `{
  "success": true,
  "data": {
    "id": "clx...",
    "orderNumber": "BP-010001",
    "total": "129.97",
    "status": "SHIPPED",
    "trackingNumber": "1Z999AA1...",
    "items": [...],
    "user": { "id": "...", "email": "john@example.com", "name": "John Doe" }
  }
}`,
  },
  {
    method: 'GET',
    path: '/api/v1/invoices',
    permission: 'invoices:read',
    descKey: 'apiDocs.endpoints.listInvoices',
    params: [
      { name: 'page', type: 'number', required: false, description: 'Page number' },
      { name: 'limit', type: 'number', required: false, description: 'Items per page' },
      { name: 'status', type: 'string', required: false, description: 'Filter by status (DRAFT, SENT, PAID, OVERDUE, CANCELLED, VOID)' },
      { name: 'customerId', type: 'string', required: false, description: 'Filter by customer ID' },
      { name: 'overdue', type: 'boolean', required: false, description: 'Show only overdue invoices' },
    ],
    exampleResponse: `{
  "success": true,
  "data": [
    {
      "id": "clx...",
      "invoiceNumber": "INV-2026-001",
      "customerName": "Acme Corp",
      "total": "599.95",
      "balance": "0.00",
      "status": "PAID",
      "items": [...]
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 85, "totalPages": 5 }
}`,
  },
  {
    method: 'GET',
    path: '/api/v1/invoices/:id',
    permission: 'invoices:read',
    descKey: 'apiDocs.endpoints.getInvoice',
    params: [
      { name: 'id', type: 'string', required: true, description: 'Invoice ID or invoice number' },
    ],
    exampleResponse: `{
  "success": true,
  "data": {
    "id": "clx...",
    "invoiceNumber": "INV-2026-001",
    "total": "599.95",
    "status": "PAID",
    "items": [...],
    "creditNotes": [...]
  }
}`,
  },
  {
    method: 'GET',
    path: '/api/v1/customers',
    permission: 'customers:read',
    descKey: 'apiDocs.endpoints.listCustomers',
    params: [
      { name: 'page', type: 'number', required: false, description: 'Page number' },
      { name: 'limit', type: 'number', required: false, description: 'Items per page' },
      { name: 'search', type: 'string', required: false, description: 'Search by name or email' },
      { name: 'loyaltyTier', type: 'string', required: false, description: 'Filter by tier (BRONZE, SILVER, GOLD, PLATINUM)' },
    ],
    exampleResponse: `{
  "success": true,
  "data": [
    {
      "id": "clx...",
      "email": "john@example.com",
      "name": "John Doe",
      "loyaltyTier": "GOLD",
      "loyaltyPoints": 2500,
      "_count": { "orders": 12, "reviews": 5 }
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 1250, "totalPages": 63 }
}`,
  },
  {
    method: 'GET',
    path: '/api/v1/customers/:id',
    permission: 'customers:read',
    descKey: 'apiDocs.endpoints.getCustomer',
    params: [
      { name: 'id', type: 'string', required: true, description: 'Customer ID or email' },
    ],
    exampleResponse: `{
  "success": true,
  "data": {
    "id": "clx...",
    "email": "john@example.com",
    "name": "John Doe",
    "addresses": [...],
    "orders": [...],
    "_count": { "orders": 12, "reviews": 5, "wishlistCollections": 2 }
  }
}`,
  },
  {
    method: 'GET',
    path: '/api/v1/inventory',
    permission: 'inventory:read',
    descKey: 'apiDocs.endpoints.inventory',
    params: [
      { name: 'page', type: 'number', required: false, description: 'Page number' },
      { name: 'limit', type: 'number', required: false, description: 'Items per page' },
      { name: 'lowStock', type: 'boolean', required: false, description: 'Show only low stock items' },
      { name: 'outOfStock', type: 'boolean', required: false, description: 'Show only out-of-stock items' },
      { name: 'categoryId', type: 'string', required: false, description: 'Filter by category ID' },
    ],
    exampleResponse: `{
  "success": true,
  "data": [
    {
      "id": "clx...",
      "name": "BPC-157",
      "sku": "PEP-BPC157-5",
      "stockQuantity": 150,
      "reorderPoint": 20,
      "formats": [
        { "name": "5mg Vial", "stockQuantity": 80, "inStock": true }
      ]
    }
  ],
  "meta": {
    "page": 1, "limit": 50, "total": 25, "totalPages": 1,
    "summary": { "totalProducts": 25, "totalStock": 3200, "outOfStock": 2, "lowStock": 5 }
  }
}`,
  },
  {
    method: 'GET',
    path: '/api/v1/webhooks',
    permission: 'webhooks:read',
    descKey: 'apiDocs.endpoints.listWebhooks',
    params: [
      { name: 'page', type: 'number', required: false, description: 'Page number' },
      { name: 'limit', type: 'number', required: false, description: 'Items per page' },
    ],
    exampleResponse: `{
  "success": true,
  "data": [
    {
      "id": "clx...",
      "name": "Slack Notifications",
      "url": "https://hooks.slack.com/services/xxx",
      "events": ["order.created", "order.paid"],
      "active": true,
      "deliveryCount": 1250
    }
  ],
  "meta": { "availableEvents": ["order.created", "order.paid", ...] }
}`,
  },
  {
    method: 'POST',
    path: '/api/v1/webhooks',
    permission: 'webhooks:write',
    descKey: 'apiDocs.endpoints.createWebhook',
    bodyFields: [
      { name: 'url', type: 'string', required: true, description: 'Webhook endpoint URL (HTTPS recommended)' },
      { name: 'events', type: 'string[]', required: true, description: 'Array of event types to subscribe to' },
      { name: 'name', type: 'string', required: false, description: 'Friendly name for the webhook' },
    ],
    exampleResponse: `{
  "success": true,
  "data": {
    "id": "clx...",
    "name": "My Webhook",
    "url": "https://example.com/webhooks",
    "events": ["order.created"],
    "secret": "whsec_abc123...",
    "_note": "Save this secret securely. It will not be shown again."
  }
}`,
  },
];

const ERROR_CODES = [
  { code: 400, meaning: 'Bad Request', description: 'Invalid parameters or malformed request body' },
  { code: 401, meaning: 'Unauthorized', description: 'Missing, invalid, expired, or revoked API key' },
  { code: 403, meaning: 'Forbidden', description: 'API key lacks the required permission for this endpoint' },
  { code: 404, meaning: 'Not Found', description: 'The requested resource does not exist' },
  { code: 429, meaning: 'Too Many Requests', description: 'Rate limit exceeded. Check Retry-After header' },
  { code: 500, meaning: 'Internal Server Error', description: 'An unexpected error occurred on the server' },
];

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={handleCopy} className="absolute top-3 right-3 p-1.5 bg-slate-700 hover:bg-slate-600 rounded text-slate-300">
      {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

function EndpointCard({ endpoint, t }: { endpoint: EndpointDef; t: (key: string) => string }) {
  const [expanded, setExpanded] = useState(false);
  const methodColors: Record<string, string> = {
    GET: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    POST: 'bg-blue-100 text-blue-700 border-blue-200',
    PUT: 'bg-amber-100 text-amber-700 border-amber-200',
    DELETE: 'bg-red-100 text-red-700 border-red-200',
  };

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-5 py-4 hover:bg-slate-50 transition-colors text-left"
      >
        <span className={`px-2.5 py-1 rounded-md text-xs font-bold border ${methodColors[endpoint.method]}`}>
          {endpoint.method}
        </span>
        <code className="text-sm font-mono text-slate-700 flex-1">{endpoint.path}</code>
        <span className="text-xs text-indigo-500 font-mono">{endpoint.permission}</span>
        {expanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
      </button>

      {expanded && (
        <div className="px-5 pb-5 border-t border-slate-100 pt-4 space-y-4">
          <p className="text-sm text-slate-600">{t(endpoint.descKey)}</p>

          {/* Parameters */}
          {endpoint.params && endpoint.params.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-slate-700 mb-2">{t('apiDocs.parameters')}</h4>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-1.5 px-2 text-slate-500 font-medium">{t('apiDocs.paramName')}</th>
                    <th className="text-left py-1.5 px-2 text-slate-500 font-medium">{t('apiDocs.paramType')}</th>
                    <th className="text-left py-1.5 px-2 text-slate-500 font-medium">{t('apiDocs.paramRequired')}</th>
                    <th className="text-left py-1.5 px-2 text-slate-500 font-medium">{t('apiDocs.paramDescription')}</th>
                  </tr>
                </thead>
                <tbody>
                  {endpoint.params.map((p) => (
                    <tr key={p.name} className="border-b border-slate-50">
                      <td className="py-1.5 px-2 font-mono text-xs text-slate-700">{p.name}</td>
                      <td className="py-1.5 px-2 text-xs text-indigo-600">{p.type}</td>
                      <td className="py-1.5 px-2">
                        {p.required ? (
                          <span className="text-xs text-red-500 font-medium">{t('apiDocs.required')}</span>
                        ) : (
                          <span className="text-xs text-slate-400">{t('apiDocs.optional')}</span>
                        )}
                      </td>
                      <td className="py-1.5 px-2 text-xs text-slate-500">{p.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Body fields */}
          {endpoint.bodyFields && endpoint.bodyFields.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-slate-700 mb-2">{t('apiDocs.requestBody')}</h4>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-1.5 px-2 text-slate-500 font-medium">{t('apiDocs.paramName')}</th>
                    <th className="text-left py-1.5 px-2 text-slate-500 font-medium">{t('apiDocs.paramType')}</th>
                    <th className="text-left py-1.5 px-2 text-slate-500 font-medium">{t('apiDocs.paramRequired')}</th>
                    <th className="text-left py-1.5 px-2 text-slate-500 font-medium">{t('apiDocs.paramDescription')}</th>
                  </tr>
                </thead>
                <tbody>
                  {endpoint.bodyFields.map((p) => (
                    <tr key={p.name} className="border-b border-slate-50">
                      <td className="py-1.5 px-2 font-mono text-xs text-slate-700">{p.name}</td>
                      <td className="py-1.5 px-2 text-xs text-indigo-600">{p.type}</td>
                      <td className="py-1.5 px-2">
                        {p.required ? (
                          <span className="text-xs text-red-500 font-medium">{t('apiDocs.required')}</span>
                        ) : (
                          <span className="text-xs text-slate-400">{t('apiDocs.optional')}</span>
                        )}
                      </td>
                      <td className="py-1.5 px-2 text-xs text-slate-500">{p.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Example Response */}
          <div>
            <h4 className="text-sm font-semibold text-slate-700 mb-2">{t('apiDocs.exampleResponse')}</h4>
            <div className="relative">
              <pre className="bg-slate-900 text-green-400 rounded-lg p-4 text-xs overflow-x-auto">
                {endpoint.exampleResponse}
              </pre>
              <CopyButton text={endpoint.exampleResponse} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function ApiDocsPage() {
  const { t } = useTranslations();
  const [activeTab, setActiveTab] = useState<'overview' | 'endpoints' | 'errors' | 'examples'>('overview');

  const curlExample = `curl -X GET "${BASE_URL}/api/v1/products?limit=5" \\
  -H "Authorization: Bearer bp_live_YOUR_API_KEY"`;

  const jsExample = `const response = await fetch('${BASE_URL}/api/v1/products?limit=5', {
  headers: {
    'Authorization': 'Bearer bp_live_YOUR_API_KEY',
    'Content-Type': 'application/json',
  },
});

const { success, data, meta } = await response.json();
console.log(\`Found \${meta.total} products\`);
data.forEach(product => {
  console.log(\`\${product.name} - \$\${product.price}\`);
});`;

  const pythonExample = `import requests

API_KEY = "bp_live_YOUR_API_KEY"
BASE = "${BASE_URL}/api/v1"
headers = {"Authorization": f"Bearer {API_KEY}"}

# List products
resp = requests.get(f"{BASE}/products", headers=headers, params={"limit": 5})
data = resp.json()

for product in data["data"]:
    print(f"{product['name']} - \${product['price']}")

# Create order
order = requests.post(f"{BASE}/orders", headers=headers, json={
    "shippingName": "John Doe",
    "shippingAddress1": "123 Main St",
    "shippingCity": "Montreal",
    "shippingState": "QC",
    "shippingPostal": "H1A 1A1",
    "shippingCountry": "CA",
    "items": [{"productId": "clx...", "quantity": 2}]
})
print(order.json())`;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-full text-sm font-medium mb-4">
          <Globe className="w-4 h-4" />
          REST API v1
        </div>
        <h1 className="text-3xl font-bold text-slate-900 mb-3">{t('apiDocs.title')}</h1>
        <p className="text-lg text-slate-500 max-w-2xl mx-auto">{t('apiDocs.subtitle')}</p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-slate-200 mb-8">
        {([
          { key: 'overview', label: t('apiDocs.tabOverview'), icon: ShieldCheck },
          { key: 'endpoints', label: t('apiDocs.tabEndpoints'), icon: Code },
          { key: 'errors', label: t('apiDocs.tabErrors'), icon: AlertTriangle },
          { key: 'examples', label: t('apiDocs.tabExamples'), icon: Zap },
        ] as const).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === key
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-8">
          {/* Base URL */}
          <section>
            <h2 className="text-xl font-semibold text-slate-800 mb-3">{t('apiDocs.baseUrl')}</h2>
            <div className="relative">
              <pre className="bg-slate-900 text-green-400 rounded-lg p-4 text-sm">
                {BASE_URL}/api/v1/
              </pre>
              <CopyButton text={`${BASE_URL}/api/v1/`} />
            </div>
          </section>

          {/* Authentication */}
          <section>
            <h2 className="text-xl font-semibold text-slate-800 mb-3 flex items-center gap-2">
              <Key className="w-5 h-5 text-indigo-600" />
              {t('apiDocs.authTitle')}
            </h2>
            <p className="text-slate-600 mb-3">{t('apiDocs.authDescription')}</p>
            <div className="relative">
              <pre className="bg-slate-900 text-green-400 rounded-lg p-4 text-sm">
{`Authorization: Bearer bp_live_YOUR_API_KEY`}
              </pre>
              <CopyButton text="Authorization: Bearer bp_live_YOUR_API_KEY" />
            </div>
            <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-700">
              <strong>{t('apiDocs.authNote')}:</strong> {t('apiDocs.authNoteText')}
            </div>
          </section>

          {/* Rate Limiting */}
          <section>
            <h2 className="text-xl font-semibold text-slate-800 mb-3 flex items-center gap-2">
              <Clock className="w-5 h-5 text-indigo-600" />
              {t('apiDocs.rateLimitTitle')}
            </h2>
            <p className="text-slate-600 mb-3">{t('apiDocs.rateLimitDescription')}</p>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
              <table className="w-full text-sm">
                <tbody>
                  <tr className="border-b border-slate-200">
                    <td className="py-2 font-mono text-slate-600">X-RateLimit-Limit</td>
                    <td className="py-2 text-slate-500">{t('apiDocs.rateLimitHeader')}</td>
                  </tr>
                  <tr className="border-b border-slate-200">
                    <td className="py-2 font-mono text-slate-600">X-RateLimit-Remaining</td>
                    <td className="py-2 text-slate-500">{t('apiDocs.rateLimitRemaining')}</td>
                  </tr>
                  <tr className="border-b border-slate-200">
                    <td className="py-2 font-mono text-slate-600">X-RateLimit-Reset</td>
                    <td className="py-2 text-slate-500">{t('apiDocs.rateLimitReset')}</td>
                  </tr>
                  <tr>
                    <td className="py-2 font-mono text-slate-600">Retry-After</td>
                    <td className="py-2 text-slate-500">{t('apiDocs.retryAfter')}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* Response Format */}
          <section>
            <h2 className="text-xl font-semibold text-slate-800 mb-3">{t('apiDocs.responseFormatTitle')}</h2>
            <p className="text-slate-600 mb-3">{t('apiDocs.responseFormatDescription')}</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="text-sm font-medium text-slate-700 mb-2">{t('apiDocs.successResponse')}</h4>
                <pre className="bg-slate-900 text-green-400 rounded-lg p-4 text-xs">
{`{
  "success": true,
  "data": { ... },
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}`}
                </pre>
              </div>
              <div>
                <h4 className="text-sm font-medium text-slate-700 mb-2">{t('apiDocs.errorResponse')}</h4>
                <pre className="bg-slate-900 text-red-400 rounded-lg p-4 text-xs">
{`{
  "success": false,
  "error": "Description of the error"
}`}
                </pre>
              </div>
            </div>
          </section>

          {/* Permissions */}
          <section>
            <h2 className="text-xl font-semibold text-slate-800 mb-3 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-indigo-600" />
              {t('apiDocs.permissionsTitle')}
            </h2>
            <p className="text-slate-600 mb-3">{t('apiDocs.permissionsDescription')}</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {[
                'products:read', 'products:write',
                'orders:read', 'orders:write',
                'invoices:read', 'invoices:write',
                'customers:read', 'customers:write',
                'inventory:read',
                'webhooks:read', 'webhooks:write',
              ].map((perm) => (
                <div key={perm} className="px-3 py-2 bg-indigo-50 text-indigo-700 rounded-lg font-mono text-xs">
                  {perm}
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {/* Endpoints Tab */}
      {activeTab === 'endpoints' && (
        <div className="space-y-4">
          {ENDPOINTS.map((ep, i) => (
            <EndpointCard key={i} endpoint={ep} t={t} />
          ))}
        </div>
      )}

      {/* Errors Tab */}
      {activeTab === 'errors' && (
        <div className="space-y-6">
          <h2 className="text-xl font-semibold text-slate-800">{t('apiDocs.errorCodesTitle')}</h2>
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left py-3 px-5 font-semibold text-slate-700">{t('apiDocs.statusCode')}</th>
                  <th className="text-left py-3 px-5 font-semibold text-slate-700">{t('apiDocs.meaning')}</th>
                  <th className="text-left py-3 px-5 font-semibold text-slate-700">{t('apiDocs.description')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ERROR_CODES.map((err) => (
                  <tr key={err.code} className="hover:bg-slate-50">
                    <td className="py-3 px-5">
                      <span className={`px-2 py-1 rounded text-xs font-bold ${
                        err.code < 500 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {err.code}
                      </span>
                    </td>
                    <td className="py-3 px-5 font-medium text-slate-700">{err.meaning}</td>
                    <td className="py-3 px-5 text-slate-500">{err.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Error Response Format */}
          <div>
            <h3 className="text-lg font-semibold text-slate-800 mb-3">{t('apiDocs.errorFormat')}</h3>
            <pre className="bg-slate-900 text-red-400 rounded-lg p-4 text-sm">
{`// 401 Unauthorized
{
  "success": false,
  "error": "Missing or invalid API key. Use Authorization: Bearer bp_live_xxx"
}

// 403 Forbidden
{
  "success": false,
  "error": "Insufficient permissions. Required: orders:write"
}

// 429 Too Many Requests
// Headers: Retry-After: 45, X-RateLimit-Limit: 1000, X-RateLimit-Remaining: 0
{
  "success": false,
  "error": "Rate limit exceeded"
}`}
            </pre>
          </div>
        </div>
      )}

      {/* Code Examples Tab */}
      {activeTab === 'examples' && (
        <div className="space-y-8">
          {/* curl */}
          <section>
            <h2 className="text-lg font-semibold text-slate-800 mb-3">curl</h2>
            <div className="relative">
              <pre className="bg-slate-900 text-green-400 rounded-lg p-4 text-sm overflow-x-auto">
                {curlExample}
              </pre>
              <CopyButton text={curlExample} />
            </div>
          </section>

          {/* JavaScript */}
          <section>
            <h2 className="text-lg font-semibold text-slate-800 mb-3">JavaScript / TypeScript</h2>
            <div className="relative">
              <pre className="bg-slate-900 text-green-400 rounded-lg p-4 text-sm overflow-x-auto">
                {jsExample}
              </pre>
              <CopyButton text={jsExample} />
            </div>
          </section>

          {/* Python */}
          <section>
            <h2 className="text-lg font-semibold text-slate-800 mb-3">Python</h2>
            <div className="relative">
              <pre className="bg-slate-900 text-green-400 rounded-lg p-4 text-sm overflow-x-auto">
                {pythonExample}
              </pre>
              <CopyButton text={pythonExample} />
            </div>
          </section>

          {/* Webhook Verification */}
          <section>
            <h2 className="text-lg font-semibold text-slate-800 mb-3">{t('apiDocs.webhookVerification')}</h2>
            <p className="text-sm text-slate-600 mb-3">{t('apiDocs.webhookVerificationDesc')}</p>
            <div className="relative">
              <pre className="bg-slate-900 text-green-400 rounded-lg p-4 text-sm overflow-x-auto">
{`import crypto from 'crypto';

function verifyWebhookSignature(body: string, signature: string, secret: string): boolean {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
}

// In your webhook handler:
const rawBody = await request.text();
const signature = request.headers.get('X-Webhook-Signature');
const isValid = verifyWebhookSignature(rawBody, signature, 'whsec_your_secret');`}
              </pre>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
