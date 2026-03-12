import PageHeader from '../components/PageHeader'
import UploadsTable from '../components/UploadsTable'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

export default function Dashboard({ uploads }) {
  // Calculate real stats from backend data
  const totalSamples = uploads.length

  const avgPeak = totalSamples > 0
    ? (uploads.reduce((sum, r) => sum + r.peakNm, 0) / totalSamples).toFixed(1)
    : '—'

  // Accuracy is returned as % by App.jsx mapping
  const avgAccuracy = totalSamples > 0
    ? (uploads.reduce((sum, r) => sum + (r.accuracy || 0), 0) / totalSamples).toFixed(1)
    : '—'

  const latestShift = totalSamples > 1
    ? (uploads[0].peakNm - uploads[1].peakNm).toFixed(2)
    : '—'

  // Prepare trend data (newest first in uploads, so reverse for chart)
  const trendData = [...uploads].reverse().map(r => ({
    name: r.sampleName,
    peak: r.peakNm,
    avg: r.avgNm
  }))

  const stats = [
    { label: 'Total Samples', value: totalSamples, change: '+12%', icon: '📊' }, // static change for UI fluff
    { label: 'Avg Peak λ', value: `${avgPeak} nm`, change: '-0.5%', icon: '🎯' },
    { label: 'Avg Accuracy', value: `${avgAccuracy}%`, change: '+2.1%', icon: '✅' },
    { label: 'Latest Shift', value: `${latestShift} nm`, change: 'In Range', icon: '📈' },
  ]

  return (
    <>
      <PageHeader title="Dashboard" />

      <div className="stats-grid">
        {stats.map(s => (
          <div key={s.label} className="card stat-card">
            <div className="stat-header">
              <span className="stat-icon">{s.icon}</span>
              <span className="stat-badge">{s.change}</span>
            </div>
            <div className="stat-value">{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="two-col">
        <div className="card">
          <div className="card-title">Run History & Trends</div>
          <div style={{ height: 300, width: '100%', marginTop: 20 }}>
            {trendData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f2f5" />
                  <XAxis dataKey="name" stroke="#8a9bb5" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#8a9bb5" fontSize={12} tickLine={false} axisLine={false} domain={['auto', 'auto']} />
                  <Tooltip
                    contentStyle={{ borderRadius: 10, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  />
                  <Line type="monotone" dataKey="peak" stroke="#007bff" strokeWidth={3} dot={{ r: 4, fill: '#007bff' }} />
                  <Line type="monotone" dataKey="avg" stroke="#28a745" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="empty-state">
                <div className="empty-icon">📈</div>
                <div className="empty-text">No analytical data available yet</div>
                <div style={{ color: '#8a9bb5', fontSize: 13 }}>Upload a video to see trends</div>
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-title">My Uploads</div>
          <UploadsTable uploads={uploads.slice(0, 5)} />
        </div>
      </div>
    </>
  )
}
