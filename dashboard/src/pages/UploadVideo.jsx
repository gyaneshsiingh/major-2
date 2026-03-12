import { useState, useRef } from 'react'
import PageHeader from '../components/PageHeader'
import UploadsTable from '../components/UploadsTable'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ScatterChart, Scatter
} from 'recharts'

const API = 'http://localhost:8000'

const STEPS = ['Idle', 'Uploading', 'Analyzing', 'Completed']

export default function UploadVideo({ uploads, addUpload }) {
  const [file, setFile] = useState(null)
  const [sampleName, setSampleName] = useState('')
  const [voltage, setVoltage] = useState(0)
  const [dragOver, setDragOver] = useState(false)
  const [status, setStatus] = useState('Idle')   // processing step
  const [result, setResult] = useState(null)     // API response
  const [error, setError] = useState(null)
  const inputRef = useRef()

  const handleFile = (f) => {
    if (f) { setFile(f); setStatus('Idle'); setResult(null); setError(null) }
  }

  const runAnalysis = async () => {
    if (!file || !sampleName.trim()) {
      setError('Please enter a sample name before analyzing.'); return
    }
    setError(null); setResult(null)

    try {
      setStatus('Uploading')
      const form = new FormData()
      form.append('video', file)
      form.append('sample_name', sampleName.trim())
      form.append('voltage', String(voltage))

      setStatus('Analyzing')
      const resp = await fetch(`${API}/analyze`, { method: 'POST', body: form })
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}))
        throw new Error(err.detail || `Server error ${resp.status}`)
      }

      const data = await resp.json()
      setStatus('Completed')
      setResult(data)

      // add to uploads table
      addUpload({
        name: file.name,
        sampleName: sampleName.trim(),
        date: new Date().toISOString().slice(0, 10),
        processingTime: null,
        accuracy: data.model?.r2 != null ? Math.round(data.model.r2 * 1000) / 10 : null,
        objectsDetected: data.stats?.frames ?? null,
        videoLength: null,
        peakNm: data.stats?.peak_nm ?? null,
        avgNm: data.stats?.avg_nm ?? null,
      })
    } catch (e) {
      setStatus('Idle')
      setError(e.message)
    }
  }

  const stepIdx = STEPS.indexOf(status)

  // build recharts data from spectrum arrays
  const spectrumData = result
    ? result.spectrum.x.map((x, i) => ({ nm: parseFloat(x.toFixed(1)), intensity: parseFloat(result.spectrum.y[i].toFixed(4)) }))
    : []

  return (
    <>
      <PageHeader title="Upload Video" />
      <div className="two-col">

        {/* ── Left column ── */}
        <div>
          <div className="card">
            <div className="card-title">Step 1: Upload Video for Analysis</div>

            {/* Sample name + voltage */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
              <div style={{ flex: 2 }}>
                <label style={{ fontSize: 12, color: '#8a9bb5', display: 'block', marginBottom: 4 }}>Sample Name *</label>
                <input
                  className="styled-input"
                  placeholder="e.g. QD_Sample_A"
                  value={sampleName}
                  onChange={e => setSampleName(e.target.value)}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 12, color: '#8a9bb5', display: 'block', marginBottom: 4 }}>Voltage (V)</label>
                <input
                  className="styled-input"
                  type="number"
                  min="0" max="10" step="0.1"
                  value={voltage}
                  onChange={e => setVoltage(Number(e.target.value))}
                />
              </div>
            </div>

            {/* Drop zone */}
            {!file ? (
              <div
                className={`upload-zone ${dragOver ? 'drag-over' : ''}`}
                onClick={() => inputRef.current.click()}
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]) }}
              >
                <div className="upload-zone-icon">☁️</div>
                <div className="upload-zone-title">Drag and drop your video file here</div>
                <span style={{ background: '#007bff', color: '#fff', padding: '7px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600 }}>
                  Browse Files
                </span>
                <div className="upload-zone-sub">Accepted formats: MP4, AVI, MOV, max 5 GB</div>
              </div>
            ) : (
              <div className="alert alert-info" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 22 }}>🎬</span>
                <div style={{ flex: 1 }}>
                  <strong>{file.name}</strong>
                  <div style={{ fontSize: 12, color: '#0c5460' }}>{(file.size / (1024 * 1024)).toFixed(1)} MB</div>
                </div>
                <button className="action-btn" title="Remove" onClick={() => { setFile(null); setStatus('Idle'); setResult(null) }}>✕</button>
              </div>
            )}

            <input ref={inputRef} type="file" accept=".mp4,.avi,.mov" style={{ display: 'none' }}
              onChange={e => handleFile(e.target.files[0])} />

            {error && <div className="alert" style={{ background: '#f8d7da', color: '#721c24', border: '1px solid #f5c6cb', borderRadius: 8, padding: '10px 14px', marginTop: 10 }}>⚠️ {error}</div>}

            <button
              className="btn-primary"
              style={{ width: '100%', marginTop: 14 }}
              onClick={runAnalysis}
              disabled={!file || status === 'Uploading' || status === 'Analyzing'}
            >
              {status === 'Uploading' ? '⬆️ Uploading…'
                : status === 'Analyzing' ? '⚙️ Analyzing with ML model…'
                  : '🚀 Start Analysis'}
            </button>

            {/* Progress steps */}
            <div style={{ marginTop: 24 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#1a2035', marginBottom: 4 }}>Processing status</div>
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

          {/* ── Results card (shown after analysis) ── */}
          {result && (
            <div className="card">
              <div className="card-title">Emission Spectrum — {sampleName}</div>

              {/* Stats row */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
                {[
                  ['Avg λ', `${result.stats.avg_nm} nm`],
                  ['Peak λ', `${result.stats.peak_nm} nm`],
                  ['Range', `${result.stats.min_nm}–${result.stats.max_nm} nm`],
                  ['Model R²', result.model.r2.toFixed(4)],
                ].map(([label, val]) => (
                  <div key={label} style={{ background: '#f8f9fb', borderRadius: 10, padding: '12px 14px' }}>
                    <div style={{ fontSize: 11, color: '#8a9bb5', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.4px' }}>{label}</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: '#1a2035' }}>{val}</div>
                  </div>
                ))}
              </div>

              {/* Emission spectrum chart */}
              <div style={{ fontSize: 13, fontWeight: 600, color: '#8a9bb5', marginBottom: 8 }}>
                PL Emission Spectrum (Model)
              </div>
              <ResponsiveContainer width="100%" height={270}>
                <LineChart data={spectrumData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f5" vertical={false} />
                  <XAxis
                    dataKey="nm"
                    type="number"
                    domain={[300, 700]}
                    tickCount={9}
                    tick={{ fontSize: 11, fill: '#8a9bb5' }}
                    label={{ value: 'Wavelength (nm)', position: 'insideBottom', offset: -2, fontSize: 12, fill: '#8a9bb5' }}
                  />
                  <YAxis
                    domain={[0, 1.05]}
                    tick={{ fontSize: 11, fill: '#8a9bb5' }}
                    label={{ value: 'PL Intensity (a.u.)', angle: -90, position: 'insideLeft', offset: 15, fontSize: 12, fill: '#8a9bb5' }}
                  />
                  <Tooltip
                    formatter={(v) => [v.toFixed(4), 'Intensity']}
                    labelFormatter={(l) => `λ = ${l} nm`}
                    contentStyle={{ borderRadius: 8, fontSize: 12 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line
                    type="monotone"
                    dataKey="intensity"
                    name="PL (model)"
                    stroke="#e63946"
                    strokeWidth={2.5}
                    dot={false}
                    isAnimationActive={true}
                  />
                </LineChart>
              </ResponsiveContainer>

              {/* Model info */}
              <div style={{ marginTop: 14, fontSize: 12, color: '#8a9bb5' }}>
                Ensemble: <strong style={{ color: '#1a2035' }}>{result.model.type}</strong>
                &nbsp;·&nbsp; R² = <strong style={{ color: '#007bff' }}>{result.model.r2}</strong>
                &nbsp;·&nbsp; Frames processed: <strong style={{ color: '#1a2035' }}>{result.stats.frames}</strong>
              </div>
            </div>
          )}

          {/* Results section teaser */}
          <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#1a2035' }}>Results Section</span>
            <span className="badge">View →</span>
          </div>
        </div>

        {/* ── Right column ── */}
        <div className="card">
          <div className="card-title">My Uploads</div>
          <UploadsTable uploads={uploads} />
        </div>
      </div>
    </>
  )
}
