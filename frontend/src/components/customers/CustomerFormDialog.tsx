/**
 * REVORA – CustomerFormDialog
 * A slide-over sheet for creating and editing customers.
 * Sections: Personal Information, Company, Billing Address.
 * Uses react-hook-form + zod. Connects directly to the backend API.
 */

import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import * as Dialog from '@radix-ui/react-dialog';
import { X, User, Building2, MapPin, Loader2 } from 'lucide-react';
import { cn } from '@/utils/cn';
import { Button } from '@/components/common/Button';
import { useToast } from '@/components/common/Toast';
import { createCustomer, updateCustomer } from '@/services/customerApi';
import { getApiErrorMessage } from '@/services/apiClient';
import type { Customer, CustomerCreateRequest } from '@/types/customer';

// ── Validation ────────────────────────────────────────────────────────────────

const customerSchema = z.object({
  full_name:       z.string().min(2, 'Full name must be at least 2 characters').max(200),
  email:           z.string().min(1, 'Email is required').email('Enter a valid email address'),
  phone:           z.string().max(30).optional().or(z.literal('')),
  company_name:    z.string().max(200).optional().or(z.literal('')),
  billing_address: z.string().max(500).optional().or(z.literal('')),
  city:            z.string().max(100).optional().or(z.literal('')),
  state:           z.string().max(100).optional().or(z.literal('')),
  country:         z.string().max(100).optional().or(z.literal('')),
  postal_code:     z.string().max(20).optional().or(z.literal('')),
});

type CustomerFormValues = z.infer<typeof customerSchema>;

// ── Props ─────────────────────────────────────────────────────────────────────

interface CustomerFormDialogProps {
  open:        boolean;
  onOpenChange: (open: boolean) => void;
  customer?:   Customer | null;   // null/undefined = create mode
  onSuccess:   () => void;
}

// ── Section header ────────────────────────────────────────────────────────────

function SectionHeader({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div className="w-7 h-7 bg-indigo-50 rounded-lg flex items-center justify-center">
        <Icon className="w-3.5 h-3.5 text-indigo-600" />
      </div>
      <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
      <div className="flex-1 h-px bg-slate-100" />
    </div>
  );
}

// ── Field ─────────────────────────────────────────────────────────────────────

