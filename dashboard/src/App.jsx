import { useState, useEffect } from 'react'
import Sidebar from './components/Sidebar'
import Topbar from './components/Topbar'
import Dashboard from './pages/Dashboard'
import UploadVideo from './pages/UploadVideo'
import CompareSection from './pages/CompareSection'
import ResultsSection from './pages/ResultsSection'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export default function App() {
  const [page, setPage] = useState('Dashboard')
  const [uploads, setUploads] = useState([])
  const [loading, setLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const fetchResults = async () => {
    try {
      const resp = await fetch(`${API}/results`)
      if (!resp.ok) throw new Error('Failed to fetch results')
      const data = await resp.json()
      
      // Map backend schema to frontend expectation
      const mapped = data.map(r => ({
        id: r.id,
        sampleName: r.sample_name,
        date: r.timestamp.split(' ')[0],
        voltage: r.voltage,
        peakNm: r.peak_nm,
        avgNm: r.avg_nm,
        minNm: r.min_nm,
        maxNm: r.max_nm,
        accuracy: r.ensemble_r2 ? Math.round(r.ensemble_r2 * 1000) / 10 : null,
        spectrumX: r.spectrum_x,
        spectrum_y: r.spectrum_y,
        modelType: r.ensemble_type,
        objectsDetected: r.frames || 0
      }))
      setUploads(mapped)
    } catch (e) {
      console.error('Error fetching results:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchResults()
  }, [])

  const addUpload = (record) => {
    // Record is already in DB, just refresh local state to be in sync
    fetchResults()
  }

  const pages = ['Dashboard', 'Upload Video', 'Compare Section', 'Results Section']

  const renderPage = () => {
    if (loading) return <div className="loading-state">Syncing with backend...</div>

    switch (page) {
      case 'Dashboard':       return <Dashboard uploads={uploads} />
      case 'Upload Video':    return <UploadVideo uploads={uploads} addUpload={addUpload} />
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
      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)}></div>}
      <Sidebar 
        currentPage={page} 
        setPage={setPage} 
        isOpen={sidebarOpen} 
        setIsOpen={setSidebarOpen} 
      />
      <div className="main-area">
        <Topbar onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
        <div className="content">
          {renderPage()}
        </div>
      </div>
      <button className="next-arrow" onClick={goNext} title="Next page">›</button>
    </div>
  )
}
