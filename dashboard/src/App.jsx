import { useState } from 'react'
import Sidebar from './components/Sidebar'
import Topbar from './components/Topbar'
import Dashboard from './pages/Dashboard'
import UploadVideo from './pages/UploadVideo'
import CompareSection from './pages/CompareSection'
import ResultsSection from './pages/ResultsSection'

const EMPTY_UPLOADS = []

export default function App() {
  const [page, setPage] = useState('Dashboard')
  const [uploads, setUploads] = useState(EMPTY_UPLOADS)
  const [nextId, setNextId] = useState(101)

  const addUpload = (record) => {
    setUploads(prev => [...prev, { ...record, id: nextId }])
    setNextId(n => n + 1)
  }

  const pages = ['Dashboard', 'Upload Video', 'Compare Section', 'Results Section']

  const renderPage = () => {
    switch (page) {
      case 'Dashboard':       return <Dashboard uploads={uploads} />
      case 'Upload Video':    return <UploadVideo uploads={uploads} addUpload={addUpload} nextId={nextId} />
      case 'Compare Section': return <CompareSection uploads={uploads} />
      case 'Results Section': return <ResultsSection uploads={uploads} />
      default:                return <Dashboard uploads={uploads} />
    }
  }

  const goNext = () => {
    const idx = pages.indexOf(page)
    setPage(pages[(idx + 1) % pages.length])
  }

  return (
    <div className="app-shell">
      <Sidebar currentPage={page} setPage={setPage} />
      <div className="main-area">
        <Topbar />
        <div className="content">
          {renderPage()}
        </div>
      </div>
      <button className="next-arrow" onClick={goNext} title="Next page">›</button>
    </div>
  )
}
