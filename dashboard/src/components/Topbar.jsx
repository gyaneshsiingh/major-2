export default function Topbar({ onToggleSidebar }) {
  return (
    <header className="topbar">
      <button className="mobile-menu-btn" onClick={onToggleSidebar}>☰</button>
      <span className="topbar-title">Video Analytics Dashboard</span>
    </header>
  )
}
