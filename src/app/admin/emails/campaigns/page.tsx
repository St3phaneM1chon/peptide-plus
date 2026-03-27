import { redirect } from 'next/navigation';

export default function EmailCampaignsRedirect() {
  redirect('/admin/emails?tab=campaigns');
}
