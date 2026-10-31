import 'server-only';

// fallow-ignore-next-line unused-type
export interface DbOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  items: Array<{
    id: string;
    productName: string;
    quantity: number;
    unitPrice: number;
  }>;
  totalAmount: number;
  status: 'PENDING' | 'CONFIRMED' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';
  createdAt: string;
  updatedAt: string;
}

// Initial seed data for production-grade demonstration
const initialOrders: DbOrder[] = [
  {
    id: 'ord_101',
    orderNumber: 'ORD-2026-001',
    customerName: 'Alice Johnson',
    customerEmail: 'alice@example.com',
    items: [
      { id: 'item_1', productName: 'Cloud Infrastructure License', quantity: 1, unitPrice: 4500 },
      { id: 'item_2', productName: 'Premium Support SLA', quantity: 1, unitPrice: 1200 },
    ],
    totalAmount: 5700,
    status: 'CONFIRMED',
    createdAt: '2026-09-01T10:30:00.000Z',
    updatedAt: '2026-09-01T10:30:00.000Z',
  },
  {
    id: 'ord_102',
    orderNumber: 'ORD-2026-002',
    customerName: 'TechCorp International',
    customerEmail: 'procurement@techcorp.com',
    items: [
      { id: 'item_3', productName: 'Enterprise Platform Seat', quantity: 10, unitPrice: 1500 },
    ],
    totalAmount: 15000,
    status: 'PENDING',
    createdAt: '2026-09-02T14:15:00.000Z',
    updatedAt: '2026-09-02T14:15:00.000Z',
  },
  {
    id: 'ord_103',
    orderNumber: 'ORD-2026-003',
    customerName: 'Marcus Vance',
    customerEmail: 'marcus@example.org',
    items: [{ id: 'item_4', productName: 'Security Audit Service', quantity: 1, unitPrice: 850 }],
    totalAmount: 850,
    status: 'DELIVERED',
    createdAt: '2026-08-28T09:00:00.000Z',
    updatedAt: '2026-08-30T16:20:00.000Z',
  },
];

class Database {
  private orders: DbOrder[] = [...initialOrders];

  public async getOrders(): Promise<DbOrder[]> {
    return [...this.orders];
  }

  public async getOrderById(id: string): Promise<DbOrder | null> {
    const order = this.orders.find((o) => o.id === id);
    return order ? { ...order } : null;
  }

  public async createOrder(
    order: Omit<DbOrder, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<DbOrder> {
    const now = new Date().toISOString();
    const newOrder: DbOrder = {
      ...order,
      id: `ord_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      createdAt: now,
      updatedAt: now,
    };
    this.orders.unshift(newOrder);
    return { ...newOrder };
  }

  public async updateOrderStatus(id: string, status: DbOrder['status']): Promise<DbOrder | null> {
    const index = this.orders.findIndex((o) => o.id === id);
    if (index === -1) return null;

    const existing = this.orders[index];
    if (!existing) return null;

    const updated: DbOrder = {
      ...existing,
      status,
      updatedAt: new Date().toISOString(),
    };
    this.orders[index] = updated;
    return { ...updated };
  }
}

export const db = new Database();
