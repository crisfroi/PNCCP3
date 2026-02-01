import { Download } from 'lucide-react'

interface ExportButtonProps {
  data: any[]
  filename: string
  format?: 'csv' | 'json'
  disabled?: boolean
  onClick?: () => void
}

export function ExportButton({
  data,
  filename,
  format = 'csv',
  disabled = false,
  onClick,
}: ExportButtonProps) {
  const handleClick = () => {
    if (onClick) {
      onClick()
      return
    }

    if (!data || data.length === 0) {
      alert('No hay datos para exportar')
      return
    }

    let content = ''
    let type = ''
    let fileExtension = ''

    if (format === 'csv') {
      const headers = Object.keys(data[0])
      const rows = data.map((row) =>
        headers.map((header) => {
          const value = row[header]
          if (typeof value === 'string' && value.includes(',')) {
            return `"${value.replace(/"/g, '""')}"`
          }
          return value
        })
      )
      content = [headers, ...rows].map((row) => row.join(',')).join('\n')
      type = 'text/csv;charset=utf-8;'
      fileExtension = 'csv'
    } else if (format === 'json') {
      content = JSON.stringify(data, null, 2)
      type = 'application/json;charset=utf-8;'
      fileExtension = 'json'
    }

    const blob = new Blob([content], { type })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `${filename}.${fileExtension}`)
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <button
      onClick={handleClick}
      disabled={disabled}
      className="inline-flex items-center gap-2 px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 transition text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
      title={`Exportar en formato ${format.toUpperCase()}`}
    >
      <Download className="h-4 w-4" />
      Exportar {format.toUpperCase()}
    </button>
  )
}
