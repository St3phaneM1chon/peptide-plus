// FIX: F1 - redirect to canonical media library page (eliminates duplicate Media Manager)
import { redirect } from 'next/navigation';

export default function MediasPage() {
  redirect('/admin/media/library');
}
