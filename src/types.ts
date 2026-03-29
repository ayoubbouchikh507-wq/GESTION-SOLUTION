export interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  purchasePrice: number;
  stock: number;
  minStock: number;
  unit: string;
}

export interface SaleItem {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
  purchasePrice?: number;
  total: number;
}

export interface Sale {
  id: string;
  date: string;
  items: SaleItem[];
  totalAmount: number;
  customerName?: string;
}

export interface Invoice extends Sale {
  invoiceNumber: string;
  status: 'paid' | 'pending' | 'cancelled';
  type?: 'invoice' | 'quote' | 'delivery_note';
}

export interface Expense {
  id: string;
  date: string;
  amount: number;
  category: string;
  description: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  address: string;
  debt: number;
  email?: string;
  notes?: string;
}

export type TabType = 'dashboard' | 'inventory' | 'sales' | 'invoices' | 'quotes' | 'delivery_notes' | 'expenses' | 'customers' | 'reports' | 'ai' | 'users' | 'settings';

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user' | 'superadmin';
  password?: string;
  clientId?: string;
}

export interface InvoiceSettings {
  companyName: string;
  taxNumber: string;
  logo: string;
  primaryColor: string;
}

export interface Client {
  id: string;
  name: string;
  isActive: boolean;
  contactMessage: string;
  createdAt: string;
}
