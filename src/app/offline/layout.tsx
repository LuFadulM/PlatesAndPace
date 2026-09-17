/**
 * Root layout for the offline fallback, which lives outside the [locale]
 * segment because the service worker cannot know the visitor's language
 * without the network. Both languages render from the catalogues below.
 */
export default function OfflineLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
