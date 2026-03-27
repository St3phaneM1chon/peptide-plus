import { redirect } from 'next/navigation';

export default function EmailInboxRedirect() {
  redirect('/admin/emails?folder=inbox');
}
