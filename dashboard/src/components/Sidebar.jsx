const NAV_ITEMS = [
  { label: 'Dashboard',       icon: '▣' },
  { label: 'Upload Video',    icon: '↑' },
  { label: 'Compare Section', icon: '⇄' },
  { label: 'Results Section', icon: '≡' },
]

export default function Sidebar({ currentPage, setPage }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="logo-box">📊</div>
        <span className="logo-text">Analytics<br />Portal</span>
      </div>

      <nav className="sidebar-nav">
        {NAV_ITEMS.map(({ label, icon }) => (
          <button
            key={label}
            className={`nav-item ${currentPage === label ? 'active' : ''}`}
            onClick={() => setPage(label)}
          >
            <span className="nav-icon">{icon}</span>
            {label}
          </button>
        ))}
      </nav>
    </aside>
  )
}
