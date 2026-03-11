import { useState } from 'react'
import PageHeader from '../components/PageHeader'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer
} from 'recharts'

export default function ResultsSection({ uploads }) {
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState('Date')

  const hasData = uploads.length > 0

  const chartData = uploads
    .filter(u => u.accuracy != null)
    .map(u => ({
      date: u.date,
      'Accuracy %': u.accuracy,
      'Objects Detected': u.objectsDetected,
      'Processing Speed': u.processingSpeed,
    }))

  const filtered = uploads.filter(u =>
    !search || [u.name, u.date, String(u.id)].join(' ').toLowerCase().includes(search.toLowerCase())
  )

  const exportCSV = () => {
    const headers = ['ID', 'Name', 'Date', 'Processing Time', 'Accuracy %', 'Objects Detected', 'Video Length']
    const rows = uploads.map(u => [
      u.id, u.name, u.date,
      u.processingTime ?? '',
      u.accuracy ?? '',
      u.objectsDetected ?? '',
      u.videoLength ?? ''
    ])
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = 'results.csv'
    a.click()
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <div>
          <div className="page-title-row" style={{ marginBottom: 4 }}>
            <h1 className="page-title">Results Section</h1>
            <span className="badge-active">Active</span>
          </div>
          <div className="breadcrumb">Active / Results Section</div>
        </div>
        <button className="btn-primary">View ls Section</button>
      </div>

      <br />

      {/* Trend Chart */}
      <div className="card">
        <div className="card-title">Run History &amp; Trends</div>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f5" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#8a9bb5' }} />
              <YAxis tick={{ fontSize: 11, fill: '#8a9bb5' }} domain={[0, 105]} />
              <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="Accuracy %" stroke="#f5a623" strokeWidth={2.5} dot={{ r: 4 }} />
              <Line type="monotone" dataKey="Objects Detected" stroke="#2ca58d" strokeWidth={2.5} dot={{ r: 4 }} />
              <Line type="monotone" dataKey="Processing Speed" stroke="#4a9eff" strokeWidth={2.5} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="empty-state">
            <div className="empty-icon">📈</div>
            <div className="empty-msg">No metric data yet. Upload videos and run analysis to populate this chart.</div>
          </div>
        )}
      </div>

      {/* Filter row */}
      <div className="filter-row">
        <input
          className="styled-input"
          placeholder="🔍 Search"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select
          className="styled-select"
          value={sortBy}
          onChange={e => setSortBy(e.target.value)}
        >
          <option>Date</option>
          <option>Accuracy %</option>
          <option>Objects Detected</option>
        </select>
        <div className="flex-spacer" />
        <button className="btn-secondary" disabled={!hasData} onClick={() => alert('PDF export coming soon')}>
          📄 Export to PDF
        </button>
        <button className="btn-success" disabled={!hasData} onClick={exportCSV}>
          📊 Export to CSV
        </button>
      </div>

      {/* Results table */}
      <div className="card">
        {filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📋</div>
            <div className="empty-msg">No results yet. Upload and analyse videos to see data here.</div>
          </div>
        ) : (
          <table className="styled-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Date</th>
                <th>Processing Time</th>
                <th>Accuracy %</th>
                <th>Objects Detected</th>
                <th>Video Length</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(u => (
                <tr key={u.id}>
                  <td>{u.id}</td>
                  <td>{u.name}</td>
                  <td>{u.date}</td>
                  <td>{u.processingTime ?? '—'}</td>
                  <td>{u.accuracy ?? '—'}</td>
                  <td>{u.objectsDetected ?? '—'}</td>
                  <td>{u.videoLength ?? '—'}</td>
                  <td>
                    <button className="action-btn">✏️</button>
                    <button className="action-btn">⋮</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  )
}
