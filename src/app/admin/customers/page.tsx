'use client';

import { ContactListPage } from '@/components/admin/ContactListPage';
import { customerConfig } from './config';

export default function CustomersPage() {
  return <ContactListPage config={customerConfig} />;
}
