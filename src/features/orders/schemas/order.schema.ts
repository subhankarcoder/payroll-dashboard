import { z } from 'zod';

const orderItemSchema = z.object({
  productName: z.string().min(2, { message: 'Product name must be at least 2 characters' }),
  quantity: z.number().int().positive({ message: 'Quantity must be greater than zero' }),
  unitPrice: z.number().positive({ message: 'Unit price must be greater than zero' }),
});

export const createOrderSchema = z.object({
  customerName: z.string().min(2, { message: 'Customer name is required' }),
  customerEmail: z.string().email({ message: 'Valid customer email is required' }),
  items: z.array(orderItemSchema).min(1, { message: 'An order must contain at least one item' }),
});

export const updateOrderStatusSchema = z.object({
  orderId: z.string().min(1),
  status: z.enum(['PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED']),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
// fallow-ignore-next-line unused-type
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;
