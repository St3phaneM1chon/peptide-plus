export function JsonLd({ data }: { data: Record<string, unknown> }) {
  // SECURITY: Escape '<' to prevent script tag injection (XSS) in JSON-LD.
  // A malicious value containing "</script><script>alert(1)</script>" would
  // break out of the JSON-LD script block. Replacing '<' with the Unicode
  // escape '\u003c' is safe in JSON and prevents the browser from seeing
  // a closing </script> tag inside the payload.
  const safeJson = JSON.stringify(data).replace(/</g, '\\u003c');
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: safeJson }}
    />
  );
}