function Field({
  label, required, error, children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="form-label">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="form-error">{error}</p>}
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export function CustomerFormDialog({
  open, onOpenChange, customer, onSuccess,
}: CustomerFormDialogProps) {
  const { success, error: toastError } = useToast();
  const isEdit = Boolean(customer);

  const {
    register, handleSubmit, reset,
    formState: { errors, isSubmitting },
  } = useForm<CustomerFormValues>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      full_name: '', email: '', phone: '', company_name: '',
      billing_address: '', city: '', state: '', country: '', postal_code: '',
    },
  });

  // Populate form when editing
  useEffect(() => {
    if (customer) {
      reset({
        full_name:       customer.full_name,
        email:           customer.email,
        phone:           customer.phone         ?? '',
        company_name:    customer.company_name  ?? '',
        billing_address: customer.billing_address ?? '',
        city:            customer.city          ?? '',
        state:           customer.state         ?? '',
        country:         customer.country       ?? '',
        postal_code:     customer.postal_code   ?? '',
      });
    } else {
      reset({
        full_name: '', email: '', phone: '', company_name: '',
        billing_address: '', city: '', state: '', country: '', postal_code: '',
      });
    }
  }, [customer, reset]);

  const onSubmit = async (values: CustomerFormValues) => {
    // Strip empty strings to undefined
    const clean: CustomerCreateRequest = {
      full_name:       values.full_name,
      email:           values.email,
      phone:           values.phone           || undefined,
      company_name:    values.company_name    || undefined,
      billing_address: values.billing_address || undefined,
      city:            values.city            || undefined,
      state:           values.state           || undefined,
      country:         values.country         || undefined,
      postal_code:     values.postal_code     || undefined,
    };

    try {
      if (isEdit && customer) {
        await updateCustomer(customer.id, clean);
        success('Customer updated', `${clean.full_name}'s profile has been updated.`);
      } else {
        await createCustomer(clean);
        success('Customer created', `${clean.full_name} has been added successfully.`);
      }
      onOpenChange(false);
      onSuccess();
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 409) {
        toastError('Duplicate email', 'A customer with this email already exists.');
      } else {
        toastError('Failed to save customer', getApiErrorMessage(err));
      }
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    reset();
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm data-[state=open]:animate-fade-in" />

        <Dialog.Content
          className={cn(
            'fixed right-0 top-0 z-50 h-full w-full max-w-lg bg-white shadow-2xl',
            'flex flex-col data-[state=open]:animate-slide-in-right',
            'focus:outline-none overflow-hidden',
          )}
          style={{ animationName: 'slideInRight' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200 flex-shrink-0">
            <div>
              <Dialog.Title className="text-base font-semibold text-slate-900">
                {isEdit ? 'Edit Customer' : 'Add Customer'}
              </Dialog.Title>
              <Dialog.Description className="text-xs text-slate-500 mt-0.5">
                {isEdit
                  ? 'Update the customer profile information.'
                  : 'Fill in the details to create a new customer record.'}
              </Dialog.Description>
            </div>
            <Dialog.Close
              onClick={handleClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <X className="w-4 h-4" />
            </Dialog.Close>
          </div>

          {/* Form — scrollable */}
          <form onSubmit={handleSubmit(onSubmit)} className="flex-1 overflow-y-auto scrollbar-thin px-6 py-5 space-y-6" noValidate>

            {/* Section A: Personal */}
            <section>
              <SectionHeader icon={User} title="Personal Information" />
              <div className="space-y-4">
                <Field label="Full Name" required error={errors.full_name?.message}>
                  <input
                    type="text" autoComplete="name"
                    placeholder="Jane Smith"
                    className={cn('form-input', errors.full_name && 'border-red-400')}
                    {...register('full_name')}
                  />
                </Field>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Email Address" required error={errors.email?.message}>
                    <input
                      type="email" autoComplete="email"
                      placeholder="jane@example.com"
                      className={cn('form-input', errors.email && 'border-red-400')}
                      {...register('email')}
                    />
                  </Field>
                  <Field label="Phone" error={errors.phone?.message}>
                    <input
                      type="tel" autoComplete="tel"
                      placeholder="+1 555 000 0000"
                      className="form-input"
                      {...register('phone')}
                    />
                  </Field>
                </div>
              </div>
            </section>

            {/* Section B: Company */}
            <section>
              <SectionHeader icon={Building2} title="Company Information" />
              <Field label="Company Name" error={errors.company_name?.message}>
                <input
                  type="text"
                  placeholder="Acme Inc (optional)"
                  className="form-input"
                  {...register('company_name')}
                />
              </Field>
            </section>

            {/* Section C: Billing Address */}
            <section>
              <SectionHeader icon={MapPin} title="Billing Address" />
              <div className="space-y-4">
                <Field label="Street Address" error={errors.billing_address?.message}>
                  <input
                    type="text"
                    placeholder="123 Main Street"
                    className="form-input"
                    {...register('billing_address')}
                  />
                </Field>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="City" error={errors.city?.message}>
                    <input type="text" placeholder="Austin" className="form-input" {...register('city')} />
                  </Field>
                  <Field label="State / Region" error={errors.state?.message}>
                    <input type="text" placeholder="TX" className="form-input" {...register('state')} />
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Country" error={errors.country?.message}>
                    <input type="text" placeholder="US" className="form-input" {...register('country')} />
                  </Field>
                  <Field label="Postal Code" error={errors.postal_code?.message}>
                    <input type="text" placeholder="78701" className="form-input" {...register('postal_code')} />
                  </Field>
                </div>
              </div>
            </section>
          </form>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 flex-shrink-0 bg-slate-50">
            <Button variant="secondary" size="sm" type="button" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              variant="primary" size="sm"
              loading={isSubmitting}
              onClick={handleSubmit(onSubmit)}
            >
              {isEdit ? 'Save Changes' : 'Create Customer'}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
