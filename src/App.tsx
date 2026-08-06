import { Link, Route, Routes } from 'react-router-dom'
import { CatalogView } from '@/routes/CatalogView'
import { WorkspaceView } from '@/routes/WorkspaceView'
import { TranslatorView } from '@/routes/TranslatorView'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<CatalogView />} />
      <Route path="/edit/:slug" element={<WorkspaceView />} />
      <Route path="/translate" element={<TranslatorView />} />
      <Route path="/translate/:slug" element={<TranslatorView />} />
      <Route path="/translate/:slug/:pageId" element={<TranslatorView />} />
      <Route
        path="*"
        element={
          <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center">
            <p className="text-[var(--color-ink)]">Sayfa bulunamadı</p>
            <Link to="/" className="text-[var(--color-accent)] underline">
              Projeler
            </Link>
          </div>
        }
      />
    </Routes>
  )
}
