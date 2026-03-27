import { redirect } from 'next/navigation';

export default function EmailSegmentsRedirect() {
  redirect('/admin/emails?tab=segments');
}
