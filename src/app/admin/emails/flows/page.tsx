import { redirect } from 'next/navigation';

export default function EmailFlowsRedirect() {
  redirect('/admin/emails?tab=flows');
}
