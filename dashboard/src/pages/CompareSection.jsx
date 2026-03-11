import { useState } from 'react'
import PageHeader from '../components/PageHeader'
import { UploadsTable } from '../components/UploadsTable'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer
} from 'recharts'

export default function CompareSection({ uploads }) {
  const hasData = uploads.length > 0
  const [id1, setId1] = useState(0)
  const [id2, setId2] = useState(Math.min(1, uploads.length - 1))
  const [csvFile, setCsvFile] = useState(null)
  const [dragOver, setDragOver] = useState(false)
  const [result, setResult] = useState(null)

  const ids = uploads.map((u, i) => ({ label: `ID ${u.id}`, idx: i }))

  const runCompare = () => {
    const r1 = uploads[id1]
    const r2 = uploads[id2]
    setResult({ r1, r2 })
  }

  const chartData = result ? [
    {
      metric: 'Accuracy %',
      [result.r1.name + ' ' + result.r1.id]: result.r1.accuracy,
      [result.r2.name + ' ' + result.r2.id]: result.r2.accuracy,
    },
    {
      metric: 'Objects',
      [result.r1.name + ' ' + result.r1.id]: result.r1.objectsDetected,
      [result.r2.name + ' ' + result.r2.id]: result.r2.objectsDetected,
    },
  ] : []

  return (
    <>
      <PageHeader title="Compare Section" />
      <div className="two-col">
        <div>
          <div className="card">
            <div className="card-title">Compare Previous Runs</div>

            {!hasData ? (
              <div className="empty-state">
                <div className="empty-icon">⇄</div>
                <div className="empty-msg">Upload and analyse at least two videos to compare runs.</div>
              </div>
            ) : (
              <div className="compare-drops">
                <select
                  className="styled-select"
                  value={id1}
                  onChange={e => setId1(Number(e.target.value))}
                >
                  {ids.map(({ label, idx }) => (
                    <option key={idx} value={idx}>{label}</option>
                  ))}
                </select>
                <select
                  className="styled-select"
                  value={id2}
                  onChange={e => setId2(Number(e.target.value))}
                >
                  {ids.map(({ label, idx }) => (
                    <option key={idx} value={idx}>{label}</option>
                  ))}
                </select>
              </div>
            )}

            {/* CSV Upload */}
            <div
              className={`upload-zone ${dragOver ? 'drag-over' : ''}`}
              style={{ padding: '36px 20px' }}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault(); setDragOver(false)
                const f = e.dataTransfer.files[0]
                if (f?.name.endsWith('.csv')) setCsvFile(f)
              }}
            >
              <div style={{ fontSize: 40 }}>
                📄 <span style={{
                  fontSize: 16, fontWeight: 700, background: '#e8ecf0',
                  borderRadius: 6, padding: '2px 8px'
                }}>CSV</span>
              </div>
              <div className="upload-zone-title" style={{ marginTop: 12 }}>
                {csvFile
                  ? `✅ ${csvFile.name}`
                  : 'Drag and drop your Actual Results CSV file here'}
              </div>
              {!csvFile && (
                <label style={{
                  background: '#007bff', color: '#fff', padding: '7px 18px',
                  borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer'
                }}>
                  Browse CSV
                  <input
                    type="file" accept=".csv" style={{ display: 'none' }}
                    onChange={e => setCsvFile(e.target.files[0])}
                  />
                </label>
              )}
              <div className="upload-zone-sub">Accepted formats: CSV</div>
            </div>

            <button
              className="btn-primary"
              style={{ width: '100%' }}
              onClick={runCompare}
              disabled={!hasData}
            >
              ▶ Run Comparison
            </button>
          </div>

          {/* Comparison result */}
          {result && (
            <div className="card">
              <div className="card-title">Comparison Result</div>
              <table className="styled-table" style={{ marginBottom: 20 }}>
                <thead>
                  <tr>
                    <th>Metric</th>
                    <th>ID {result.r1.id}</th>
                    <th>ID {result.r2.id}</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['Accuracy %', result.r1.accuracy, result.r2.accuracy],
                    ['Objects Detected', result.r1.objectsDetected, result.r2.objectsDetected],
                    ['Processing Time', result.r1.processingTime, result.r2.processingTime],
                    ['Video Length', result.r1.videoLength, result.r2.videoLength],
                  ].map(([metric, v1, v2]) => (
                    <tr key={metric}>
                      <td>{metric}</td>
                      <td>{v1 != null ? v1 : '—'}</td>
                      <td>{v2 != null ? v2 : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {(result.r1.accuracy != null && result.r2.accuracy != null) ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f5" vertical={false} />
                    <XAxis dataKey="metric" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey={`${result.r1.name} ${result.r1.id}`} fill="#007bff" radius={[4, 4, 0, 0]} />
                    <Bar dataKey={`${result.r2.name} ${result.r2.id}`} fill="#2ca58d" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="empty-state" style={{ padding: '16px' }}>
                  <div className="empty-msg">Metric values not yet available — connect your ML pipeline.</div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="card">
          <div className="card-title">My Uploads</div>
          <UploadsTable uploads={uploads} />
        </div>
      </div>
    </>
  )
}
