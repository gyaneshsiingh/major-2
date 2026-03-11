import PageHeader from '../components/PageHeader'
import { UploadsTable } from '../components/UploadsTable'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer
} from 'recharts'

export default function Dashboard({ uploads }) {
  const hasData = uploads.length > 0

  const totalUploads = uploads.length
  const avgAccuracy = hasData && uploads.some(u => u.accuracy != null)
    ? (uploads.filter(u => u.accuracy != null)
        .reduce((s, u) => s + u.accuracy, 0) /
       uploads.filter(u => u.accuracy != null).length).toFixed(1) + '%'
    : '—'
  const totalObjects = hasData && uploads.some(u => u.objectsDetected != null)
    ? uploads.reduce((s, u) => s + (u.objectsDetected || 0), 0)
    : '—'
  const lastDate = hasData ? uploads[uploads.length - 1].date : '—'

  const chartData = uploads
    .filter(u => u.accuracy != null)
    .map(u => ({
      date: u.date,
      'Accuracy %': u.accuracy,
      'Objects Detected': u.objectsDetected,
    }))

  return (
    <>
      <PageHeader title="Dashboard" />

      {/* Stat cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Total Uploads</div>
          <div className={`stat-value ${!hasData ? 'dash' : ''}`}>{totalUploads || '—'}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Avg Accuracy</div>
          <div className={`stat-value ${avgAccuracy === '—' ? 'dash' : ''}`}>{avgAccuracy}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Objects Detected</div>
          <div className={`stat-value ${totalObjects === '—' ? 'dash' : ''}`}>{totalObjects}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Last Run Date</div>
          <div className={`stat-value ${lastDate === '—' ? 'dash' : ''}`}
               style={{ fontSize: lastDate !== '—' ? '20px' : undefined }}>
            {lastDate}
          </div>
        </div>
      </div>

      {/* Trend chart */}
      <div className="card">
        <div className="card-title">Run History &amp; Trends</div>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f5" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#8a9bb5' }} />
              <YAxis tick={{ fontSize: 11, fill: '#8a9bb5' }} />
              <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="Accuracy %" stroke="#f5a623" strokeWidth={2.5} dot={{ r: 4 }} />
              <Line type="monotone" dataKey="Objects Detected" stroke="#2ca58d" strokeWidth={2.5} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="empty-state">
            <div className="empty-icon">📈</div>
            <div className="empty-msg">Chart will appear after you upload and analyse videos.</div>
          </div>
        )}
      </div>

      {/* Uploads table */}
      <div className="card">
        <div className="card-title">My Uploads</div>
        <UploadsTable uploads={uploads} />
      </div>
    </>
  )
}
