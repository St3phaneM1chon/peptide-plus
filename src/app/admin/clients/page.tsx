'use client';

import { ContactListPage } from '@/components/admin/ContactListPage';
import { clientConfig } from './config';

export default function ClientsPage() {
  return <ContactListPage config={clientConfig} />;
}
