const NAV_ITEMS = [
  { label: 'Dashboard',       icon: '▣' },
  { label: 'Upload Video',    icon: '↑' },
  { label: 'Compare Section', icon: '⇄' },
  { label: 'Results Section', icon: '≡' },
]

export default function Sidebar({ currentPage, setPage, isOpen, setIsOpen }) {
  return (
    <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
      <div className="sidebar-logo">
        <div className="logo-box">📊</div>
        <span className="logo-text">Analytics<br />Portal</span>
        <button 
          className="mobile-menu-btn" 
          style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#fff', fontSize: '20px' }}
          onClick={() => setIsOpen(false)}
        >
          ✕
        </button>
      </div>

      <nav className="sidebar-nav">
        {NAV_ITEMS.map(({ label, icon }) => (
          <button
            key={label}
            className={`nav-item ${currentPage === label ? 'active' : ''}`}
            onClick={() => {
              setPage(label)
              if (window.innerWidth <= 768) setIsOpen(false)
            }}
          >
            <span className="nav-icon">{icon}</span>
            {label}
          </button>
        ))}
      </nav>
    </aside>
  )
}
