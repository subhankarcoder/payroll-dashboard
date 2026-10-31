import { db } from '@/lib/server/db';
import type { Order } from '../types/order.types';
import type { CreateOrderInput } from '../schemas/order.schema';
import { calculateOrderTotal } from '../utils/calculate-order-total';
import { logger } from '@/lib/logger/logger';

export class OrderService {
  public static async listOrders(): Promise<readonly Order[]> {
    logger.info('Fetching orders list', { operation: 'OrderService.listOrders' });
    const records = await db.getOrders();
    return records as readonly Order[];
  }

  // fallow-ignore-next-line unused-class-member
  public static async getOrder(id: string): Promise<Order | null> {
    logger.info('Fetching order by id', { orderId: id, operation: 'OrderService.getOrder' });
    const record = await db.getOrderById(id);
    return (record as Order) || null;
  }

  public static async createOrder(input: CreateOrderInput): Promise<Order> {
    const totalAmount = calculateOrderTotal(input.items);
    const orderNumber = `ORD-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    logger.info('Creating new order', {
      orderNumber,
      totalAmount,
      customerEmail: input.customerEmail,
      operation: 'OrderService.createOrder',
    });

    const itemsWithIds = input.items.map(
      (item: CreateOrderInput['items'][number], index: number) => ({
        ...item,
        id: `item_${Date.now()}_${index}`,
      }),
    );

    const created = await db.createOrder({
      orderNumber,
      customerName: input.customerName,
      customerEmail: input.customerEmail,
      items: itemsWithIds,
      totalAmount,
      status: 'PENDING',
    });

    return created as Order;
  }

  public static async updateStatus(id: string, status: Order['status']): Promise<Order | null> {
    logger.info('Updating order status', {
      orderId: id,
      newStatus: status,
      operation: 'OrderService.updateStatus',
    });

    const updated = await db.updateOrderStatus(id, status);
    return (updated as Order) || null;
  }
}
