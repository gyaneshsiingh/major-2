import { useState } from 'react'
import PageHeader from '../components/PageHeader'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

export default function CompareSection({ uploads }) {
  const [runA, setRunA] = useState('')
  const [runB, setRunB] = useState('')

  const dataA = uploads.find(u => u.id === runA)
  const dataB = uploads.find(u => u.id === runB)

  const comparisonData = [
    { name: 'Peak λ (nm)', [dataA?.sampleName || 'Run A']: dataA?.peakNm, [dataB?.sampleName || 'Run B']: dataB?.peakNm },
    { name: 'Avg λ (nm)', [dataA?.sampleName || 'Run A']: dataA?.avgNm, [dataB?.sampleName || 'Run B']: dataB?.avgNm },
    { name: 'Voltage (V)', [dataA?.sampleName || 'Run A']: dataA?.voltage, [dataB?.sampleName || 'Run B']: dataB?.voltage },
    { name: 'Accuracy (%)', [dataA?.sampleName || 'Run A']: dataA?.accuracy, [dataB?.sampleName || 'Run B']: dataB?.accuracy },
  ]

  const shift = (dataA && dataB) ? (dataA.peakNm - dataB.peakNm).toFixed(2) : '—'

  return (
    <>
      <PageHeader title="Compare Section" />
      <div className="two-col">
        
        {/* Left: Selection & Shift */}
        <div>
          <div className="card">
            <div className="card-title">Select Runs to Compare</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 15, marginBottom: 20 }}>
              <div style={{ flex: '1 1 120px' }}>
                <label style={{ fontSize: 12, color: '#8a9bb5', display: 'block', marginBottom: 5 }}>Reference Run</label>
                <select className="styled-input" value={runA} onChange={e => setRunA(e.target.value)}>
                  <option value="">Select a run...</option>
                  {uploads.map(u => (
                    <option key={u.id} value={u.id}>{u.sampleName} ({u.date})</option>
                  ))}
                </select>
              </div>
              <div style={{ flex: '1 1 120px' }}>
                <label style={{ fontSize: 12, color: '#8a9bb5', display: 'block', marginBottom: 5 }}>Comparison Run</label>
                <select className="styled-input" value={runB} onChange={e => setRunB(e.target.value)}>
                  <option value="">Select a run...</option>
                  {uploads.map(u => (
                    <option key={u.id} value={u.id}>{u.sampleName} ({u.date})</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ background: '#f8f9fb', borderRadius: 12, padding: 20, textAlign: 'center' }}>
              <div style={{ fontSize: 14, color: '#8a9bb5', marginBottom: 5 }}>Wavelength Shift (∆λ)</div>
              <div style={{ fontSize: 32, fontWeight: 800, color: '#007bff' }}>{shift} nm</div>
              <div style={{ fontSize: 12, color: shift > 0 ? '#e63946' : '#28a745', marginTop: 5 }}>
                {shift > 0 ? '🔴 Red Shift detected' : shift < 0 ? '🔵 Blue Shift detected' : 'Neutral'}
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-title">Comparison Details</div>
            <div className="data-table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Metric</th>
                    <th>{dataA?.sampleName || 'Run A'}</th>
                    <th>{dataB?.sampleName || 'Run B'}</th>
                    <th>Diff</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Peak λ</td>
                    <td>{dataA?.peakNm || '—'} nm</td>
                    <td>{dataB?.peakNm || '—'} nm</td>
                    <td style={{ fontWeight: 600 }}>{shift} nm</td>
                  </tr>
                  <tr>
                    <td>Avg λ</td>
                    <td>{dataA?.avgNm || '—'} nm</td>
                    <td>{dataB?.avgNm || '—'} nm</td>
                    <td>{dataA && dataB ? (dataA.avgNm - dataB.avgNm).toFixed(2) : '—'} nm</td>
                  </tr>
                  <tr>
                    <td>Voltage</td>
                    <td>{dataA?.voltage || '—'}V</td>
                    <td>{dataB?.voltage || '—'}V</td>
                    <td>{dataA && dataB ? (dataA.voltage - dataB.voltage).toFixed(1) : '—'}V</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right: Bar Chart */}
        <div className="card">
          <div className="card-title">Visual Comparison</div>
          <div style={{ height: 400, width: '100%', marginTop: 20 }}>
            {dataA || dataB ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={comparisonData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f2f5" />
                  <XAxis dataKey="name" stroke="#8a9bb5" fontSize={12} axisLine={false} tickLine={false} />
                  <YAxis stroke="#8a9bb5" fontSize={12} axisLine={false} tickLine={false} />
                  <Tooltip cursor={{fill: '#f8f9fb'}} />
                  <Legend />
                  <Bar dataKey={dataA?.sampleName || 'Run A'} fill="#007bff" radius={[4, 4, 0, 0]} barSize={40} />
                  <Bar dataKey={dataB?.sampleName || 'Run B'} fill="#e63946" radius={[4, 4, 0, 0]} barSize={40} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="empty-state">Select runs to see comparison chart</div>
            )}
          </div>
        </div>

      </div>
    </>
  )
}
