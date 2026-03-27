import { redirect } from 'next/navigation';

export default function EmailComposeRedirect() {
  redirect('/admin/emails?tab=inbox');
}
