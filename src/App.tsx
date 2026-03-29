import React, { useState, useEffect, useRef } from 'react';
import { 
  LayoutDashboard, 
  Package, 
  ShoppingCart, 
  FileText, 
  Plus, 
  Search, 
  TrendingUp, 
  AlertTriangle,
  LogOut,
  Menu,
  X,
  Trash2,
  Edit,
  Download,
  Printer,
  CreditCard,
  Users,
  Sparkles,
  Send,
  Bot,
  Settings as SettingsIcon,
  Upload,
  ArrowRight,
  CheckCircle,
  Shield,
  Zap,
  MessageCircle,
  BarChart3,
  Wallet,
  Smartphone,
  Globe,
  ShieldCheck,
  Star,
  Check,
  Receipt
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import ReactMarkdown from 'react-markdown';
import { Product, Sale, Invoice, TabType, SaleItem, User, InvoiceSettings, Client, Expense, Customer } from './types';
import { storage, initializeData } from './lib/storage';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { 
  Lock, 
  User as UserIcon, 
  LogIn, 
  ShieldAlert, 
  Activity, 
  Server, 
  Key, 
  CheckCircle2 
} from 'lucide-react';
import { getAIInsights } from './services/geminiService';
import jsPDF from 'jspdf';
import { toPng } from 'html-to-image';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Expenses } from './components/Expenses';
import { Customers } from './components/Customers';
import { Reports } from './components/Reports';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('currentUser');
    return saved ? JSON.parse(saved) : null;
  });
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [invoiceSettings, setInvoiceSettings] = useState<InvoiceSettings>({
    companyName: 'اسم المتجر / الشركة',
    taxNumber: '',
    logo: '',
    primaryColor: '#4f46e5'
  });
  const [clients, setClients] = useState<Client[]>(storage.getClients());
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showLogin, setShowLogin] = useState(false);

  useEffect(() => {
    initializeData('default-client');
    setUsers(storage.getUsers());

    // Default sidebar closed on mobile, open on desktop
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setIsSidebarOpen(true);
      } else {
        setIsSidebarOpen(false);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (currentUser && currentUser.role !== 'superadmin') {
      const clientId = currentUser.clientId || 'default-client';
      setProducts(storage.getProducts(clientId));
      setSales(storage.getSales(clientId));
      setInvoices(storage.getInvoices(clientId));
      setExpenses(storage.getExpenses(clientId));
      setCustomers(storage.getCustomers(clientId));
      setInvoiceSettings(storage.getInvoiceSettings(clientId));
    }
  }, [currentUser]);

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    setIsMobileMenuOpen(false);
  };

  const handleLogout = () => {
    localStorage.removeItem('currentUser');
    setCurrentUser(null);
  };

  if (!currentUser) {
    if (showLogin) {
      return <Login 
        onLogin={(user) => {
          localStorage.setItem('currentUser', JSON.stringify(user));
          setCurrentUser(user);
        }} 
        onBack={() => setShowLogin(false)} 
      />;
    }
    return <LandingPage onLoginClick={() => setShowLogin(true)} />;
  }

  const currentClient = currentUser.clientId 
    ? clients.find(c => c.id === currentUser.clientId) 
    : clients[0];

  if (currentUser.role === 'superadmin') {
    return <SuperAdminPanel 
      clients={clients} 
      onUpdateClients={(c) => { setClients(c); storage.saveClients(c); }} 
      users={users}
      onUpdateUsers={(u) => { setUsers(u); storage.saveUsers(u); }}
      onLogout={handleLogout} 
    />;
  }

  if (currentClient && !currentClient.isActive) {
    return <LockedScreen message={currentClient.contactMessage} onLogout={handleLogout} />;
  }

  const updateProducts = (newProducts: Product[]) => {
    const clientId = currentUser?.clientId || 'default-client';
    setProducts(newProducts);
    storage.saveProducts(clientId, newProducts);
  };

  const addSale = (sale: Sale, status: Invoice['status'] = 'paid', type: Invoice['type'] = 'invoice') => {
    const clientId = currentUser?.clientId || 'default-client';
    
    // Only add to sales if it's an actual invoice
    if (type === 'invoice') {
      const newSales = [sale, ...sales];
      setSales(newSales);
      storage.saveSales(clientId, newSales);
    }

    // Create invoice/quote/delivery note
    const prefix = type === 'quote' ? 'DEV' : type === 'delivery_note' ? 'BL' : 'INV';
    const newInvoice: Invoice = {
      ...sale,
      invoiceNumber: `${prefix}-${Date.now()}`,
      status: status,
      type: type
    };
    const newInvoices = [newInvoice, ...invoices];
    setInvoices(newInvoices);
    storage.saveInvoices(clientId, newInvoices);

    // Update stock ONLY if it's an invoice or delivery note
    if (type === 'invoice' || type === 'delivery_note') {
      const updatedProducts = products.map(p => {
        const item = sale.items.find(i => i.productId === p.id);
        if (item) {
          return { ...p, stock: p.stock - item.quantity };
        }
        return p;
      });
      updateProducts(updatedProducts);
    }

    // Update customer debt if it's a pending invoice
    if (type === 'invoice' && status === 'pending' && sale.customerName) {
      const customer = customers.find(c => c.name === sale.customerName);
      if (customer) {
        const updatedCustomer = { ...customer, debt: customer.debt + sale.totalAmount };
        const newCustomers = customers.map(c => c.id === customer.id ? updatedCustomer : c);
        setCustomers(newCustomers);
        storage.saveCustomers(clientId, newCustomers);
      } else {
        // Create new customer with debt
        const newCustomer: Customer = {
          id: Date.now().toString(),
          name: sale.customerName,
          phone: '',
          address: '',
          debt: sale.totalAmount
        };
        const newCustomers = [...customers, newCustomer];
        setCustomers(newCustomers);
        storage.saveCustomers(clientId, newCustomers);
      }
    }
  };

  const deleteInvoice = (id: string) => {
    const clientId = currentUser?.clientId || 'default-client';
    const newInvoices = invoices.filter(inv => inv.id !== id);
    setInvoices(newInvoices);
    storage.saveInvoices(clientId, newInvoices);
  };

  const updateInvoiceStatus = (id: string, newStatus: Invoice['status']) => {
    const clientId = currentUser?.clientId || 'default-client';
    const newInvoices = invoices.map(inv => 
      inv.id === id ? { ...inv, status: newStatus } : inv
    );
    setInvoices(newInvoices);
    storage.saveInvoices(clientId, newInvoices);
  };

  const updateInvoiceSettings = (settings: InvoiceSettings) => {
    const clientId = currentUser?.clientId || 'default-client';
    setInvoiceSettings(settings);
    storage.saveInvoiceSettings(clientId, settings);
  };

  const addExpense = (expenseData: Omit<Expense, 'id'>) => {
    const clientId = currentUser?.clientId || 'default-client';
    const newExpense: Expense = {
      ...expenseData,
      id: Date.now().toString()
    };
    const newExpenses = [...expenses, newExpense];
    setExpenses(newExpenses);
    storage.saveExpenses(clientId, newExpenses);
  };

  const updateExpense = (updatedExpense: Expense) => {
    const clientId = currentUser?.clientId || 'default-client';
    const newExpenses = expenses.map(exp => 
      exp.id === updatedExpense.id ? updatedExpense : exp
    );
    setExpenses(newExpenses);
    storage.saveExpenses(clientId, newExpenses);
  };

  const deleteExpense = (id: string) => {
    const clientId = currentUser?.clientId || 'default-client';
    const newExpenses = expenses.filter(exp => exp.id !== id);
    setExpenses(newExpenses);
    storage.saveExpenses(clientId, newExpenses);
  };

  const addCustomer = (customerData: Omit<Customer, 'id'>) => {
    const clientId = currentUser?.clientId || 'default-client';
    const newCustomer: Customer = {
      ...customerData,
      id: Date.now().toString()
    };
    const newCustomers = [...customers, newCustomer];
    setCustomers(newCustomers);
    storage.saveCustomers(clientId, newCustomers);
  };

  const updateCustomer = (updatedCustomer: Customer) => {
    const clientId = currentUser?.clientId || 'default-client';
    const newCustomers = customers.map(cust => 
      cust.id === updatedCustomer.id ? updatedCustomer : cust
    );
    setCustomers(newCustomers);
    storage.saveCustomers(clientId, newCustomers);
  };

  const deleteCustomer = (id: string) => {
    const clientId = currentUser?.clientId || 'default-client';
    const newCustomers = customers.filter(cust => cust.id !== id);
    setCustomers(newCustomers);
    storage.saveCustomers(clientId, newCustomers);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row text-slate-900 overflow-hidden">
      {/* Mobile Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsMobileMenuOpen(false)}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60] lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar / Mobile Drawer */}
      <aside className={cn(
        "bg-white border-l border-slate-200 transition-all duration-300 flex flex-col z-[70] fixed lg:relative h-full",
        isSidebarOpen ? "w-64" : "w-0 lg:w-20 overflow-hidden lg:overflow-visible",
        isMobileMenuOpen ? "translate-x-0 w-64" : "translate-x-full lg:translate-x-0"
      )}>
        <div className="p-6 flex items-center justify-between border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shrink-0">
              <TrendingUp size={24} />
            </div>
            {(isSidebarOpen || isMobileMenuOpen) && <span className="font-bold text-xl tracking-tight">نظام المبيعات</span>}
          </div>
          <button onClick={() => setIsMobileMenuOpen(false)} className="lg:hidden text-slate-400">
            <X size={24} />
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          <NavItem 
            icon={<LayoutDashboard size={20} />} 
            label="لوحة التحكم" 
            active={activeTab === 'dashboard'} 
            onClick={() => handleTabChange('dashboard')}
            collapsed={!isSidebarOpen && !isMobileMenuOpen}
          />
          <NavItem 
            icon={<Package size={20} />} 
            label="المخزون" 
            active={activeTab === 'inventory'} 
            onClick={() => handleTabChange('inventory')}
            collapsed={!isSidebarOpen && !isMobileMenuOpen}
          />
          <NavItem 
            icon={<ShoppingCart size={20} />} 
            label="المبيعات" 
            active={activeTab === 'sales'} 
            onClick={() => handleTabChange('sales')}
            collapsed={!isSidebarOpen && !isMobileMenuOpen}
          />
          <NavItem 
            icon={<FileText size={20} />} 
            label="الفواتير" 
            active={activeTab === 'invoices'} 
            onClick={() => handleTabChange('invoices')}
            collapsed={!isSidebarOpen && !isMobileMenuOpen}
          />
          <NavItem 
            icon={<FileText size={20} />} 
            label="عروض الأسعار" 
            active={activeTab === 'quotes'} 
            onClick={() => handleTabChange('quotes')}
            collapsed={!isSidebarOpen && !isMobileMenuOpen}
          />
          <NavItem 
            icon={<FileText size={20} />} 
            label="سندات التسليم" 
            active={activeTab === 'delivery_notes'} 
            onClick={() => handleTabChange('delivery_notes')}
            collapsed={!isSidebarOpen && !isMobileMenuOpen}
          />
          <NavItem 
            icon={<Users size={20} />} 
            label="العملاء" 
            active={activeTab === 'customers'} 
            onClick={() => handleTabChange('customers')}
            collapsed={!isSidebarOpen && !isMobileMenuOpen}
          />
          <NavItem 
            icon={<Receipt size={20} />} 
            label="المصروفات" 
            active={activeTab === 'expenses'} 
            onClick={() => handleTabChange('expenses')}
            collapsed={!isSidebarOpen && !isMobileMenuOpen}
          />
          <NavItem 
            icon={<BarChart3 size={20} />} 
            label="التقارير" 
            active={activeTab === 'reports'} 
            onClick={() => handleTabChange('reports')}
            collapsed={!isSidebarOpen && !isMobileMenuOpen}
          />
          <NavItem 
            icon={<Sparkles size={20} />} 
            label="مساعد ذكي (AI)" 
            active={activeTab === 'ai'} 
            onClick={() => handleTabChange('ai')}
            collapsed={!isSidebarOpen && !isMobileMenuOpen}
          />
          {currentUser.role === 'admin' && (
            <>
              <NavItem 
                icon={<Users size={20} />} 
                label="إدارة المستخدمين" 
                active={activeTab === 'users'} 
                onClick={() => handleTabChange('users')}
                collapsed={!isSidebarOpen && !isMobileMenuOpen}
              />
              <NavItem 
                icon={<SettingsIcon size={20} />} 
                label="الإعدادات" 
                active={activeTab === 'settings'} 
                onClick={() => handleTabChange('settings')}
                collapsed={!isSidebarOpen && !isMobileMenuOpen}
              />
            </>
          )}
        </nav>

        <div className="p-4 border-t border-slate-100">
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-3 p-3 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
          >
            <LogOut size={20} />
            {(isSidebarOpen || isMobileMenuOpen) && <span>تسجيل الخروج</span>}
          </button>
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="w-full mt-2 hidden lg:flex items-center gap-3 p-3 text-slate-500 hover:bg-slate-50 rounded-lg transition-colors"
          >
            {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
            {isSidebarOpen && <span>تصغير القائمة</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 lg:px-8 shrink-0">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsMobileMenuOpen(true)}
              className="lg:hidden p-2 text-slate-500 hover:bg-slate-100 rounded-lg"
            >
              <Menu size={24} />
            </button>
            <h1 className="text-lg lg:text-xl font-semibold truncate">
              {activeTab === 'dashboard' && 'لوحة التحكم'}
              {activeTab === 'inventory' && 'إدارة المخزون'}
              {activeTab === 'sales' && 'تسجيل المبيعات'}
              {activeTab === 'invoices' && 'إدارة الفواتير'}
              {activeTab === 'quotes' && 'عروض الأسعار'}
              {activeTab === 'delivery_notes' && 'سندات التسليم'}
              {activeTab === 'customers' && 'العملاء'}
              {activeTab === 'expenses' && 'المصروفات'}
              {activeTab === 'reports' && 'التقارير'}
              {activeTab === 'ai' && 'المساعد الذكي (AI)'}
              {activeTab === 'users' && 'إدارة المستخدمين'}
            </h1>
          </div>
          <div className="flex items-center gap-2 lg:gap-4">
            <div className="relative hidden md:block">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text" 
                placeholder="بحث..." 
                className="bg-slate-100 border-none rounded-full py-2 pr-10 pl-4 focus:ring-2 focus:ring-indigo-500 w-48 lg:w-64 text-sm"
              />
            </div>
            <div className="w-8 h-8 lg:w-10 lg:h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-sm lg:text-base">
              {currentUser.name.charAt(0)}
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 lg:p-8 pb-24 lg:pb-8">
          <AnimatePresence mode="wait">
            {activeTab === 'dashboard' && (
              <Dashboard key="dashboard" products={products} sales={sales} onNavigate={setActiveTab} />
            )}
            {activeTab === 'inventory' && (
              <Inventory key="inventory" products={products} onUpdate={updateProducts} />
            )}
            {activeTab === 'sales' && (
              <Sales key="sales" products={products} onAddSale={addSale} />
            )}
            {activeTab === 'invoices' && (
              <Invoices key="invoices" invoices={invoices} onDelete={deleteInvoice} onUpdateStatus={updateInvoiceStatus} settings={invoiceSettings} typeFilter="invoice" />
            )}
            {activeTab === 'quotes' && (
              <Invoices key="quotes" invoices={invoices} onDelete={deleteInvoice} onUpdateStatus={updateInvoiceStatus} settings={invoiceSettings} typeFilter="quote" />
            )}
            {activeTab === 'delivery_notes' && (
              <Invoices key="delivery_notes" invoices={invoices} onDelete={deleteInvoice} onUpdateStatus={updateInvoiceStatus} settings={invoiceSettings} typeFilter="delivery_note" />
            )}
            {activeTab === 'ai' && (
              <AIAssistant 
                key="ai" 
                products={products} 
                sales={sales} 
              />
            )}
            {activeTab === 'expenses' && (
              <Expenses
                key="expenses"
                expenses={expenses}
                onAddExpense={addExpense}
                onUpdateExpense={updateExpense}
                onDeleteExpense={deleteExpense}
              />
            )}
            {activeTab === 'customers' && (
              <Customers
                key="customers"
                customers={customers}
                onAddCustomer={addCustomer}
                onUpdateCustomer={updateCustomer}
                onDeleteCustomer={deleteCustomer}
              />
            )}
            {activeTab === 'reports' && (
              <Reports
                key="reports"
                sales={sales}
                products={products}
              />
            )}
            {activeTab === 'users' && currentUser.role === 'admin' && (
              <UserManagement 
                key="users" 
                users={users.filter(u => u.clientId === (currentUser.clientId || 'default-client'))} 
                onUpdate={(newClientUsers) => {
                  const clientId = currentUser.clientId || 'default-client';
                  const updatedClientUsers = newClientUsers.map(u => ({ ...u, clientId }));
                  const otherUsers = users.filter(u => u.clientId !== clientId);
                  const allUsers = [...otherUsers, ...updatedClientUsers];
                  setUsers(allUsers);
                  storage.saveUsers(allUsers);
                }} 
              />
            )}
            {activeTab === 'settings' && currentUser.role === 'admin' && (
              <Settings 
                key="settings" 
                settings={invoiceSettings} 
                onSave={updateInvoiceSettings} 
              />
            )}
          </AnimatePresence>
        </div>

        {/* Mobile Bottom Navigation */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-2 py-2 flex justify-around items-center z-50">
          <MobileTabButton 
            icon={<LayoutDashboard size={20} />} 
            label="الرئيسية" 
            active={activeTab === 'dashboard'} 
            onClick={() => setActiveTab('dashboard')}
          />
          <MobileTabButton 
            icon={<Package size={20} />} 
            label="المخزون" 
            active={activeTab === 'inventory'} 
            onClick={() => setActiveTab('inventory')}
          />
          <MobileTabButton 
            icon={<ShoppingCart size={20} />} 
            label="بيع" 
            active={activeTab === 'sales'} 
            onClick={() => setActiveTab('sales')}
          />
          <MobileTabButton 
            icon={<FileText size={20} />} 
            label="فواتير" 
            active={activeTab === 'invoices'} 
            onClick={() => setActiveTab('invoices')}
          />
          <MobileTabButton 
            icon={<Users size={20} />} 
            label="عملاء" 
            active={activeTab === 'customers'} 
            onClick={() => setActiveTab('customers')}
          />
          <MobileTabButton 
            icon={<Receipt size={20} />} 
            label="مصروفات" 
            active={activeTab === 'expenses'} 
            onClick={() => setActiveTab('expenses')}
          />
          <MobileTabButton 
            icon={<BarChart3 size={20} />} 
            label="تقارير" 
            active={activeTab === 'reports'} 
            onClick={() => setActiveTab('reports')}
          />
          <MobileTabButton 
            icon={<Sparkles size={20} />} 
            label="ذكاء" 
            active={activeTab === 'ai'} 
            onClick={() => setActiveTab('ai')}
          />
          {currentUser.role === 'admin' && (
            <MobileTabButton 
              icon={<Users size={20} />} 
              label="مستخدمين" 
              active={activeTab === 'users'} 
              onClick={() => setActiveTab('users')}
            />
          )}
        </nav>
      </main>

      {/* Floating WhatsApp Button */}
      <a
        href="https://wa.me/212608469666"
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-20 sm:bottom-6 left-6 bg-emerald-500 text-white px-4 py-3 rounded-full flex items-center gap-2 shadow-lg shadow-emerald-500/40 hover:bg-emerald-600 hover:scale-105 transition-all z-50"
        aria-label="Contact on WhatsApp"
      >
        <MessageCircle size={24} />
        <span className="font-bold hidden sm:inline">تواصل معنا</span>
      </a>
    </div>
  );
}

// --- AIAssistant Component ---
function AIAssistant({ 
  products, 
  sales 
}: { 
  products: Product[], 
  sales: Sale[], 
  key?: string
}) {
  const [messages, setMessages] = useState<{ role: 'user' | 'ai', text: string }[]>([
    { role: 'ai', text: 'أهلاً بك! أنا مساعدك الذكي. يمكنني تحليل بيانات المبيعات والمخزون لمساعدتك في اتخاذ قرارات أفضل. كيف يمكنني مساعدتك اليوم؟' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMessage }]);
    setIsLoading(true);

    const aiResponse = await getAIInsights(userMessage, { products, sales });
    
    setMessages(prev => [...prev, { role: 'ai', text: aiResponse }]);
    setIsLoading(false);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="h-[calc(100vh-12rem)] flex flex-col bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden"
    >
      <div className="p-6 border-b border-slate-100 bg-indigo-50/50 flex items-center gap-3">
        <div className="w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center">
          <Bot size={24} />
        </div>
        <div>
          <h2 className="font-bold">المساعد الذكي (AI)</h2>
          <p className="text-xs text-slate-500">مدعوم بتقنية Gemini لتحليل بياناتك</p>
        </div>
      </div>

      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-6 space-y-4 scroll-smooth"
      >
        {messages.map((msg, i) => (
          <motion.div 
            initial={{ opacity: 0, x: msg.role === 'user' ? 20 : -20 }}
            animate={{ opacity: 1, x: 0 }}
            key={i} 
            className={cn(
              "flex gap-3 max-w-[85%]",
              msg.role === 'user' ? "mr-auto flex-row-reverse" : "ml-auto"
            )}
          >
            <div className={cn(
              "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
              msg.role === 'user' ? "bg-slate-100 text-slate-600" : "bg-indigo-100 text-indigo-600"
            )}>
              {msg.role === 'user' ? <UserIcon size={16} /> : <Bot size={16} />}
            </div>
            <div className={cn(
              "p-4 rounded-2xl text-sm leading-relaxed",
              msg.role === 'user' ? "bg-slate-100 text-slate-800 rounded-tr-none" : "bg-indigo-600 text-white rounded-tl-none shadow-md"
            )}>
              {msg.role === 'ai' ? (
                <div className="markdown-body prose prose-invert prose-sm max-w-none">
                  <ReactMarkdown>{msg.text}</ReactMarkdown>
                </div>
              ) : (
                msg.text
              )}
            </div>
          </motion.div>
        ))}
        {isLoading && (
          <div className="flex gap-3 ml-auto">
            <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center animate-pulse">
              <Bot size={16} />
            </div>
            <div className="bg-indigo-50 text-indigo-400 p-4 rounded-2xl rounded-tl-none flex gap-1">
              <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
              <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '200ms' }}></span>
              <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '400ms' }}></span>
            </div>
          </div>
        )}
      </div>

      <form onSubmit={handleSend} className="p-4 border-t border-slate-100 bg-slate-50/50">
        <div className="relative">
          <input 
            type="text" 
            placeholder="اسأل المساعد عن المبيعات أو المخزون..." 
            className="w-full bg-white border border-slate-200 rounded-2xl py-4 pr-4 pl-14 outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm transition-all"
            value={input}
            onChange={e => setInput(e.target.value)}
          />
          <button 
            type="submit"
            disabled={isLoading || !input.trim()}
            className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center hover:bg-indigo-700 transition-colors disabled:bg-slate-300 shadow-lg shadow-indigo-100"
          >
            <Send size={20} />
          </button>
        </div>
      </form>
    </motion.div>
  );
}

