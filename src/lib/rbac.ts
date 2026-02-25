/**
 * Enhanced RBAC (Role-Based Access Control)
 * Per-action permissions with dynamic UI rendering
 */

export interface Permission {
  id: string;
  name: string;
  nameFr: string;
  description: string;
  category: string;
}

export const PERMISSIONS: Permission[] = [
  // Products
  { id: 'products.view', name: 'View Products', nameFr: 'Voir produits', description: 'Can view product list', category: 'products' },
  { id: 'products.create', name: 'Create Products', nameFr: 'Créer produits', description: 'Can create new products', category: 'products' },
  { id: 'products.edit', name: 'Edit Products', nameFr: 'Modifier produits', description: 'Can edit existing products', category: 'products' },
  { id: 'products.delete', name: 'Delete Products', nameFr: 'Supprimer produits', description: 'Can delete products', category: 'products' },
  { id: 'products.manage_inventory', name: 'Manage Inventory', nameFr: 'Gérer inventaire', description: 'Can update stock levels', category: 'products' },
  // Orders
  { id: 'orders.view', name: 'View Orders', nameFr: 'Voir commandes', description: 'Can view order list', category: 'orders' },
  { id: 'orders.edit', name: 'Edit Orders', nameFr: 'Modifier commandes', description: 'Can update order status', category: 'orders' },
  { id: 'orders.refund', name: 'Process Refunds', nameFr: 'Traiter remboursements', description: 'Can process refunds', category: 'orders' },
  { id: 'orders.export', name: 'Export Orders', nameFr: 'Exporter commandes', description: 'Can export order data', category: 'orders' },
  // Customers
  { id: 'customers.view', name: 'View Customers', nameFr: 'Voir clients', description: 'Can view customer list', category: 'customers' },
  { id: 'customers.edit', name: 'Edit Customers', nameFr: 'Modifier clients', description: 'Can edit customer data', category: 'customers' },
  { id: 'customers.delete', name: 'Delete Customers', nameFr: 'Supprimer clients', description: 'Can delete customers', category: 'customers' },
  // Marketing
  { id: 'marketing.view', name: 'View Marketing', nameFr: 'Voir marketing', description: 'Can view campaigns', category: 'marketing' },
  { id: 'marketing.manage', name: 'Manage Marketing', nameFr: 'Gérer marketing', description: 'Can create/edit campaigns', category: 'marketing' },
  // Accounting
  { id: 'accounting.view', name: 'View Accounting', nameFr: 'Voir comptabilité', description: 'Can view financial data', category: 'accounting' },
  { id: 'accounting.edit', name: 'Edit Accounting', nameFr: 'Modifier comptabilité', description: 'Can create journal entries', category: 'accounting' },
  { id: 'accounting.approve', name: 'Approve Entries', nameFr: 'Approuver écritures', description: 'Can approve journal entries', category: 'accounting' },
  // Settings
  { id: 'settings.view', name: 'View Settings', nameFr: 'Voir paramètres', description: 'Can view settings', category: 'settings' },
  { id: 'settings.edit', name: 'Edit Settings', nameFr: 'Modifier paramètres', description: 'Can change settings', category: 'settings' },
  // Audit
  { id: 'audit.view', name: 'View Audit Logs', nameFr: 'Voir journaux d\'audit', description: 'Can view audit trail', category: 'audit' },
];

export const ROLE_PERMISSIONS: Record<string, string[]> = {
  OWNER: PERMISSIONS.map(p => p.id), // All permissions
  EMPLOYEE: [
    'products.view', 'products.edit', 'products.manage_inventory',
    'orders.view', 'orders.edit',
    'customers.view',
    'marketing.view',
    'accounting.view',
    'settings.view',
  ],
};

export function hasPermission(role: string, permission: string): boolean {
  if (role === 'OWNER') return true;
  const perms = ROLE_PERMISSIONS[role];
  return perms ? perms.includes(permission) : false;
}

export function getPermissionsByCategory(): Record<string, Permission[]> {
  return PERMISSIONS.reduce<Record<string, Permission[]>>((acc, p) => {
    if (!acc[p.category]) acc[p.category] = [];
    acc[p.category].push(p);
    return acc;
  }, {});
}
