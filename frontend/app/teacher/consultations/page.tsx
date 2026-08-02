import { listAcademyConsultations } from '@/lib/consultations/service'
import { StaffConsultationBoard } from '@/lib/consultations/components/StaffConsultationBoard'

export default async function TeacherConsultationsPage() {
  const rows = await listAcademyConsultations()
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">상담</h1>
      <StaffConsultationBoard rows={rows} />
    </div>
  )
}
