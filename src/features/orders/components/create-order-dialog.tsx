// fallow-ignore-file unused-file
'use client';

import { useState, type FormEvent } from 'react';
import { createOrderAction } from '../actions/order.action';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export interface CreateOrderDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function CreateOrderDialog({ isOpen, onClose, onSuccess }: CreateOrderDialogProps) {
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [productName, setProductName] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [unitPrice, setUnitPrice] = useState(500);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const result = await createOrderAction({
        customerName,
        customerEmail,
        items: [
          {
            productName,
            quantity: Number(quantity),
            unitPrice: Number(unitPrice),
          },
        ],
      });

      if (!result.success) {
        setError(result.error);
      } else {
        // Reset form
        setCustomerName('');
        setCustomerEmail('');
        setProductName('');
        setQuantity(1);
        setUnitPrice(500);
        onClose();
        if (onSuccess) onSuccess();
      }
    } catch {
      setError('An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create New Enterprise Order">
      <form
        onSubmit={handleSubmit}
        style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}
      >
        {error && (
          <div
            role="alert"
            style={{
              padding: 'var(--space-3)',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'hsl(var(--color-danger-bg))',
              color: 'hsl(var(--color-danger))',
              fontSize: 'var(--font-size-sm)',
            }}
          >
            {error}
          </div>
        )}

        <Input
          label="Customer Name"
          required
          value={customerName}
          onChange={(e) => setCustomerName(e.target.value)}
          placeholder="Acme Technologies Inc."
          disabled={isLoading}
        />

        <Input
          label="Customer Email"
          type="email"
          required
          value={customerEmail}
          onChange={(e) => setCustomerEmail(e.target.value)}
          placeholder="billing@acme.com"
          disabled={isLoading}
        />

        <Input
          label="Product / Service Name"
          required
          value={productName}
          onChange={(e) => setProductName(e.target.value)}
          placeholder="Dedicated Cloud Cluster"
          disabled={isLoading}
        />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
          <Input
            label="Quantity"
            type="number"
            min={1}
            required
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
            disabled={isLoading}
          />
          <Input
            label="Unit Price (USD)"
            type="number"
            min={1}
            required
            value={unitPrice}
            onChange={(e) => setUnitPrice(Number(e.target.value))}
            disabled={isLoading}
          />
        </div>

        <div
          style={{
            marginTop: 'var(--space-4)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 'var(--space-3)',
          }}
        >
          <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" isLoading={isLoading}>
            Create Order
          </Button>
        </div>
      </form>
    </Modal>
  );
}
