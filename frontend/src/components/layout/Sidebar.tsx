import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Building2,
  FileText,
  Gavel,
  ClipboardList,
  FileCheck,
  Shield,
  Users,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'

interface NavItem {
  to: string
  label: string
  icon: React.ReactNode
  roles?: string[]
}

const navItems: NavItem[] = [
  { to: '/', label: 'Inicio', icon: <LayoutDashboard className="h-5 w-5" /> },
  {
    to: '/instituciones',
    label: 'Instituciones',
    icon: <Building2 className="h-5 w-5" />,
    roles: ['Admin Nacional'],
  },
  {
    to: '/perfiles',
    label: 'Perfiles',
    icon: <Users className="h-5 w-5" />,
    roles: ['Admin Nacional'],
  },
  {
    to: '/roles',
    label: 'Roles',
    icon: <Shield className="h-5 w-5" />,
    roles: ['Admin Nacional'],
  },
  {
    to: '/expedientes',
    label: 'Expedientes',
    icon: <FileText className="h-5 w-5" />,
    roles: ['Admin Nacional', 'Admin Institucional', 'Técnico', 'Auditor'],
  },
  {
    to: '/expedientes/nuevo',
    label: 'Nuevo expediente',
    icon: <FileText className="h-5 w-5" />,
    roles: ['Admin Nacional', 'Admin Institucional'],
  },
  {
    to: '/licitaciones',
    label: 'Licitaciones',
    icon: <Gavel className="h-5 w-5" />,
    roles: ['Admin Nacional', 'Admin Institucional', 'Técnico', 'Auditor', 'Proveedor'],
  },
  {
    to: '/proveedores/mi-perfil',
    label: 'Mi perfil RNP',
    icon: <Users className="h-5 w-5" />,
    roles: ['Proveedor'],
  },
  {
    to: '/proveedores',
    label: 'Proveedores (RNP)',
    icon: <Users className="h-5 w-5" />,
    roles: ['Admin Nacional', 'Admin Institucional', 'Auditor'],
  },
  {
    to: '/contratos',
    label: 'Contratos',
    icon: <FileCheck className="h-5 w-5" />,
    roles: ['Admin Nacional', 'Admin Institucional', 'Técnico', 'Auditor', 'Proveedor'],
  },
  {
    to: '/auditoria',
    label: 'Auditoría',
    icon: <Shield className="h-5 w-5" />,
    roles: ['Admin Nacional', 'Auditor'],
  },
]

export function Sidebar() {
  const { rol } = useAuth()

  const visibleItems = navItems.filter(
    (item) => !item.roles || (rol && item.roles.includes(rol))
  )

  return (
    <aside className="fixed inset-y-0 left-0 z-40 w-64 border-r border-gray-200 bg-white">
      <div className="flex h-16 items-center border-b border-gray-100 px-6">
        <span className="font-semibold text-institucional-primary">
          PNCCP
        </span>
      </div>
      <nav className="space-y-0.5 p-4">
        {visibleItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-institucional-primary text-white'
                  : 'text-gray-600 hover:bg-institucional-light hover:text-institucional-primary'
              }`
            }
          >
            {item.icon}
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
