/**
 * Dynamic Email Content Engine
 * Personalized product recommendations and content blocks
 */

export interface DynamicBlock {
  id: string;
  type: 'product_grid' | 'recommendation' | 'countdown' | 'personalized_text' | 'social_proof';
  config: Record<string, unknown>;
}

export interface ProductRecommendation {
  productId: string;
  name: string;
  price: number;
  imageUrl: string;
  reason: string; // 'frequently_bought_together', 'based_on_purchase', 'trending', 'new_arrival'
}

export function generateProductGridHTML(products: ProductRecommendation[], maxItems: number = 4): string {
  const items = products.slice(0, maxItems);
  const fmt = (n: number) => `$${n.toFixed(2)}`;

  return `
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:20px 0">
  <tr>
    ${items.map(p => `
    <td style="width:${100/items.length}%;padding:8px;text-align:center;vertical-align:top">
      <a href="https://biocyclepeptides.com/products/${p.productId}" style="text-decoration:none;color:#1e293b">
        <img src="${p.imageUrl}" alt="${p.name}" style="width:100%;max-width:150px;border-radius:8px;margin-bottom:8px" />
        <div style="font-size:14px;font-weight:600;margin-bottom:4px">${p.name}</div>
        <div style="font-size:16px;color:#059669;font-weight:700">${fmt(p.price)}</div>
      </a>
    </td>
    `).join('')}
  </tr>
</table>`;
}

export function generateCountdownHTML(endDate: Date, label: string): string {
  return `
<div style="text-align:center;padding:20px;background:#fef3c7;border-radius:12px;margin:20px 0">
  <div style="font-size:14px;color:#92400e;margin-bottom:8px">${label}</div>
  <div style="font-size:24px;font-weight:700;color:#92400e">
    Offre expire le ${new Intl.DateTimeFormat('fr-CA', { dateStyle: 'long' }).format(endDate)}
  </div>
</div>`;
}

export function generateSocialProofHTML(count: number, productName: string): string {
  return `
<div style="text-align:center;padding:12px;background:#f0fdf4;border-radius:8px;margin:16px 0">
  <span style="font-size:13px;color:#166534">🔥 ${count} personnes ont acheté <strong>${productName}</strong> cette semaine</span>
</div>`;
}

export function personalizeContent(template: string, variables: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
  }
  return result;
}
