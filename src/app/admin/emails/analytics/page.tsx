import { redirect } from 'next/navigation';

export default function EmailAnalyticsRedirect() {
  redirect('/admin/emails?tab=analytics');
}
