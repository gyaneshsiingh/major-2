export default function UploadsTable({ uploads }) {
  if (!uploads || uploads.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon">📂</div>
        <div className="empty-text">No uploads yet. Go to Upload Video to get started.</div>
      </div>
    )
  }

  return (
    <div className="data-table-wrapper">
      <table className="data-table">
        <thead>
          <tr>
            <th>Sample Name</th>
            <th>Date</th>
            <th>Peak (nm)</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {uploads.slice(0, 8).map((u) => (
            <tr key={u.id}>
              <td style={{ fontWeight: 600 }}>{u.sampleName}</td>
              <td>{u.date}</td>
              <td style={{ color: '#007bff', fontWeight: 700 }}>{u.peakNm || '—'}</td>
              <td><span className="badge">Processed</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
