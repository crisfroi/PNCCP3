import { Routes, Route, Navigate } from 'react-router-dom'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { AppLayout } from '@/components/layout/AppLayout'
import { Login } from '@/pages/Login'
import { Dashboard } from '@/pages/Dashboard'
import { ExpedientesList } from '@/pages/ExpedientesList'
import { WizardNuevoExpediente } from '@/pages/WizardNuevoExpediente'
import { ExpedienteDetail } from '@/pages/ExpedienteDetail'
import { InstitucionesList } from '@/pages/InstitucionesList'
import { PerfilesList } from '@/pages/PerfilesList'
import { RolesList } from '@/pages/RolesList'
import { LicitacionesList } from '@/pages/LicitacionesList'
import { OfeertasLicitacionDetail } from '@/pages/OfeertasLicitacionDetail'
import { EvaluacionesPage } from '@/pages/EvaluacionesPage'
import { AdjudicacionesPage } from '@/pages/AdjudicacionesPage'
import { ProveedoresList } from '@/pages/ProveedoresList'
import { MiPerfilRNP } from '@/pages/MiPerfilRNP'
import { ContratosList } from '@/pages/ContratosList'
import { AuditoriaPage } from '@/pages/AuditoriaPage'
import { DocumentosPage } from '@/pages/DocumentosPage'
import { EmisionesDocumentalesPage } from '@/pages/EmisionesDocumentalesPage'
import { DashboardAnalytics } from '@/pages/DashboardAnalytics'
import { ReportePorInstitucion } from '@/pages/ReportePorInstitucion'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="expedientes" element={<ExpedientesList />} />
        <Route path="expedientes/nuevo" element={<WizardNuevoExpediente />} />
        <Route path="expedientes/:id" element={<ExpedienteDetail />} />
        <Route path="instituciones" element={<InstitucionesList />} />
        <Route path="perfiles" element={<PerfilesList />} />
        <Route path="roles" element={<RolesList />} />
        <Route path="licitaciones" element={<LicitacionesList />} />
        <Route path="licitaciones/:id/ofertas" element={<OfeertasLicitacionDetail />} />
        <Route path="evaluaciones" element={<EvaluacionesPage />} />
        <Route path="adjudicaciones" element={<AdjudicacionesPage />} />
        <Route path="proveedores" element={<ProveedoresList />} />
        <Route path="proveedores/mi-perfil" element={<MiPerfilRNP />} />
        <Route path="contratos" element={<ContratosList />} />
        <Route path="auditoria" element={<AuditoriaPage />} />
        <Route path="documentos" element={<DocumentosPage />} />
        <Route path="emisiones-documentales" element={<EmisionesDocumentalesPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
