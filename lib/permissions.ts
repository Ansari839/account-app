/**
 * Central permission definitions for RBAC.
 * Each module has a set of actions (VIEW, CREATE, EDIT, DELETE).
 * These are seeded into the Permission table and used for enforcement.
 */

export const MODULES = {
    DASHBOARD: 'DASHBOARD',
    COA: 'COA',
    VOUCHER: 'VOUCHER',
    PURCHASE: 'PURCHASE',
    SALES: 'SALES',
    INVENTORY: 'INVENTORY',
    REPORTS: 'REPORTS',
    SETTINGS: 'SETTINGS',
} as const;

export const ACTIONS = {
    VIEW: 'VIEW',
    CREATE: 'CREATE',
    EDIT: 'EDIT',
    DELETE: 'DELETE',
} as const;

export type ModuleKey = keyof typeof MODULES;
export type ActionKey = keyof typeof ACTIONS;

/**
 * All permission definitions: module + action combos.
 * Not every module needs all CRUD actions — some are view-only.
 */
export const ALL_PERMISSIONS: { module: string; action: string; description: string }[] = [
    // Dashboard
    { module: 'DASHBOARD', action: 'VIEW', description: 'View Dashboard' },

    // Chart of Accounts
    { module: 'COA', action: 'VIEW', description: 'View Chart of Accounts' },
    { module: 'COA', action: 'CREATE', description: 'Create Accounts' },
    { module: 'COA', action: 'EDIT', description: 'Edit Accounts' },
    { module: 'COA', action: 'DELETE', description: 'Delete Accounts' },

    // Vouchers (Journal, Payment, Receipt)
    { module: 'VOUCHER', action: 'VIEW', description: 'View Vouchers' },
    { module: 'VOUCHER', action: 'CREATE', description: 'Create Vouchers' },
    { module: 'VOUCHER', action: 'EDIT', description: 'Edit Vouchers' },
    { module: 'VOUCHER', action: 'DELETE', description: 'Delete Vouchers' },

    // Purchase (Orders, GRN, Invoices, Returns)
    { module: 'PURCHASE', action: 'VIEW', description: 'View Purchase' },
    { module: 'PURCHASE', action: 'CREATE', description: 'Create Purchase Orders/Invoices' },
    { module: 'PURCHASE', action: 'EDIT', description: 'Edit Purchase Orders/Invoices' },
    { module: 'PURCHASE', action: 'DELETE', description: 'Delete Purchase Orders/Invoices' },

    // Sales (Orders, Delivery, Invoices, Returns)
    { module: 'SALES', action: 'VIEW', description: 'View Sales' },
    { module: 'SALES', action: 'CREATE', description: 'Create Sales Orders/Invoices' },
    { module: 'SALES', action: 'EDIT', description: 'Edit Sales Orders/Invoices' },
    { module: 'SALES', action: 'DELETE', description: 'Delete Sales Orders/Invoices' },

    // Inventory (Products, Categories, Warehouses)
    { module: 'INVENTORY', action: 'VIEW', description: 'View Inventory' },
    { module: 'INVENTORY', action: 'CREATE', description: 'Create Products/Categories' },
    { module: 'INVENTORY', action: 'EDIT', description: 'Edit Products/Categories' },
    { module: 'INVENTORY', action: 'DELETE', description: 'Delete Products/Categories' },

    // Reports
    { module: 'REPORTS', action: 'VIEW', description: 'View Reports' },

    // Settings
    { module: 'SETTINGS', action: 'VIEW', description: 'View Settings' },
    { module: 'SETTINGS', action: 'EDIT', description: 'Manage Settings' },
];

/**
 * Default roles with their permissions.
 * ADMIN gets everything.
 * SALES gets sales + dashboard + reports.
 * PURCHASE gets purchase + dashboard + reports.
 * ACCOUNTANT gets voucher + COA + reports.
 */
export const DEFAULT_ROLES: { name: string; description: string; permissions: string[] }[] = [
    {
        name: 'ADMIN',
        description: 'Full access to all modules',
        permissions: ALL_PERMISSIONS.map(p => `${p.module}.${p.action}`),
    },
    {
        name: 'SALES',
        description: 'Sales department — Sales, Dashboard, Reports',
        permissions: [
            'DASHBOARD.VIEW',
            'SALES.VIEW', 'SALES.CREATE', 'SALES.EDIT', 'SALES.DELETE',
            'INVENTORY.VIEW',
            'REPORTS.VIEW',
        ],
    },
    {
        name: 'PURCHASE',
        description: 'Purchase department — Purchase, Dashboard, Reports',
        permissions: [
            'DASHBOARD.VIEW',
            'PURCHASE.VIEW', 'PURCHASE.CREATE', 'PURCHASE.EDIT', 'PURCHASE.DELETE',
            'INVENTORY.VIEW',
            'REPORTS.VIEW',
        ],
    },
    {
        name: 'ACCOUNTANT',
        description: 'Finance team — Vouchers, COA, Reports',
        permissions: [
            'DASHBOARD.VIEW',
            'COA.VIEW', 'COA.CREATE', 'COA.EDIT',
            'VOUCHER.VIEW', 'VOUCHER.CREATE', 'VOUCHER.EDIT',
            'REPORTS.VIEW',
        ],
    },
    {
        name: 'VIEWER',
        description: 'Read-only access to Dashboard and Reports',
        permissions: [
            'DASHBOARD.VIEW',
            'REPORTS.VIEW',
        ],
    },
];

/**
 * Map sidebar menu items to required permission modules.
 * If user has MODULE.VIEW, the menu item is shown.
 */
export const SIDEBAR_PERMISSION_MAP: Record<string, string> = {
    'Dashboard': 'DASHBOARD',
    'Chart of Accounts': 'COA',
    'Vouchers': 'VOUCHER',
    'Purchase': 'PURCHASE',
    'Sales': 'SALES',
    'Inventory': 'INVENTORY',
    'Reports': 'REPORTS',
    'Settings': 'SETTINGS',
};
