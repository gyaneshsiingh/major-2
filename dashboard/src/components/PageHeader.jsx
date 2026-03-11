export default function PageHeader({ title }) {
  return (
    <div className="page-header">
      <div className="page-title-row">
        <h1 className="page-title">{title}</h1>
        <span className="badge-active">Active</span>
      </div>
      <div className="breadcrumb">Active / {title}</div>
    </div>
  )
}
