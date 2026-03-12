import { useState } from 'react'
import PageHeader from '../components/PageHeader'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

export default function ResultsSection({ uploads }) {
  const [search, setSearch] = useState('')
  const [sortField, setSortField] = useState('date')
  const [selectedRun, setSelectedRun] = useState(null)

  const filteredData = uploads
    .filter(u => u.sampleName.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sortField === 'date') return new Date(b.date) - new Date(a.date)
      if (sortField === 'peak') return b.peakNm - a.peakNm
      return 0
    })

  const trendData = [...uploads].reverse().map(r => ({
    time: r.date,
    peak: r.peakNm,
    avg: r.avgNm
  }))

  const spectrumData = selectedRun && selectedRun.spectrumX
    ? selectedRun.spectrumX.map((x, i) => ({
      nm: parseFloat(x.toFixed(1)),
      intensity: parseFloat(selectedRun.spectrum_y[i].toFixed(4))
    }))
    : []

  const downloadCSV = () => {
    if (uploads.length === 0) return
    const headers = ['ID', 'Sample Name', 'Date', 'Voltage (V)', 'Peak (nm)', 'Avg (nm)', 'Min (nm)', 'Max (nm)', 'Model', 'R2 (%)']
    const rows = uploads.map(u => [
      u.id, u.sampleName, u.date, u.voltage, u.peakNm, u.avgNm, u.minNm, u.maxNm, u.modelType, u.accuracy
    ])
    const csvContent = "data:text/csv;charset=utf-8,"
      + [headers.join(','), ...rows.map(e => e.join(','))].join('\n')

    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    link.setAttribute("download", `PL_Ensemble_Results_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
  }

  return (
    <>
      <PageHeader title="Results Section" />

      {/* Historical Trend Chart */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div className="card-title" style={{ marginBottom: 0 }}>System-wide Trends</div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn-secondary" onClick={downloadCSV}>Export CSV</button>
            <button className="btn-secondary" disabled>PDF</button>
          </div>
        </div>

        <div style={{ height: 280, width: '100%' }}>
          {trendData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f2f5" />
                <XAxis dataKey="time" stroke="#8a9bb5" fontSize={11} />
                <YAxis stroke="#8a9bb5" fontSize={11} domain={['auto', 'auto']} />
                <Tooltip />
                <Line type="monotone" dataKey="peak" name="Peak" stroke="#007bff" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="avg" name="Avg" stroke="#28a745" strokeWidth={2} dot={false} strokeDasharray="4 4" />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="empty-state">No results found to visualize</div>
          )}
        </div>
      </div>

      {/* Selected Run Spectrum Explorer */}
      {selectedRun && (
        <div className="card" style={{ borderLeft: '4px solid #007bff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
            <div className="card-title" style={{ marginBottom: 0 }}>
              PL Emission Spectrum: <span style={{ color: '#007bff' }}>{selectedRun.sampleName}</span>
            </div>
            <button className="action-btn" onClick={() => setSelectedRun(null)}>✕ Close Chart</button>
          </div>
          <div style={{ height: 300, width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={spectrumData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f2f5" />
                <XAxis dataKey="nm" type="number" domain={[300, 700]} stroke="#8a9bb5" fontSize={11} />
                <YAxis stroke="#8a9bb5" fontSize={11} />
                <Tooltip />
                <Line type="monotone" dataKey="intensity" name="Intensity" stroke="#e63946" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-title">All Analytical Records</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20, gap: 20, flexWrap: 'wrap' }}>
          <input
            className="styled-input"
            placeholder="🔍 Search samples..."
            style={{ flex: '1 1 300px' }}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 13, color: '#8a9bb5' }}>Sort by:</span>
            <select className="styled-input" style={{ width: 140 }} onChange={e => setSortField(e.target.value)}>
              <option value="date">Latest Date</option>
              <option value="peak">Peak λ</option>
            </select>
          </div>
        </div>

        <div className="data-table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Sample Name</th>
                <th>Date</th>
                <th>Voltage</th>
                <th>Peak (nm)</th>
                <th>Avg (nm)</th>
                <th>Model Acc.</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.map(u => (
                <tr key={u.id} className={selectedRun?.id === u.id ? 'active-row' : ''}>
                  <td style={{ fontWeight: 600 }}>{u.sampleName}</td>
                  <td>{u.date}</td>
                  <td>{u.voltage}V</td>
                  <td style={{ color: '#007bff', fontWeight: 700 }}>{u.peakNm}</td>
                  <td>{u.avgNm}</td>
                  <td>
                    <span style={{ color: u.accuracy > 90 ? '#28a745' : '#ffc107', fontWeight: 600 }}>
                      {u.accuracy}%
                    </span>
                  </td>
                  <td>
                    <button
                      className="badge"
                      style={{ cursor: 'pointer', border: 'none', background: '#007bff22', color: '#007bff' }}
                      onClick={() => setSelectedRun(u)}
                    >
                      👁 View Graph
                    </button>
                  </td>
                </tr>
              ))}
              {filteredData.length === 0 && (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '40px 0', color: '#8a9bb5' }}>
                    No records found matching "{search}"
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
