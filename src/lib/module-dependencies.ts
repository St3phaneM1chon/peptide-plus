/**
 * Module Dependencies — Validation graph for Koraline modules
 *
 * Ensures modules are activated/deactivated in valid order.
 * Ex: loyalty requires ecommerce, email_marketing requires email.
 */

export interface ModuleDependency {
  requires: string[];
  requiredPlan?: string; // Minimum plan required (pro, enterprise)
}

/**
 * Dependency graph: module key → required modules + plan.
 */
export const MODULE_DEPENDENCIES: Record<string, ModuleDependency> = {
  loyalty: { requires: ['ecommerce'] },
  community: { requires: ['ecommerce'] },
  email_marketing: { requires: ['email'] },
  ambassadors: { requires: ['ecommerce', 'marketing'] },
  crm_advanced: { requires: ['crm'], requiredPlan: 'pro' },
  marketplace_starter: { requires: ['ecommerce'] },
  marketplace_pro: { requires: ['ecommerce'] },
  marketplace_enterprise: { requires: ['ecommerce'] },
  subscriptions: { requires: ['ecommerce'] },
  accounting_advanced: { requires: ['accounting'] },
  formation: { requires: [] },
};

const PLAN_HIERARCHY = ['alacarte', 'essential', 'pro', 'enterprise'];

/**
 * Check if a module can be activated given current modules and plan.
 */
export function validateModuleActivation(
  moduleKey: string,
  currentModules: string[],
  currentPlan: string
): { valid: boolean; missingDeps: string[]; requiredPlan?: string } {
  const dep = MODULE_DEPENDENCIES[moduleKey];
  if (!dep) return { valid: true, missingDeps: [] };

  const missingDeps = dep.requires.filter(r => !currentModules.includes(r));

  if (dep.requiredPlan) {
    const currentPlanIndex = PLAN_HIERARCHY.indexOf(currentPlan);
    const requiredPlanIndex = PLAN_HIERARCHY.indexOf(dep.requiredPlan);
    if (currentPlanIndex < requiredPlanIndex) {
      return {
        valid: false,
        missingDeps,
        requiredPlan: dep.requiredPlan,
      };
    }
  }

  return {
    valid: missingDeps.length === 0,
    missingDeps,
  };
}

/**
 * Check if a module can be deactivated without breaking dependents.
 */
export function validateModuleDeactivation(
  moduleKey: string,
  currentModules: string[]
): { valid: boolean; dependentModules: string[] } {
  const dependentModules: string[] = [];

  for (const [mod, dep] of Object.entries(MODULE_DEPENDENCIES)) {
    if (currentModules.includes(mod) && dep.requires.includes(moduleKey)) {
      dependentModules.push(mod);
    }
  }

  return {
    valid: dependentModules.length === 0,
    dependentModules,
  };
}

/**
 * Get all dependencies for a module (recursive, flattened).
 */
export function getAllDependencies(moduleKey: string): string[] {
  const visited = new Set<string>();
  const collect = (key: string) => {
    const dep = MODULE_DEPENDENCIES[key];
    if (!dep) return;
    for (const r of dep.requires) {
      if (!visited.has(r)) {
        visited.add(r);
        collect(r);
      }
    }
  };
  collect(moduleKey);
  return [...visited];
}
