export interface User {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'MANAGER' | 'MEMBER';
  avatar?: string;
  createdAt: string;
}

export interface Client {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  status: 'ACTIVE' | 'INACTIVE' | 'LEAD';
  notes?: string;
  createdAt: string;
  updatedAt: string;
  campaigns?: Campaign[];
  invoices?: Invoice[];
  budgets?: Budget[];
  _count?: { campaigns: number; invoices: number };
}

export interface Campaign {
  id: string;
  name: string;
  description?: string;
  clientId: string;
  status: 'PLANNING' | 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'CANCELLED';
  startDate?: string;
  endDate?: string;
  budget?: number;
  goals?: string;
  createdAt: string;
  updatedAt: string;
  client?: { id: string; name: string; company?: string };
  tasks?: Task[];
  _count?: { tasks: number };
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: 'TODO' | 'IN_PROGRESS' | 'DONE';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  assigneeId?: string;
  campaignId?: string;
  dueDate?: string;
  createdAt: string;
  updatedAt: string;
  assignee?: { id: string; name: string; avatar?: string };
  campaign?: { id: string; name: string };
}

export interface Budget {
  id: string;
  title: string;
  clientId: string;
  campaignId?: string;
  items: { description: string; amount: number }[];
  total: number;
  status: 'DRAFT' | 'SENT' | 'APPROVED' | 'REJECTED';
  createdAt: string;
  updatedAt: string;
  client?: { id: string; name: string; company?: string };
  campaign?: { id: string; name: string };
}

export interface Invoice {
  id: string;
  clientId: string;
  budgetId?: string;
  amount: number;
  status: 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELLED';
  dueDate?: string;
  paidAt?: string;
  createdAt: string;
  updatedAt: string;
  client?: { id: string; name: string; company?: string };
  budget?: { id: string; total: number; status: string };
}

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  type: 'MEETING' | 'DEADLINE' | 'DELIVERY' | 'OTHER';
  date: string;
  endDate?: string;
  campaignId?: string;
  userId?: string;
  createdAt: string;
  updatedAt: string;
  campaign?: { id: string; name: string };
  user?: { id: string; name: string; avatar?: string };
}

export interface DashboardSummary {
  kpis: {
    activeClients: number;
    activeCampaigns: number;
    pendingTasks: number;
    monthRevenue: number;
  };
  revenueChart: { month: string; total: number }[];
  recentCampaigns: {
    id: string;
    name: string;
    client: { id: string; name: string };
    status: string;
    progress: number;
    totalTasks: number;
    doneTasks: number;
  }[];
  myTasks: Task[];
  recentClients: Pick<Client, 'id' | 'name' | 'company' | 'status' | 'createdAt'>[];
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  error?: any;
}
