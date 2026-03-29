import { Product, Sale, Invoice, User, InvoiceSettings, Client, Expense, Customer } from '../types';

const STORAGE_KEYS = {
  PRODUCTS: 'sales_app_products',
  SALES: 'sales_app_sales',
  INVOICES: 'sales_app_invoices',
  USERS: 'sales_app_users',
  SETTINGS: 'sales_app_settings',
  CLIENTS: 'sales_app_clients',
  EXPENSES: 'sales_app_expenses',
  CUSTOMERS: 'sales_app_customers',
};

const defaultSettings: InvoiceSettings = {
  companyName: 'اسم المتجر / الشركة',
  taxNumber: '',
  logo: '',
  primaryColor: '#4f46e5'
};

const defaultClients: Client[] = [
  {
    id: 'default-client',
    name: 'الشركة الافتراضية',
    isActive: true,
    contactMessage: 'يرجى التواصل مع الإدارة لتجديد الاشتراك.',
    createdAt: new Date().toISOString()
  }
];

export const storage = {
  getProducts: (clientId: string): Product[] => {
    const data = localStorage.getItem(`${STORAGE_KEYS.PRODUCTS}_${clientId}`);
    if (!data && clientId === 'default-client') {
      const oldData = localStorage.getItem(STORAGE_KEYS.PRODUCTS);
      return oldData ? JSON.parse(oldData) : [];
    }
    return data ? JSON.parse(data) : [];
  },
  saveProducts: (clientId: string, products: Product[]) => {
    localStorage.setItem(`${STORAGE_KEYS.PRODUCTS}_${clientId}`, JSON.stringify(products));
  },
  getSales: (clientId: string): Sale[] => {
    const data = localStorage.getItem(`${STORAGE_KEYS.SALES}_${clientId}`);
    if (!data && clientId === 'default-client') {
      const oldData = localStorage.getItem(STORAGE_KEYS.SALES);
      return oldData ? JSON.parse(oldData) : [];
    }
    return data ? JSON.parse(data) : [];
  },
  saveSales: (clientId: string, sales: Sale[]) => {
    localStorage.setItem(`${STORAGE_KEYS.SALES}_${clientId}`, JSON.stringify(sales));
  },
  getInvoices: (clientId: string): Invoice[] => {
    const data = localStorage.getItem(`${STORAGE_KEYS.INVOICES}_${clientId}`);
    if (!data && clientId === 'default-client') {
      const oldData = localStorage.getItem(STORAGE_KEYS.INVOICES);
      return oldData ? JSON.parse(oldData) : [];
    }
    return data ? JSON.parse(data) : [];
  },
  saveInvoices: (clientId: string, invoices: Invoice[]) => {
    localStorage.setItem(`${STORAGE_KEYS.INVOICES}_${clientId}`, JSON.stringify(invoices));
  },
  getExpenses: (clientId: string): Expense[] => {
    const data = localStorage.getItem(`${STORAGE_KEYS.EXPENSES}_${clientId}`);
    return data ? JSON.parse(data) : [];
  },
  saveExpenses: (clientId: string, expenses: Expense[]) => {
    localStorage.setItem(`${STORAGE_KEYS.EXPENSES}_${clientId}`, JSON.stringify(expenses));
  },
  getCustomers: (clientId: string): Customer[] => {
    const data = localStorage.getItem(`${STORAGE_KEYS.CUSTOMERS}_${clientId}`);
    return data ? JSON.parse(data) : [];
  },
  saveCustomers: (clientId: string, customers: Customer[]) => {
    localStorage.setItem(`${STORAGE_KEYS.CUSTOMERS}_${clientId}`, JSON.stringify(customers));
  },
  getUsers: (): User[] => {
    const data = localStorage.getItem(STORAGE_KEYS.USERS);
    return data ? JSON.parse(data) : [];
  },
  saveUsers: (users: User[]) => {
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
  },
  getInvoiceSettings: (clientId: string): InvoiceSettings => {
    const data = localStorage.getItem(`${STORAGE_KEYS.SETTINGS}_${clientId}`);
    if (!data && clientId === 'default-client') {
      const oldData = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      return oldData ? JSON.parse(oldData) : defaultSettings;
    }
    return data ? JSON.parse(data) : defaultSettings;
  },
  saveInvoiceSettings: (clientId: string, settings: InvoiceSettings) => {
    localStorage.setItem(`${STORAGE_KEYS.SETTINGS}_${clientId}`, JSON.stringify(settings));
  },
  getClients: (): Client[] => {
    const data = localStorage.getItem(STORAGE_KEYS.CLIENTS);
    if (!data) {
      const oldLicense = localStorage.getItem('sales_app_license');
      if (oldLicense) {
        try {
          const parsed = JSON.parse(oldLicense);
          return [{
            id: 'default-client',
            name: parsed.clientName || 'الشركة الافتراضية',
            isActive: parsed.isActive !== undefined ? parsed.isActive : true,
            contactMessage: parsed.contactMessage || 'يرجى التواصل مع الإدارة لتجديد الاشتراك.',
            createdAt: new Date().toISOString()
          }];
        } catch (e) {
          return defaultClients;
        }
      }
      return defaultClients;
    }
    return JSON.parse(data);
  },
  saveClients: (clients: Client[]) => {
    localStorage.setItem(STORAGE_KEYS.CLIENTS, JSON.stringify(clients));
  },
};

// Initial dummy data if empty
export const initializeData = (clientId: string) => {
  if (storage.getProducts(clientId).length === 0 && clientId === 'default-client') {
    storage.saveProducts(clientId, [
      { id: '1', name: 'منتج 1', category: 'إلكترونيات', price: 1500, stock: 10, minStock: 5, unit: 'قطعة' },
      { id: '2', name: 'منتج 2', category: 'أثاث', price: 3000, stock: 3, minStock: 5, unit: 'قطعة' },
      { id: '3', name: 'منتج 3', category: 'ملابس', price: 200, stock: 50, minStock: 10, unit: 'قطعة' },
    ]);
  }
  if (storage.getUsers().length === 0) {
    storage.saveUsers([
      { id: '1', name: 'أدمن النظام', email: 'admin@example.com', role: 'admin', password: 'admin', clientId: 'default-client' },
      { id: '2', name: 'مستخدم عادي', email: 'user@example.com', role: 'user', password: 'user', clientId: 'default-client' },
    ]);
  }
};