function MobileTabButton({ icon, label, active, onClick }: { 
  icon: React.ReactNode, 
  label: string, 
  active: boolean, 
  onClick: () => void 
}) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-1 px-3 py-1 rounded-lg transition-colors",
        active ? "text-indigo-600" : "text-slate-400"
      )}
    >
      <span className={cn(
        "p-1 rounded-lg transition-colors",
        active ? "bg-indigo-50" : ""
      )}>
        {icon}
      </span>
      <span className="text-[10px] font-bold">{label}</span>
    </button>
  );
}

function NavItem({ icon, label, active, onClick, collapsed }: { 
  icon: React.ReactNode, 
  label: string, 
  active: boolean, 
  onClick: () => void,
  collapsed: boolean
}) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-200",
        active 
          ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200" 
          : "text-slate-500 hover:bg-slate-50 hover:text-indigo-600"
      )}
    >
      <span className="shrink-0">{icon}</span>
      {!collapsed && <span className="font-medium whitespace-nowrap">{label}</span>}
    </button>
  );
}

// --- UserManagement Component ---
function UserManagement({ users, onUpdate }: { users: User[], onUpdate: (users: User[]) => void }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState<Partial<User>>({
    name: '',
    email: '',
    role: 'user',
    password: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingUser) {
      onUpdate(users.map(u => u.id === editingUser.id ? { ...u, ...formData } as User : u));
    } else {
      onUpdate([{ ...formData, id: Date.now().toString() } as User, ...users]);
    }
    setIsModalOpen(false);
    setEditingUser(null);
    setFormData({ name: '', email: '', role: 'user', password: '' });
  };

  const handleDelete = (id: string) => {
    if (window.confirm('هل أنت متأكد من حذف هذا المستخدم؟')) {
      onUpdate(users.filter(u => u.id !== id));
    }
  };

  const openEditModal = (user: User) => {
    setEditingUser(user);
    setFormData({ ...user });
    setIsModalOpen(true);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">إدارة المستخدمين</h2>
        <button 
          onClick={() => {
            setEditingUser(null);
            setFormData({ name: '', email: '', role: 'user', password: '' });
            setIsModalOpen(true);
          }}
          className="bg-indigo-600 text-white px-4 py-2 rounded-xl flex items-center gap-2 hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-100"
        >
          <Plus size={20} />
          إضافة مستخدم
        </button>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="p-4 font-bold text-slate-600">الاسم</th>
                <th className="p-4 font-bold text-slate-600">البريد الإلكتروني</th>
                <th className="p-4 font-bold text-slate-600">الصلاحية</th>
                <th className="p-4 font-bold text-slate-600">كلمة المرور</th>
                <th className="p-4 font-bold text-slate-600 text-left">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map(user => (
                <tr key={user.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="p-4 font-medium">{user.name}</td>
                  <td className="p-4 text-slate-500">{user.email}</td>
                  <td className="p-4">
                    <span className={cn(
                      "px-3 py-1 rounded-full text-xs font-bold",
                      user.role === 'admin' ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-700"
                    )}>
                      {user.role === 'admin' ? 'مدير' : 'مستخدم'}
                    </span>
                  </td>
                  <td className="p-4 text-slate-500">{user.password}</td>
                  <td className="p-4">
                    <div className="flex items-center justify-end gap-2">
                      <button 
                        onClick={() => openEditModal(user)}
                        className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                      >
                        <Edit size={18} />
                      </button>
                      <button 
                        onClick={() => handleDelete(user.id)}
                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl"
            >
              <h3 className="text-xl font-bold mb-6">{editingUser ? 'تعديل مستخدم' : 'إضافة مستخدم جديد'}</h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="text-sm font-bold text-slate-600 block mb-1">الاسم</label>
                  <input 
                    type="text" 
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
                    value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                  />
                </div>
                <div>
                  <label className="text-sm font-bold text-slate-600 block mb-1">البريد الإلكتروني</label>
                  <input 
                    type="email" 
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
                    value={formData.email}
                    onChange={e => setFormData({...formData, email: e.target.value})}
                  />
                </div>
                <div>
                  <label className="text-sm font-bold text-slate-600 block mb-1">كلمة المرور</label>
                  <input 
                    type="text" 
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
                    value={formData.password}
                    onChange={e => setFormData({...formData, password: e.target.value})}
                  />
                </div>
                <div>
                  <label className="text-sm font-bold text-slate-600 block mb-1">الصلاحية</label>
                  <select 
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
                    value={formData.role}
                    onChange={e => setFormData({...formData, role: e.target.value as 'admin' | 'user'})}
                  >
                    <option value="user">مستخدم عادي</option>
                    <option value="admin">مدير نظام</option>
                  </select>
                </div>
                <div className="flex gap-4 pt-4">
                  <button 
                    type="submit"
                    className="flex-1 bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition-colors"
                  >
                    حفظ
                  </button>
                  <button 
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 bg-slate-100 text-slate-600 py-3 rounded-xl font-bold hover:bg-slate-200 transition-colors"
                  >
                    إلغاء
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// --- Landing Page Component ---
function LandingPage({ onLoginClick }: { onLoginClick: () => void }) {
  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 selection:bg-indigo-100 selection:text-indigo-900 overflow-x-hidden">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 bg-white/80 backdrop-blur-md border-b border-slate-200 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
                <TrendingUp size={24} />
              </div>
              <span className="text-xl font-bold tracking-tight text-slate-900">STOCK SOLUTION</span>
            </div>
            <div className="flex items-center gap-4">
              <button 
                onClick={onLoginClick}
                className="text-slate-600 font-semibold hover:text-indigo-600 transition-colors"
              >
                تسجيل الدخول
              </button>
              <a 
                href="https://wa.me/212608469666"
                target="_blank"
                rel="noopener noreferrer"
                className="bg-emerald-500 text-white px-6 py-2.5 rounded-full font-semibold hover:bg-emerald-600 transition-all shadow-md shadow-emerald-100 flex items-center gap-2"
              >
                <MessageCircle size={18} />
                <span className="hidden sm:inline">تواصل عبر واتساب</span>
                <span className="font-mono text-emerald-100" dir="ltr">0608469666</span>
              </a>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="pt-32 pb-16 sm:pt-40 sm:pb-24 lg:pb-32 overflow-hidden relative">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full max-w-[1200px] pointer-events-none">
          <div className="absolute top-20 left-0 w-72 h-72 bg-indigo-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
          <div className="absolute top-20 right-0 w-72 h-72 bg-violet-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>
          <div className="absolute -bottom-8 left-20 w-72 h-72 bg-emerald-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-4000"></div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center max-w-4xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-50 text-indigo-600 font-semibold text-sm mb-8 border border-indigo-100"
            >
              <Sparkles size={16} />
              <span>المنصة رقم #1 لإدارة الأنشطة التجارية في المغرب</span>
            </motion.div>
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-5xl sm:text-6xl lg:text-7xl font-extrabold text-slate-900 tracking-tight mb-8 leading-tight"
            >
              نظام متكامل لإدارة <br className="hidden sm:block" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-600">مخزونك ومبيعاتك باحترافية</span>
            </motion.h1>
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-xl text-slate-600 mb-10 leading-relaxed max-w-2xl mx-auto"
            >
              كل ما يحتاجه نشاطك التجاري في مكان واحد: نقاط بيع سريعة، تتبع دقيق للمخزون، إدارة العملاء والمصروفات، وتقارير مالية مفصلة.
            </motion.p>
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="flex flex-col sm:flex-row gap-4 justify-center items-center"
            >
              <a 
                href="https://wa.me/212608469666"
                target="_blank"
                rel="noopener noreferrer"
                className="bg-emerald-500 text-white px-8 py-4 rounded-full font-bold text-lg hover:bg-emerald-600 transition-all shadow-xl shadow-emerald-200 flex items-center justify-center gap-3 w-full sm:w-auto"
              >
                <MessageCircle size={24} />
                احصل على نسختك الآن
                <span className="font-mono text-emerald-100 mr-2" dir="ltr">0608469666</span>
              </a>
            </motion.div>
          </div>

          {/* Dashboard Mockup */}
          <motion.div 
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.8 }}
            className="mt-20 relative max-w-5xl mx-auto"
          >
            <div className="rounded-2xl border border-slate-200/50 bg-white/50 backdrop-blur-xl p-2 shadow-2xl">
              <div className="rounded-xl overflow-hidden border border-slate-100 bg-slate-50">
                {/* Fake Browser Header */}
                <div className="h-10 bg-slate-100 border-b border-slate-200 flex items-center px-4 gap-2">
                  <div className="w-3 h-3 rounded-full bg-rose-400"></div>
                  <div className="w-3 h-3 rounded-full bg-amber-400"></div>
                  <div className="w-3 h-3 rounded-full bg-emerald-400"></div>
                  <div className="mx-auto bg-white px-4 py-1 rounded-md text-xs text-slate-400 font-mono flex items-center gap-2">
                    <Lock size={10} />
                    app.stocksolution.ma
                  </div>
                </div>
                {/* Fake App Content */}
                <div className="p-6 grid grid-cols-4 gap-6">
                  {/* Sidebar */}
                  <div className="col-span-1 border-l border-slate-200 pl-4 space-y-4 hidden md:block">
                    <div className="flex items-center gap-2 mb-8">
                      <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white">
                        <TrendingUp size={16} />
                      </div>
                      <div className="h-6 bg-slate-800 rounded w-24"></div>
                    </div>
                    {[
                      { icon: <LayoutDashboard size={18} />, active: true },
                      { icon: <Package size={18} /> },
                      { icon: <ShoppingCart size={18} /> },
                      { icon: <FileText size={18} /> },
                      { icon: <Users size={18} /> },
                      { icon: <Receipt size={18} /> }
                    ].map((item, i) => (
                      <div key={i} className={`h-10 rounded-lg flex items-center px-3 gap-3 ${item.active ? 'bg-indigo-50 text-indigo-600 border border-indigo-100' : 'text-slate-400'}`}>
                        {item.icon}
                        <div className={`h-3 rounded w-20 ${item.active ? 'bg-indigo-200' : 'bg-slate-200'}`}></div>
                      </div>
                    ))}
                  </div>
                  {/* Main Content */}
                  <div className="col-span-4 md:col-span-3 space-y-6">
                    <div className="flex justify-between items-center">
                      <div className="h-8 bg-slate-800 rounded-lg w-32"></div>
                      <div className="h-10 bg-indigo-600 rounded-lg w-32 flex items-center justify-center gap-2 text-white">
                        <Plus size={16} />
                        <div className="h-3 bg-indigo-200 rounded w-16"></div>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      {[
                        { color: 'text-emerald-600', bg: 'bg-emerald-100', icon: <TrendingUp size={20} /> },
                        { color: 'text-blue-600', bg: 'bg-blue-100', icon: <Package size={20} /> },
                        { color: 'text-violet-600', bg: 'bg-violet-100', icon: <ShoppingCart size={20} /> }
                      ].map((item, i) => (
                        <div key={i} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-center gap-4">
                          <div className={`w-12 h-12 rounded-full ${item.bg} ${item.color} flex items-center justify-center`}>
                            {item.icon}
                          </div>
                          <div>
                            <div className="h-3 bg-slate-200 rounded w-16 mb-2"></div>
                            <div className="h-6 bg-slate-800 rounded w-24"></div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="h-64 bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex flex-col">
                      <div className="h-4 bg-slate-200 rounded w-32 mb-6"></div>
                      <div className="flex-1 flex items-end gap-3">
                        {[40, 70, 45, 90, 65, 85, 100, 60, 80, 50, 75, 95].map((h, i) => (
                          <div key={i} className="w-full bg-indigo-100 rounded-t-sm relative group">
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-800 text-white text-xs py-1 px-2 rounded">
                              {h}k
                            </div>
                            <div className="w-full bg-indigo-500 rounded-t-sm transition-all duration-1000" style={{ height: `${h}%` }}></div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </main>

      {/* Trusted By Section */}
      <section className="py-10 border-y border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-8">يثق بنا أكثر من 500 نشاط تجاري في المغرب</p>
          <div className="flex flex-wrap justify-center items-center gap-8 sm:gap-16 opacity-50 grayscale hover:grayscale-0 transition-all duration-500">
            {/* Placeholder logos for businesses */}
            <div className="flex items-center gap-2 text-xl font-bold text-slate-800"><ShoppingCart size={28} /> سوبر ماركت الأمل</div>
            <div className="flex items-center gap-2 text-xl font-bold text-slate-800"><Package size={28} /> مخازن الجملة</div>
            <div className="flex items-center gap-2 text-xl font-bold text-slate-800"><TrendingUp size={28} /> شركة التوزيع</div>
            <div className="flex items-center gap-2 text-xl font-bold text-slate-800"><Users size={28} /> مؤسسة الخدمات</div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-12 bg-indigo-600 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div>
              <div className="text-4xl font-bold mb-2">+500</div>
              <div className="text-indigo-200">نشاط تجاري</div>
            </div>
            <div>
              <div className="text-4xl font-bold mb-2">+10K</div>
              <div className="text-indigo-200">فاتورة مصدرة</div>
            </div>
            <div>
              <div className="text-4xl font-bold mb-2">100%</div>
              <div className="text-indigo-200">حماية البيانات</div>
            </div>
            <div>
              <div className="text-4xl font-bold mb-2">24/7</div>
              <div className="text-indigo-200">دعم فني</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">كل ما تحتاجه لإدارة أعمالك بنجاح</h2>
            <p className="text-lg text-slate-600">منصة متكاملة توفر لك أدوات احترافية لتنظيم مبيعاتك ومخزونك بكل سهولة.</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <FeatureCard 
              icon={<ShoppingCart />}
              title="نقاط البيع (POS)"
              description="واجهة مبيعات سريعة وسهلة الاستخدام، تدعم قارئ الباركود وطباعة الفواتير الفورية."
              color="emerald"
            />
            <FeatureCard 
              icon={<Package />}
              title="إدارة المخزون"
              description="تتبع دقيق لحركة المنتجات، تنبيهات عند نقص المخزون، وجرد سهل وسريع."
              color="blue"
            />
            <FeatureCard 
              icon={<FileText />}
              title="فواتير احترافية"
              description="إنشاء فواتير مخصصة بشعار شركتك، متوافقة مع متطلبات الضرائب، وتصديرها PDF."
              color="violet"
            />
            <FeatureCard 
              icon={<Users />}
              title="إدارة العملاء"
              description="سجل كامل للعملاء، تتبع الديون والمستحقات، ومعرفة أفضل العملاء لديك."
              color="amber"
            />
            <FeatureCard 
              icon={<Wallet />}
              title="إدارة المصروفات"
              description="تسجيل وتصنيف المصروفات اليومية لمعرفة صافي الأرباح بدقة."
              color="rose"
            />
            <FeatureCard 
              icon={<BarChart3 />}
              title="تقارير وإحصائيات"
              description="لوحة تحكم شاملة تعرض أرباحك، مبيعاتك، وأداء نشاطك التجاري في الوقت الفعلي."
              color="indigo"
            />
          </div>
        </div>
      </section>

      {/* Why Choose Us */}
      <section className="py-24 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-6">لماذا تختار STOCK SOLUTION؟</h2>
              <p className="text-lg text-slate-600 mb-8">نحن نفهم احتياجات التاجر المغربي، لذلك صممنا نظاماً يجمع بين السهولة والاحترافية.</p>
              
              <div className="space-y-6">
                {[
                  { title: 'سهولة الاستخدام', desc: 'واجهة بسيطة باللغة العربية لا تتطلب خبرة تقنية سابقة.' },
                  { title: 'متوافق مع جميع الأجهزة', desc: 'يعمل على الكمبيوتر، التابلت، والهاتف الذكي بنفس الكفاءة.' },
                  { title: 'تعدد المستخدمين', desc: 'إضافة موظفين بصلاحيات مختلفة (مدير، كاشير، الخ).' },
                  { title: 'دعم فني متواصل', desc: 'فريقنا جاهز دائماً لمساعدتك والإجابة على استفساراتك.' }
                ].map((item, i) => (
                  <div key={i} className="flex gap-4">
                    <div className="w-12 h-12 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                      <CheckCircle size={24} />
                    </div>
                    <div>
                      <h4 className="text-xl font-bold text-slate-900 mb-1">{item.title}</h4>
                      <p className="text-slate-600">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500 to-violet-500 rounded-3xl transform rotate-3 opacity-20"></div>
              <img 
                src="https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80" 
                alt="Business Owner" 
                className="rounded-3xl shadow-2xl relative z-10 object-cover h-[600px] w-full"
                referrerPolicy="no-referrer"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-24 bg-slate-50 border-t border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">استثمار لمرة واحدة، نجاح مدى الحياة</h2>
            <p className="text-lg text-slate-600">احصل على وصول كامل لجميع ميزات النظام بدون اشتراكات شهرية أو رسوم خفية.</p>
          </div>

          <div className="max-w-lg mx-auto">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="bg-white rounded-3xl p-8 sm:p-12 shadow-2xl border border-indigo-100 relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500 opacity-10 rounded-bl-full"></div>
              
              <div className="text-center mb-8 relative z-10">
                <span className="inline-block py-1 px-3 rounded-full bg-indigo-100 text-indigo-700 font-semibold text-sm mb-4">الباقة الشاملة</span>
                <div className="flex justify-center items-baseline gap-2 mb-2">
                  <span className="text-5xl font-extrabold text-slate-900">149</span>
                  <span className="text-xl font-bold text-slate-500">درهم</span>
                </div>
                <p className="text-slate-500 font-medium">دفع لمرة واحدة / مدى الحياة</p>
              </div>

              <ul className="space-y-4 mb-8 relative z-10">
                {[
                  'إدارة غير محدودة للمخزون والمبيعات',
                  'نقاط بيع (POS) سريعة وسهلة',
                  'إنشاء فواتير وعروض أسعار وسندات تسليم',
                  'إدارة العملاء والديون والمصروفات',
                  'تقارير وإحصائيات مفصلة',
                  'دعم فني متواصل وتحديثات مجانية'
                ].map((feature, i) => (
                  <li key={i} className="flex items-center gap-3 text-slate-700">
                    <CheckCircle className="text-emerald-500 shrink-0" size={20} />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <a 
                href="https://wa.me/212608469666"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full block text-center bg-indigo-600 text-white px-6 py-4 rounded-xl font-bold text-lg hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200 relative z-10"
              >
                اشترك الآن
              </a>
            </motion.div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-gradient-to-br from-slate-900 to-indigo-900 rounded-3xl p-10 sm:p-16 text-center text-white shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full blur-3xl transform translate-x-1/2 -translate-y-1/2"></div>
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-500 opacity-20 rounded-full blur-3xl transform -translate-x-1/2 translate-y-1/2"></div>
            
            <h2 className="text-3xl sm:text-4xl font-bold mb-6 relative z-10">هل أنت مستعد لتطوير نشاطك التجاري؟</h2>
            <p className="text-indigo-100 text-lg mb-10 max-w-2xl mx-auto relative z-10">
              انضم إلى مئات التجار الذين يثقون في STOCK SOLUTION لإدارة أعمالهم. تواصل معنا الآن للحصول على نسختك.
            </p>
            <a 
              href="https://wa.me/212608469666"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-3 bg-emerald-500 text-white px-8 py-4 rounded-full font-bold text-lg hover:bg-emerald-600 transition-all shadow-xl shadow-emerald-500/30 relative z-10"
            >
              <MessageCircle size={24} />
              تواصل معنا عبر واتساب
              <span className="font-mono text-emerald-100 mr-2" dir="ltr">0608469666</span>
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-50 border-t border-slate-200 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="flex items-center justify-center gap-2 mb-6">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white">
              <TrendingUp size={18} />
            </div>
            <span className="text-xl font-bold text-slate-900">STOCK SOLUTION</span>
          </div>
          <p className="text-slate-500 mb-6">الحل الأمثل لإدارة الأنشطة التجارية في المغرب.</p>
          <div className="flex justify-center gap-6 mb-8">
            <a href="https://wa.me/212608469666" target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-emerald-500 transition-colors">
              <MessageCircle size={24} />
            </a>
            <a href="#" className="text-slate-400 hover:text-indigo-600 transition-colors">
              <Globe size={24} />
            </a>
          </div>
          <div className="text-slate-400 text-sm">
            © {new Date().getFullYear()} STOCK SOLUTION. جميع الحقوق محفوظة.
          </div>
        </div>
      </footer>

      {/* Floating WhatsApp Button */}
      <a
        href="https://wa.me/212608469666"
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-6 right-6 bg-emerald-500 text-white px-4 py-3 rounded-full flex items-center gap-2 shadow-lg shadow-emerald-500/40 hover:bg-emerald-600 hover:scale-105 transition-all z-50"
        aria-label="Contact on WhatsApp"
      >
        <MessageCircle size={24} />
        <span className="font-bold hidden sm:inline">تواصل معنا</span>
      </a>
    </div>
  );
}

function FeatureCard({ icon, title, description, color }: { icon: React.ReactNode, title: string, description: string, color: string }) {
  const colorClasses = {
    emerald: 'bg-emerald-100 text-emerald-600',
    blue: 'bg-blue-100 text-blue-600',
    violet: 'bg-violet-100 text-violet-600',
    amber: 'bg-amber-100 text-amber-600',
    rose: 'bg-rose-100 text-rose-600',
    indigo: 'bg-indigo-100 text-indigo-600',
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="bg-slate-50 p-8 rounded-3xl border border-slate-200 hover:shadow-xl hover:shadow-slate-200/50 hover:-translate-y-1 transition-all duration-300"
    >
      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-6 ${colorClasses[color as keyof typeof colorClasses]}`}>
        {icon}
      </div>
      <h3 className="text-xl font-bold mb-3 text-slate-900">{title}</h3>
      <p className="text-slate-600 leading-relaxed">{description}</p>
    </motion.div>
  );
}

// --- Login Component ---
function Login({ onLogin, onBack }: { onLogin: (user: User) => void, onBack: () => void }) {
  const [email, setEmail] = useState('admin@example.com');
  const [password, setPassword] = useState('admin');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (email === 'superadmin@system.com' && password === 'superadmin123') {
      onLogin({ id: 'superadmin', name: 'مدير النظام', email, role: 'superadmin' });
      return;
    }

    const users = storage.getUsers();
    const user = users.find(u => u.email === email && u.password === password);
    
    if (user) {
      onLogin(user);
    } else {
      setError('البريد الإلكتروني أو كلمة المرور غير صحيحة');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white w-full max-w-md rounded-3xl shadow-xl border border-slate-200 overflow-hidden"
      >
        <div className="p-8 text-center bg-indigo-600 text-white relative">
          <button 
            onClick={onBack}
            className="absolute top-4 left-4 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
          >
            <ArrowRight size={20} className="rotate-180" />
          </button>
          <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
            <TrendingUp size={32} />
          </div>
          <h1 className="text-2xl font-bold">STOCK SOLUTION</h1>
          <p className="text-indigo-100 mt-2">يرجى تسجيل الدخول للمتابعة</p>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          {error && (
            <div className="bg-rose-50 text-rose-600 p-3 rounded-xl text-sm flex items-center gap-2 border border-rose-100">
              <AlertTriangle size={16} />
              {error}
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-600 block pr-1">البريد الإلكتروني</label>
            <div className="relative">
              <UserIcon className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="email" 
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pr-10 pl-4 outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                placeholder="example@mail.com"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-600 block pr-1">كلمة المرور</label>
            <div className="relative">
              <Lock className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="password" 
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pr-10 pl-4 outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                placeholder="••••••••"
              />
            </div>
          </div>

          <button 
            type="submit"
            className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
          >
            <LogIn size={20} />
            تسجيل الدخول
          </button>

          <div className="text-center">
            <p className="text-xs text-slate-400">
              بيانات الدخول الافتراضية: admin@example.com / admin123
            </p>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// --- Super Admin Panel Component ---
function SuperAdminPanel({ 
  clients, 
  onUpdateClients, 
  users, 
  onUpdateUsers, 
  onLogout 
}: { 
  clients: Client[], 
  onUpdateClients: (c: Client[]) => void, 
  users: User[],
  onUpdateUsers: (u: User[]) => void,
  onLogout: () => void 
}) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [newClient, setNewClient] = useState({ name: '', adminEmail: '', adminPassword: '' });
  const [editingClient, setEditingClient] = useState<Client | null>(null);

  const handleAddClient = (e: React.FormEvent) => {
    e.preventDefault();
    const clientId = `client-${Date.now()}`;
    
    const client: Client = {
      id: clientId,
      name: newClient.name,
      isActive: true,
      contactMessage: 'انتهى الاشتراك، المرجو التواصل مع الإدارة لتجديد الدفع.',
      createdAt: new Date().toISOString()
    };
    
    const adminUser: User = {
      id: `user-${Date.now()}`,
      name: `مدير ${newClient.name}`,
      email: newClient.adminEmail,
      password: newClient.adminPassword,
      role: 'admin',
      clientId: clientId
    };

    onUpdateClients([...clients, client]);
    onUpdateUsers([...users, adminUser]);
    setShowAddModal(false);
    setNewClient({ name: '', adminEmail: '', adminPassword: '' });
  };

  const handleUpdateClient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClient) return;
    
    const updated = clients.map(c => c.id === editingClient.id ? editingClient : c);
    onUpdateClients(updated);
    setEditingClient(null);
  };

  const toggleClientStatus = (id: string) => {
    const updated = clients.map(c => c.id === id ? { ...c, isActive: !c.isActive } : c);
    onUpdateClients(updated);
  };

  const activeClientsCount = clients.filter(c => c.isActive).length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-300 font-sans selection:bg-indigo-500/30 pb-20" dir="rtl">
      {/* Header */}
      <header className="bg-slate-900/80 backdrop-blur-xl border-b border-slate-800 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
              <ShieldAlert size={24} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">لوحة تحكم الإدارة العليا</h1>
              <p className="text-xs text-slate-400 font-mono mt-0.5">Super Admin Console v3.0</p>
            </div>
          </div>
          <button onClick={onLogout} className="text-slate-400 hover:text-white flex items-center gap-2 bg-slate-800/50 hover:bg-slate-800 px-4 py-2.5 rounded-xl transition-all border border-slate-700/50">
            <LogOut size={18} />
            <span className="text-sm font-medium">تسجيل الخروج</span>
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 mt-10 space-y-8">
        {/* Stats / Info Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex items-start gap-4">
            <div className="p-3 bg-blue-500/10 text-blue-400 rounded-xl">
              <Globe size={24} />
            </div>
            <div>
              <p className="text-sm text-slate-400 mb-1">إجمالي العملاء</p>
              <p className="text-2xl font-bold text-white">{clients.length}</p>
            </div>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex items-start gap-4">
            <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl">
              <Activity size={24} />
            </div>
            <div>
              <p className="text-sm text-slate-400 mb-1">العملاء النشطين</p>
              <p className="text-2xl font-bold text-white">{activeClientsCount}</p>
            </div>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex items-start gap-4">
            <div className="p-3 bg-purple-500/10 text-purple-400 rounded-xl">
              <Server size={24} />
            </div>
            <div>
              <p className="text-sm text-slate-400 mb-1">الخادم</p>
              <p className="text-lg font-bold text-white font-mono">eu-west-2a</p>
            </div>
          </div>
        </div>

        {/* Clients List */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
          <div className="p-6 border-b border-slate-800 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <Users className="text-indigo-400" size={24} />
              <h2 className="text-xl font-bold text-white">إدارة العملاء والشركات</h2>
            </div>
            <button 
              onClick={() => setShowAddModal(true)}
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl font-bold transition-all shadow-lg shadow-indigo-500/25 flex items-center gap-2 text-sm"
            >
              <UserIcon size={18} />
              إضافة عميل جديد
            </button>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-right">
              <thead className="bg-slate-950/50 border-b border-slate-800 text-slate-400 text-sm">
                <tr>
                  <th className="p-4 font-medium">اسم العميل / الشركة</th>
                  <th className="p-4 font-medium">تاريخ الانضمام</th>
                  <th className="p-4 font-medium">حالة النظام</th>
                  <th className="p-4 font-medium">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {clients.map(client => (
                  <tr key={client.id} className="hover:bg-slate-800/20 transition-colors">
                    <td className="p-4">
                      <div className="font-bold text-white">{client.name}</div>
                      <div className="text-xs text-slate-500 font-mono mt-1">{client.id}</div>
                    </td>
                    <td className="p-4 text-slate-400">
                      {format(new Date(client.createdAt), 'dd MMM yyyy', { locale: ar })}
                    </td>
                    <td className="p-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
                        client.isActive 
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                          : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${client.isActive ? 'bg-emerald-400' : 'bg-rose-400'}`}></span>
                        {client.isActive ? 'نشط' : 'متوقف'}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => toggleClientStatus(client.id)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                            client.isActive 
                              ? 'bg-rose-500/10 text-rose-400 hover:bg-rose-500/20' 
                              : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                          }`}
                        >
                          {client.isActive ? 'إيقاف النظام' : 'تفعيل النظام'}
                        </button>
                        <button 
                          onClick={() => setEditingClient(client)}
                          className="p-1.5 text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-colors"
                          title="تعديل رسالة الإيقاف"
                        >
                          <Edit size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {clients.length === 0 && (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-slate-500">
                      لا يوجد عملاء حالياً. قم بإضافة عميل جديد.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Add Client Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="p-6 border-b border-slate-800 flex justify-between items-center">
                <h3 className="text-xl font-bold text-white">إضافة عميل جديد</h3>
                <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white">
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleAddClient} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-300 mb-2">اسم الشركة / العميل</label>
                  <input 
                    type="text" 
                    required
                    value={newClient.name} 
                    onChange={e => setNewClient({...newClient, name: e.target.value})} 
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="مثال: شركة الأمل للتجارة"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-300 mb-2">البريد الإلكتروني لمدير النظام</label>
                  <input 
                    type="email" 
                    required
                    value={newClient.adminEmail} 
                    onChange={e => setNewClient({...newClient, adminEmail: e.target.value})} 
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="admin@company.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-300 mb-2">كلمة المرور لمدير النظام</label>
                  <input 
                    type="text" 
                    required
                    value={newClient.adminPassword} 
                    onChange={e => setNewClient({...newClient, adminPassword: e.target.value})} 
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="أدخل كلمة مرور قوية"
                  />
                </div>
                <div className="pt-4 flex gap-3">
                  <button 
                    type="submit"
                    className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded-xl font-bold transition-colors"
                  >
                    إضافة العميل
                  </button>
                  <button 
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="flex-1 bg-slate-800 hover:bg-slate-700 text-white py-3 rounded-xl font-bold transition-colors"
                  >
                    إلغاء
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {/* Edit Client Modal */}
        {editingClient && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="p-6 border-b border-slate-800 flex justify-between items-center">
                <h3 className="text-xl font-bold text-white">تعديل إعدادات العميل</h3>
                <button onClick={() => setEditingClient(null)} className="text-slate-400 hover:text-white">
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleUpdateClient} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-300 mb-2">اسم الشركة / العميل</label>
                  <input 
                    type="text" 
                    required
                    value={editingClient.name} 
                    onChange={e => setEditingClient({...editingClient, name: e.target.value})} 
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-300 mb-2">رسالة الإيقاف</label>
                  <textarea 
                    required
                    value={editingClient.contactMessage} 
                    onChange={e => setEditingClient({...editingClient, contactMessage: e.target.value})} 
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white outline-none focus:ring-2 focus:ring-indigo-500 h-32 resize-none"
                  />
                </div>
                <div className="pt-4 flex gap-3">
                  <button 
                    type="submit"
                    className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded-xl font-bold transition-colors"
                  >
                    حفظ التعديلات
                  </button>
                  <button 
                    type="button"
                    onClick={() => setEditingClient(null)}
                    className="flex-1 bg-slate-800 hover:bg-slate-700 text-white py-3 rounded-xl font-bold transition-colors"
                  >
                    إلغاء
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// --- Locked Screen Component ---
function LockedScreen({ message, onLogout }: { message: string, onLogout: () => void }) {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 relative overflow-hidden" dir="rtl">
      {/* Modern Background Pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>
      <div className="absolute left-0 right-0 top-0 -z-10 m-auto h-[310px] w-[310px] rounded-full bg-rose-500 opacity-20 blur-[100px]"></div>

      <motion.div 
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="bg-white/80 backdrop-blur-2xl w-full max-w-lg rounded-[2.5rem] shadow-2xl border border-white p-10 text-center relative z-10"
      >
        <div className="relative w-28 h-28 mx-auto mb-8">
          <div className="absolute inset-0 bg-rose-100 rounded-full animate-ping opacity-50"></div>
          <div className="relative w-full h-full bg-gradient-to-br from-rose-100 to-rose-50 text-rose-600 rounded-full flex items-center justify-center shadow-inner border border-rose-200">
            <Lock size={48} strokeWidth={1.5} />
          </div>
        </div>
        
        <h1 className="text-3xl font-black text-slate-900 mb-4 tracking-tight">تم إيقاف النظام</h1>
        
        <div className="bg-slate-50 border border-slate-100 rounded-2xl p-6 mb-8">
          <p className="text-lg text-slate-600 leading-relaxed font-medium">
            {message}
          </p>
        </div>
        
        <button 
          onClick={onLogout}
          className="w-full bg-slate-900 text-white hover:bg-slate-800 py-4 rounded-2xl font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-slate-900/20"
        >
          <LogOut size={20} />
          تسجيل الخروج والعودة
        </button>
      </motion.div>
      
      <div className="absolute bottom-8 text-slate-400 text-sm font-medium">
        نظام المبيعات المتكامل &copy; {new Date().getFullYear()}
      </div>
    </div>
  );
}

// --- Dashboard Component ---
function Dashboard({ products, sales, onNavigate }: { products: Product[], sales: Sale[], onNavigate: (tab: TabType) => void, key?: string }) {
  const totalSales = sales.reduce((acc, s) => acc + s.totalAmount, 0);
  const lowStockProducts = products.filter(p => p.stock <= p.minStock);
  
  const chartData = sales.slice(0, 7).reverse().map(s => ({
    date: format(new Date(s.date), 'dd MMM', { locale: ar }),
    amount: s.totalAmount
  }));

  const categoryData = products.reduce((acc: any[], p) => {
    const existing = acc.find(a => a.name === p.category);
    if (existing) {
      existing.value += p.stock;
    } else {
      acc.push({ name: p.category, value: p.stock });
    }
    return acc;
  }, []);

  const COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-8"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="إجمالي المبيعات" 
          value={`${totalSales.toLocaleString()} درهم`} 
          icon={<TrendingUp className="text-emerald-600" />} 
          trend="+12%" 
          color="bg-emerald-50"
        />
        <StatCard 
          title="عدد المنتجات" 
          value={products.length.toString()} 
          icon={<Package className="text-indigo-600" />} 
          trend="ثابت" 
          color="bg-indigo-50"
        />
        <StatCard 
          title="إجمالي المخزون" 
          value={products.reduce((acc, p) => acc + p.stock, 0).toString()} 
          icon={<ShoppingCart className="text-amber-600" />} 
          trend="-5%" 
          color="bg-amber-50"
        />
        <StatCard 
          title="تنبيهات النقص" 
          value={lowStockProducts.length.toString()} 
          icon={<AlertTriangle className="text-rose-600" />} 
          trend={lowStockProducts.length > 0 ? "عاجل" : "جيد"} 
          color="bg-rose-50"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-bold">نمو المبيعات (آخر 7 عمليات)</h3>
            <button 
              onClick={() => onNavigate('reports')}
              className="text-sm text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1"
            >
              عرض التقارير المفصلة
              <ArrowRight size={16} className="rotate-180" />
            </button>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="amount" fill="#4f46e5" radius={[4, 4, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="text-lg font-bold mb-6">توزيع المخزون حسب الفئة</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryData}
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {categoryData.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 space-y-2">
            {categoryData.map((c: any, i: number) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }}></div>
                  <span className="text-slate-600">{c.name}</span>
                </div>
                <span className="font-bold">{c.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function StatCard({ title, value, icon, trend, color }: { title: string, value: string, icon: React.ReactNode, trend: string, color: string }) {
  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-slate-500 text-sm font-medium mb-1">{title}</p>
          <h4 className="text-2xl font-bold">{value}</h4>
        </div>
        <div className={cn("p-3 rounded-xl", color)}>
          {icon}
        </div>
      </div>
      <div className="mt-4 flex items-center gap-2">
        <span className={cn(
          "text-xs font-bold px-2 py-1 rounded-full",
          trend.includes('+') ? "bg-emerald-100 text-emerald-700" : 
          trend.includes('-') ? "bg-rose-100 text-rose-700" : "bg-slate-100 text-slate-700"
        )}>
          {trend}
        </span>
        <span className="text-slate-400 text-xs">مقارنة بالشهر الماضي</span>
      </div>
    </div>
  );
}

// --- Inventory Component ---
function Inventory({ products, onUpdate }: { products: Product[], onUpdate: (p: Product[]) => void, key?: string }) {
  const [isAdding, setIsAdding] = useState(false);
  const [newProduct, setNewProduct] = useState<Partial<Product>>({
    name: '', category: '', price: 0, purchasePrice: 0, stock: 0, minStock: 0, unit: 'قطعة'
  });

  const handleAdd = () => {
    if (!newProduct.name || !newProduct.price) return;
    const product: Product = {
      id: Date.now().toString(),
      name: newProduct.name!,
      category: newProduct.category || 'عام',
      price: Number(newProduct.price),
      purchasePrice: Number(newProduct.purchasePrice || 0),
      stock: Number(newProduct.stock),
      minStock: Number(newProduct.minStock),
      unit: newProduct.unit || 'قطعة'
    };
    onUpdate([...products, product]);
    setIsAdding(false);
    setNewProduct({ name: '', category: '', price: 0, purchasePrice: 0, stock: 0, minStock: 0, unit: 'قطعة' });
  };

  const handleDelete = (id: string) => {
    onUpdate(products.filter(p => p.id !== id));
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">قائمة المنتجات</h2>
        <button 
          onClick={() => setIsAdding(true)}
          className="bg-indigo-600 text-white px-4 py-2 rounded-xl flex items-center gap-2 hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-100"
        >
          <Plus size={20} />
          إضافة منتج جديد
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-x-auto">
        <table className="w-full text-right min-w-[600px]">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-6 py-4 font-bold text-slate-600">المنتج</th>
              <th className="px-6 py-4 font-bold text-slate-600">الفئة</th>
              <th className="px-6 py-4 font-bold text-slate-600">سعر البيع</th>
              <th className="px-6 py-4 font-bold text-slate-600">سعر الشراء</th>
              <th className="px-6 py-4 font-bold text-slate-600">المخزون</th>
              <th className="px-6 py-4 font-bold text-slate-600">الحالة</th>
              <th className="px-6 py-4 font-bold text-slate-600">الإجراءات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {products.map(p => (
              <tr 
                key={p.id} 
                className={cn(
                  "hover:bg-slate-50 transition-colors",
                  p.stock <= p.minStock && "bg-rose-50/30"
                )}
              >
                <td className="px-6 py-4 font-medium">
                  <div className="flex items-center gap-2">
                    {p.name}
                    {p.stock <= p.minStock && (
                      <AlertTriangle size={16} className="text-rose-500" />
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 text-slate-500">{p.category}</td>
                <td className="px-6 py-4 font-bold text-indigo-600">{p.price.toLocaleString()} درهم</td>
                <td className="px-6 py-4 font-bold text-emerald-600">{p.purchasePrice?.toLocaleString() || 0} درهم</td>
                <td className={cn(
                  "px-6 py-4 font-medium",
                  p.stock <= p.minStock ? "text-rose-600" : "text-slate-700"
                )}>
                  {p.stock} {p.unit}
                </td>
                <td className="px-6 py-4">
                  <span className={cn(
                    "px-3 py-1 rounded-full text-xs font-bold inline-flex items-center gap-1",
                    p.stock <= p.minStock ? "bg-rose-100 text-rose-700 shadow-sm shadow-rose-100" : "bg-emerald-100 text-emerald-700"
                  )}>
                    {p.stock <= p.minStock ? (
                      <>
                        <AlertTriangle size={12} />
                        مخزون منخفض
                      </>
                    ) : 'متوفر'}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <button className="text-slate-400 hover:text-indigo-600 transition-colors"><Edit size={18} /></button>
                    <button 
                      onClick={() => handleDelete(p.id)}
                      className="text-slate-400 hover:text-rose-600 transition-colors"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isAdding && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl"
          >
            <h3 className="text-xl font-bold mb-6">إضافة منتج جديد</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">اسم المنتج</label>
                <input 
                  type="text" 
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                  value={newProduct.name}
                  onChange={e => setNewProduct({...newProduct, name: e.target.value})}
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">الفئة</label>
                  <input 
                    type="text" 
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                    value={newProduct.category}
                    onChange={e => setNewProduct({...newProduct, category: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">سعر البيع</label>
                  <input 
                    type="number" 
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                    value={newProduct.price}
                    onChange={e => setNewProduct({...newProduct, price: Number(e.target.value)})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">سعر الشراء</label>
                  <input 
                    type="number" 
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                    value={newProduct.purchasePrice}
                    onChange={e => setNewProduct({...newProduct, purchasePrice: Number(e.target.value)})}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">المخزون الحالي</label>
                  <input 
                    type="number" 
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                    value={newProduct.stock}
                    onChange={e => setNewProduct({...newProduct, stock: Number(e.target.value)})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">الحد الأدنى</label>
                  <input 
                    type="number" 
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                    value={newProduct.minStock}
                    onChange={e => setNewProduct({...newProduct, minStock: Number(e.target.value)})}
                  />
                </div>
              </div>
            </div>
            <div className="mt-8 flex gap-4">
              <button 
                onClick={handleAdd}
                className="flex-1 bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition-colors"
              >
                حفظ المنتج
              </button>
              <button 
                onClick={() => setIsAdding(false)}
                className="flex-1 bg-slate-100 text-slate-600 py-3 rounded-xl font-bold hover:bg-slate-200 transition-colors"
              >
                إلغاء
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}

// --- Sales Component ---
function Sales({ products, onAddSale }: { products: Product[], onAddSale: (s: Sale, status: Invoice['status'], type: Invoice['type']) => void, key?: string }) {
  const [cart, setCart] = useState<SaleItem[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [status, setStatus] = useState<Invoice['status']>('paid');
  const [documentType, setDocumentType] = useState<Invoice['type']>('invoice');

  const addToCart = (product: Product) => {
    const existing = cart.find(item => item.productId === product.id);
    if (existing) {
      if (existing.quantity >= product.stock) return;
      setCart(cart.map(item => 
        item.productId === product.id 
          ? { ...item, quantity: item.quantity + 1, total: (item.quantity + 1) * item.price }
          : item
      ));
    } else {
      if (product.stock <= 0) return;
      setCart([...cart, {
        productId: product.id,
        productName: product.name,
        quantity: 1,
        price: product.price,
        purchasePrice: product.purchasePrice || 0,
        total: product.price
      }]);
    }
  };

  const removeFromCart = (productId: string) => {
    setCart(cart.filter(item => item.productId !== productId));
  };

  const totalAmount = cart.reduce((acc, item) => acc + item.total, 0);

  const handleCheckout = () => {
    if (cart.length === 0) return;
    const sale: Sale = {
      id: Date.now().toString(),
      date: new Date().toISOString(),
      items: cart,
      totalAmount,
      customerName
    };
    onAddSale(sale, status, documentType);
    setCart([]);
    setCustomerName('');
    setStatus('paid');
    setDocumentType('invoice');
    alert('تمت العملية بنجاح!');
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-full"
    >
      <div className="lg:col-span-2 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">اختر المنتجات</h2>
          <div className="flex gap-2">
            <span className="bg-white px-3 py-1 rounded-lg border border-slate-200 text-sm text-slate-500">الكل</span>
            <span className="bg-white px-3 py-1 rounded-lg border border-slate-200 text-sm text-slate-500">إلكترونيات</span>
            <span className="bg-white px-3 py-1 rounded-lg border border-slate-200 text-sm text-slate-500">أثاث</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {products.map(p => (
            <button 
              key={p.id}
              onClick={() => addToCart(p)}
              disabled={p.stock <= 0}
              className={cn(
                "bg-white p-4 rounded-2xl border border-slate-200 text-right hover:border-indigo-500 hover:shadow-md transition-all group",
                p.stock <= 0 && "opacity-50 cursor-not-allowed"
              )}
            >
              <div className="w-full aspect-square bg-slate-50 rounded-xl mb-4 flex items-center justify-center text-slate-300 group-hover:text-indigo-200 transition-colors">
                <Package size={48} />
              </div>
              <h4 className="font-bold mb-1">{p.name}</h4>
              <p className="text-xs text-slate-400 mb-2">{p.category}</p>
              <div className="flex items-center justify-between">
                <span className="text-indigo-600 font-bold">{p.price.toLocaleString()} درهم</span>
                <span className="text-xs text-slate-500">مخزون: {p.stock}</span>
              </div>
              <div className="text-xs text-emerald-600 font-medium mt-1 text-right">
                شراء: {p.purchasePrice?.toLocaleString() || 0} درهم
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-xl flex flex-col overflow-hidden">
        <div className="p-6 border-b border-slate-100">
          <h3 className="text-xl font-bold flex items-center gap-2">
            <ShoppingCart size={24} className="text-indigo-600" />
            سلة المشتريات
          </h3>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-4">
              <ShoppingCart size={64} strokeWidth={1} />
              <p>السلة فارغة حالياً</p>
            </div>
          ) : (
            cart.map(item => (
              <div key={item.productId} className="flex items-center gap-4 bg-slate-50 p-3 rounded-xl">
                <div className="flex-1">
                  <h5 className="font-bold text-sm">{item.productName}</h5>
                  <p className="text-xs text-slate-500">{item.quantity} × {item.price.toLocaleString()} درهم</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-indigo-600 text-sm">{item.total.toLocaleString()} درهم</p>
                  <button 
                    onClick={() => removeFromCart(item.productId)}
                    className="text-rose-500 hover:text-rose-700 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="p-6 bg-slate-50 border-t border-slate-100 space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">اسم العميل (اختياري)</label>
            <input 
              type="text" 
              placeholder="أدخل اسم العميل..."
              className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              value={customerName}
              onChange={e => setCustomerName(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">نوع الوثيقة</label>
            <select
              className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              value={documentType}
              onChange={e => setDocumentType(e.target.value as Invoice['type'])}
            >
              <option value="invoice">فاتورة (مبيعات)</option>
              <option value="quote">عرض سعر (Devis)</option>
              <option value="delivery_note">سند تسليم (Bon de livraison)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">حالة الوثيقة</label>
            <select
              className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              value={status}
              onChange={e => setStatus(e.target.value as Invoice['status'])}
            >
              <option value="paid">مدفوعة</option>
              <option value="pending">معلقة (آجلة)</option>
            </select>
          </div>
          <div className="flex items-center justify-between pt-2">
            <span className="font-bold text-slate-600">الإجمالي:</span>
            <span className="text-2xl font-black text-indigo-600">{totalAmount.toLocaleString()} درهم</span>
          </div>
          <button 
            onClick={handleCheckout}
            disabled={cart.length === 0}
            className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 disabled:bg-slate-300 disabled:shadow-none transition-all"
          >
            إتمام العملية
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// --- Invoices Component ---
function Invoices({ invoices, onDelete, onUpdateStatus, settings, typeFilter = 'all' }: { invoices: Invoice[], onDelete: (id: string) => void, onUpdateStatus: (id: string, status: Invoice['status']) => void, settings: InvoiceSettings, typeFilter?: 'all' | 'invoice' | 'quote' | 'delivery_note', key?: string }) {
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<Invoice['status'] | 'all'>('all');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  
  const parentRef = useRef<HTMLDivElement>(null);

  const filteredInvoices = invoices.filter(inv => {
    const matchesSearch = inv.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (inv.customerName && inv.customerName.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || inv.status === statusFilter;
    const matchesType = typeFilter === 'all' || (inv.type || 'invoice') === typeFilter;
    
    let matchesDate = true;
    if (dateRange.start) {
      matchesDate = matchesDate && new Date(inv.date) >= new Date(dateRange.start);
    }
    if (dateRange.end) {
      const endDate = new Date(dateRange.end);
      endDate.setHours(23, 59, 59, 999);
      matchesDate = matchesDate && new Date(inv.date) <= endDate;
    }
    
    return matchesSearch && matchesStatus && matchesDate && matchesType;
  });

  const rowVirtualizer = useVirtualizer({
    count: filteredInvoices.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 73, // Estimated row height
    overscan: 5,
  });

  const confirmDelete = () => {
    if (deleteId) {
      onDelete(deleteId);
      setDeleteId(null);
    }
  };

  const handleShareWhatsApp = (invoice: Invoice) => {
    const typeName = invoice.type === 'quote' ? 'عرض السعر' : invoice.type === 'delivery_note' ? 'سند التسليم' : 'الفاتورة';
    const text = `مرحباً،\nإليك تفاصيل ${typeName} رقم ${invoice.invoiceNumber}:\n\nالتاريخ: ${format(new Date(invoice.date), 'yyyy/MM/dd HH:mm', { locale: ar })}\nالإجمالي: ${invoice.totalAmount.toLocaleString()} درهم\n\nشكراً لتعاملكم معنا!`;
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  const exportToCSV = () => {
    const BOM = '\uFEFF';
    const headers = ['رقم الفاتورة', 'التاريخ', 'العميل', 'المبلغ الإجمالي', 'الحالة'];
    
    const rows = invoices.map(inv => [
      inv.invoiceNumber,
      format(new Date(inv.date), 'yyyy/MM/dd HH:mm', { locale: ar }),
      inv.customerName || 'عميل نقدي',
      inv.totalAmount.toString(),
      inv.status === 'paid' ? 'مدفوعة' : inv.status === 'pending' ? 'معلقة' : 'ملغاة'
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `sales_report_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToPDF = async () => {
    const element = document.getElementById('invoices-table-container');
    if (!element) return;

    const originalOverflow = element.style.overflow;
    element.style.overflow = 'visible';

    try {
      const dataUrl = await toPng(element, {
        cacheBust: true,
        pixelRatio: 2,
        style: {
          overflow: 'visible'
        }
      });
      
      const pdf = new jsPDF('l', 'mm', 'a4'); // Landscape for better table fit
      const pdfWidth = pdf.internal.pageSize.getWidth();
      
      // Calculate height based on aspect ratio
      const imgProps = pdf.getImageProperties(dataUrl);
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      
      pdf.addImage(dataUrl, 'PNG', 0, 10, pdfWidth, pdfHeight);
      pdf.save(`sales_report_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('حدث خطأ أثناء إنشاء ملف PDF. يرجى المحاولة مرة أخرى.');
    } finally {
      element.style.overflow = originalOverflow;
    }
  };

  const handlePrint = (invoice: Invoice) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('يرجى السماح بالنوافذ المنبثقة للطباعة');
      return;
    }

    const typeName = invoice.type === 'quote' ? 'عرض سعر' : invoice.type === 'delivery_note' ? 'سند تسليم' : 'فاتورة مبيعات';

    const html = `
      <html dir="rtl" lang="ar">
        <head>
          <title>${typeName} رقم ${invoice.invoiceNumber}</title>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 40px; color: #333; }
            .header { text-align: center; margin-bottom: 40px; border-bottom: 2px solid #eee; padding-bottom: 20px; }
            .header h1 { margin: 0; color: ${settings.primaryColor}; }
            .header img { max-height: 100px; margin-bottom: 15px; object-fit: contain; }
            .details { display: flex; justify-content: space-between; margin-bottom: 40px; }
            .details div { flex: 1; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
            th, td { padding: 12px; text-align: right; border-bottom: 1px solid #eee; }
            th { background-color: #f8fafc; font-weight: bold; color: ${settings.primaryColor}; }
            .total { text-align: left; font-size: 1.5em; font-weight: bold; color: ${settings.primaryColor}; margin-top: 20px; }
            .footer { text-align: center; margin-top: 50px; font-size: 0.9em; color: #666; }
            @media print {
              body { padding: 0; }
              @page { margin: 2cm; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            ${settings.logo ? `<img src="${settings.logo}" alt="Logo" />` : ''}
            <h1>${settings.companyName || typeName}</h1>
            ${settings.taxNumber ? `<p style="color: #666; margin-top: 5px;">الرقم الضريبي: ${settings.taxNumber}</p>` : ''}
            <p style="margin-top: 15px; font-weight: bold;">${typeName} رقم: ${invoice.invoiceNumber}</p>
          </div>
          <div class="details">
            <div>
              <strong>تاريخ الإصدار:</strong><br>
              ${format(new Date(invoice.date), 'yyyy/MM/dd HH:mm', { locale: ar })}
            </div>
            <div>
              <strong>العميل:</strong><br>
              ${invoice.customerName || 'عميل نقدي'}
            </div>
            <div>
              <strong>الحالة:</strong><br>
              ${invoice.status === 'paid' ? 'مدفوعة' : invoice.status === 'pending' ? 'معلقة' : 'ملغاة'}
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th>المنتج</th>
                <th>الكمية</th>
                <th>السعر</th>
                <th>الإجمالي</th>
              </tr>
            </thead>
            <tbody>
              ${invoice.items.map(item => `
                <tr>
                  <td>${item.productName}</td>
                  <td>${item.quantity}</td>
                  <td>${item.price.toLocaleString()} درهم</td>
                  <td>${item.total.toLocaleString()} درهم</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <div class="total">
            الإجمالي النهائي: ${invoice.totalAmount.toLocaleString()} درهم
          </div>
          <div class="footer">
            شكراً لتعاملكم معنا!
          </div>
          <script>
            window.onload = () => {
              window.print();
              setTimeout(() => window.close(), 500);
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">سجل الفواتير</h2>
        <div className="flex gap-3">
          <button 
            onClick={exportToCSV}
            className="bg-white text-slate-600 px-4 py-2 rounded-xl border border-slate-200 flex items-center gap-2 hover:bg-slate-50 transition-colors"
          >
            <Download size={20} />
            تصدير CSV
          </button>
          <button 
            onClick={exportToPDF}
            className="bg-indigo-600 text-white px-4 py-2 rounded-xl flex items-center gap-2 hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-100"
          >
            <FileText size={20} />
            تصدير PDF
          </button>
        </div>
      </div>

      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col lg:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input 
            type="text" 
            placeholder="البحث برقم الفاتورة أو اسم العميل..."
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-12 pl-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex gap-4">
          <select
            className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
          >
            <option value="all">جميع الحالات</option>
            <option value="paid">مدفوعة</option>
            <option value="pending">معلقة</option>
            <option value="cancelled">ملغاة</option>
          </select>
          <input 
            type="date" 
            className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500"
            value={dateRange.start}
            onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
          />
          <input 
            type="date" 
            className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500"
            value={dateRange.end}
            onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
          />
        </div>
      </div>

      <div id="invoices-table-container" className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-right min-w-[800px]">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 font-bold text-slate-600 w-[15%]">رقم الفاتورة</th>
                <th className="px-6 py-4 font-bold text-slate-600 w-[20%]">التاريخ</th>
                <th className="px-6 py-4 font-bold text-slate-600 w-[25%]">العميل</th>
                <th className="px-6 py-4 font-bold text-slate-600 w-[15%]">المبلغ</th>
                <th className="px-6 py-4 font-bold text-slate-600 w-[10%]">الحالة</th>
                <th className="px-6 py-4 font-bold text-slate-600 w-[15%]">الإجراءات</th>
              </tr>
            </thead>
          </table>
        </div>
        
        <div 
          ref={parentRef} 
          className="overflow-auto"
          style={{ height: '500px' }} // Fixed height for virtualizer
        >
          <div
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            <table className="w-full text-right min-w-[800px] absolute top-0 left-0">
              <tbody className="divide-y divide-slate-100">
                {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                  const inv = filteredInvoices[virtualRow.index];
                  return (
                    <tr 
                      key={inv.id} 
                      className="hover:bg-slate-50 transition-colors absolute w-full flex"
                      style={{
                        height: `${virtualRow.size}px`,
                        transform: `translateY(${virtualRow.start}px)`,
                      }}
                    >
                      <td className="px-6 py-4 font-mono text-sm font-bold w-[15%] flex items-center">{inv.invoiceNumber}</td>
                      <td className="px-6 py-4 text-slate-500 w-[20%] flex items-center">
                        {format(new Date(inv.date), 'yyyy/MM/dd HH:mm', { locale: ar })}
                      </td>
                      <td className="px-6 py-4 w-[25%] flex items-center">{inv.customerName || 'عميل نقدي'}</td>
                      <td className="px-6 py-4 font-bold text-indigo-600 w-[15%] flex items-center">{inv.totalAmount.toLocaleString()} درهم</td>
                      <td className="px-6 py-4 w-[10%] flex items-center">
                        <select
                          value={inv.status}
                          onChange={(e) => onUpdateStatus(inv.id, e.target.value as Invoice['status'])}
                          className={cn(
                            "px-3 py-1 rounded-full text-xs font-bold outline-none cursor-pointer appearance-none text-center border-none",
                            inv.status === 'paid' ? "bg-emerald-100 text-emerald-700" : 
                            inv.status === 'pending' ? "bg-amber-100 text-amber-700" : 
                            "bg-rose-100 text-rose-700"
                          )}
                        >
                          <option value="paid" className="bg-white text-slate-900">مدفوعة</option>
                          <option value="pending" className="bg-white text-slate-900">معلقة</option>
                          <option value="cancelled" className="bg-white text-slate-900">ملغاة</option>
                        </select>
                      </td>
                      <td className="px-6 py-4 w-[15%] flex items-center">
                        <div className="flex items-center gap-3">
                          <button 
                            onClick={() => handleShareWhatsApp(inv)}
                            className="text-slate-400 hover:text-emerald-600 transition-colors"
                            title="مشاركة عبر واتساب"
                          >
                            <MessageCircle size={18} />
                          </button>
                          <button 
                            onClick={() => handlePrint(inv)}
                            className="text-slate-400 hover:text-indigo-600 transition-colors"
                            title="طباعة الفاتورة"
                          >
                            <Printer size={18} />
                          </button>
                          <button className="text-slate-400 hover:text-indigo-600 transition-colors"><Download size={18} /></button>
                          <button 
                            onClick={() => setDeleteId(inv.id)}
                            className="text-slate-400 hover:text-rose-600 transition-colors"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Confirmation Dialog */}
      <AnimatePresence>
        {deleteId && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl p-8 w-full max-w-sm shadow-2xl text-center"
            >
              <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <AlertTriangle size={32} />
              </div>
              <h3 className="text-xl font-bold mb-2">تأكيد الحذف</h3>
              <p className="text-slate-500 mb-8">هل أنت متأكد من رغبتك في حذف هذه الفاتورة نهائياً؟ لا يمكن التراجع عن هذا الإجراء.</p>
              <div className="flex gap-4">
                <button 
                  onClick={confirmDelete}
                  className="flex-1 bg-rose-600 text-white py-3 rounded-xl font-bold hover:bg-rose-700 transition-colors"
                >
                  حذف الفاتورة
                </button>
                <button 
                  onClick={() => setDeleteId(null)}
                  className="flex-1 bg-slate-100 text-slate-600 py-3 rounded-xl font-bold hover:bg-slate-200 transition-colors"
                >
                  إلغاء
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// --- Settings Component ---
function Settings({ settings, onSave }: { settings: InvoiceSettings, onSave: (s: InvoiceSettings) => void }) {
  const [localSettings, setLocalSettings] = useState<InvoiceSettings>(settings);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setLocalSettings({ ...localSettings, logo: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = () => {
    onSave(localSettings);
    alert('تم حفظ الإعدادات بنجاح');
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">إعدادات الفاتورة</h2>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 max-w-2xl">
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">اسم الشركة / المتجر</label>
            <input 
              type="text" 
              value={localSettings.companyName} 
              onChange={e => setLocalSettings({...localSettings, companyName: e.target.value})} 
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
              placeholder="أدخل اسم شركتك"
            />
          </div>
          
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">الرقم الضريبي (اختياري)</label>
            <input 
              type="text" 
              value={localSettings.taxNumber} 
              onChange={e => setLocalSettings({...localSettings, taxNumber: e.target.value})} 
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
              placeholder="أدخل الرقم الضريبي"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">اللون الأساسي للفاتورة</label>
            <div className="flex items-center gap-4">
              <input 
                type="color" 
                value={localSettings.primaryColor} 
                onChange={e => setLocalSettings({...localSettings, primaryColor: e.target.value})} 
                className="h-12 w-24 cursor-pointer rounded-lg border border-slate-200"
              />
              <span className="text-sm font-mono text-slate-500 bg-slate-100 px-3 py-1 rounded-lg">
                {localSettings.primaryColor}
              </span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">شعار الشركة (Logo)</label>
            <div className="flex items-center gap-4">
              <label className="cursor-pointer bg-slate-50 border border-slate-200 border-dashed rounded-xl px-4 py-8 flex flex-col items-center justify-center gap-2 hover:bg-slate-100 transition-colors flex-1">
                <Upload size={24} className="text-slate-400" />
                <span className="text-sm text-slate-500 font-bold">اضغط لرفع صورة الشعار</span>
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={handleLogoUpload} 
                  className="hidden" 
                />
              </label>
              {localSettings.logo && (
                <div className="relative w-32 h-32 border border-slate-200 rounded-xl p-2 flex items-center justify-center bg-white">
                  <img src={localSettings.logo} alt="Logo preview" className="max-w-full max-h-full object-contain" />
                  <button 
                    onClick={() => setLocalSettings({...localSettings, logo: ''})} 
                    className="absolute -top-2 -right-2 bg-rose-500 text-white rounded-full p-1 hover:bg-rose-600 transition-colors shadow-sm"
                    title="إزالة الشعار"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100">
            <button 
              onClick={handleSave} 
              className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-100"
            >
              حفظ الإعدادات
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
