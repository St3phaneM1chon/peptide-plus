export function FormError({ error, id }: { error?: string; id?: string }) {
  if (!error) return null;
  return <p id={id} className="text-sm text-red-600 mt-1" role="alert">{error}</p>;
}
