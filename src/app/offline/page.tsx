import en from '../../../messages/en.json'
import es from '../../../messages/es.json'

/** Served by the service worker when a navigation fails offline. */
export default function OfflinePage() {
  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem', textAlign: 'center' }}>
      <h1>{en.app.name}</h1>
      <p>{en.offline.body}</p>
      <p lang="es">{es.offline.body}</p>
    </main>
  )
}
