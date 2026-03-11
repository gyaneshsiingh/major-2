import { useState, useRef } from 'react'
import PageHeader from '../components/PageHeader'
import { UploadsTable } from '../components/UploadsTable'

const STEPS = ['Idle', 'Uploading', 'Analyzing', 'Completed']

export default function UploadVideo({ uploads, addUpload, nextId }) {
  const [file, setFile] = useState(null)
  const [dragOver, setDragOver] = useState(false)
  const [status, setStatus] = useState('Idle')
  const [done, setDone] = useState(false)
  const inputRef = useRef()

  const handleFile = (f) => {
    if (f) { setFile(f); setStatus('Idle'); setDone(false) }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }

  const runAnalysis = async () => {
    setDone(false)
    const steps = ['Uploading', 'Analyzing', 'Completed']
    for (const s of steps) {
      setStatus(s)
      await new Promise(r => setTimeout(r, 700))
    }
    addUpload({
      name: file.name,
      date: new Date().toISOString().slice(0, 10),
      processingTime: null,
      accuracy: null,
      objectsDetected: null,
      videoLength: null,
    })
    setDone(true)
  }

  const stepIdx = STEPS.indexOf(status)

  return (
    <>
      <PageHeader title="Upload Video" />
      <div className="two-col">
        {/* Left column */}
        <div>
          <div className="card">
            <div className="card-title">Step 1: Upload Video for Analysis</div>

            {!file ? (
              <div
                className={`upload-zone ${dragOver ? 'drag-over' : ''}`}
                onClick={() => inputRef.current.click()}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
              >
                <div className="upload-zone-icon">☁️</div>
                <div className="upload-zone-title">Drag and drop your video file here</div>
                <div>
                  <span style={{
                    background: '#007bff', color: '#fff', padding: '7px 18px',
                    borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer'
                  }}>
                    Browse Files
                  </span>
                  &nbsp;&nbsp;
                  <span style={{ fontSize: 13, color: '#8a9bb5' }}>(or Select from Folder)</span>
                </div>
                <div className="upload-zone-sub">Accepted formats: MP4, AVI, MOV, max 5GB</div>
              </div>
            ) : (
              <div>
                {done && (
                  <div className="alert alert-success">
                    ✅ <strong>{file.name}</strong> added to My Uploads. Connect your ML pipeline to populate metrics.
                  </div>
                )}
                {!done && (
                  <div className="alert alert-info">
                    📁 <strong>{file.name}</strong> — {(file.size / (1024 * 1024)).toFixed(1)} MB ready
                  </div>
                )}
                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    className="btn-primary"
                    onClick={runAnalysis}
                    disabled={status === 'Uploading' || status === 'Analyzing'}
                  >
                    {status === 'Idle' || status === 'Completed' ? '🚀 Start Analysis' : '⏳ Processing…'}
                  </button>
                  <button
                    className="btn-secondary"
                    onClick={() => { setFile(null); setStatus('Idle'); setDone(false) }}
                  >
                    ✕ Clear
                  </button>
                </div>
              </div>
            )}

            <input
              ref={inputRef}
              type="file"
              accept=".mp4,.avi,.mov"
              style={{ display: 'none' }}
              onChange={(e) => handleFile(e.target.files[0])}
            />

            {/* Processing status */}
            <div style={{ marginTop: 24 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#1a2035', marginBottom: 4 }}>
                Processing status
              </div>
              <div className="progress-steps">
                {STEPS.map((s, i) => (
                  <div key={s} className="progress-step">
                    <div className={`step-dot ${i < stepIdx ? 'done' : i === stepIdx ? 'active' : ''}`} />
                    <div className={`step-label ${i === stepIdx ? 'active' : ''}`}>{s}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Results teaser */}
          <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 15, fontWeight: 600, color: '#1a2035' }}>Results Section</span>
            <span className="badge">View →</span>
          </div>
        </div>

        {/* Right column — My Uploads */}
        <div className="card">
          <div className="card-title">My Uploads</div>
          <UploadsTable uploads={uploads} />
        </div>
      </div>
    </>
  )
}
