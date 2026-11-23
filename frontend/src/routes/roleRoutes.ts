export const ROLE_ALLOWED_ROUTES: Record<string, string[]> = {
    FINANCE_MANAGER: ['/dashboard', '/finance-loan', '/finance-accounting'],
    FINANCE_EXECUTIVE: ['/dashboard', '/finance-loan', '/finance-accounting'],
    HR_MANAGER: ['/dashboard', '/hr-payroll'],
    USED_VEHICLES_EXECUTIVE: ['/dashboard', '/exchange-vehicles'],
    COMPLIANCE_OFFICER: ['/dashboard', '/tds-tcs'],
    BRANCH_HEAD: ['/dashboard', '/finance-loan', '/finance-accounting'],
    LOAN_OFFICER: ['/dashboard', '/finance-loan', '/finance-accounting'],
    STAFF: ['/dashboard', '/finance-loan', '/finance-accounting'],
};

/**
 * Returns a Set of allowed route paths for the given roles, or null if unrestricted (e.g. SYSTEM_ADMIN).
 */
export function getAllowedRoutes(roles?: string[]): Set<string> | null {
    const userRoles = roles && roles.length > 0 ? roles : ['STAFF'];
    if (userRoles.includes('SYSTEM_ADMIN')) {
        return null;
    }
    const restrictedRoles = userRoles.filter((r) => ROLE_ALLOWED_ROUTES[r]);
    if (restrictedRoles.length === 0) {
        return new Set(['/dashboard', '/finance-loan', '/finance-accounting']);
    }
    return new Set(restrictedRoles.flatMap((r) => ROLE_ALLOWED_ROUTES[r]));
}
