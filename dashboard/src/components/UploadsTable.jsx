export function UploadsTable({ uploads }) {
  if (!uploads || uploads.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon">📂</div>
        <div className="empty-msg">No uploads yet. Go to Upload Video to get started.</div>
      </div>
    )
  }

  return (
    <table className="styled-table">
      <thead>
        <tr>
          <th>ID</th>
          <th>Name</th>
          <th>Date</th>
          <th>Status</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {uploads.map((u) => (
          <tr key={u.id}>
            <td>{u.id}</td>
            <td>{u.name}</td>
            <td>{u.date}</td>
            <td><span className="badge">Processed</span></td>
            <td>
              <button className="action-btn">✏️</button>
              <button className="action-btn">⋮</button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
