import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createStudentAction } from '@/lib/students/actions'

export default function NewStudentPage() {
  return (
    <div className="max-w-xl mx-auto">
      <h1 className="text-2xl font-semibold mb-6">학생 등록</h1>
      <form action={createStudentAction} className="space-y-4 bg-white border border-gray-200 rounded-lg p-6">
        <div className="space-y-1">
          <Label htmlFor="name">이름</Label>
          <Input id="name" name="name" required />
        </div>
        <div className="space-y-1">
          <Label htmlFor="school">학교</Label>
          <Input id="school" name="school" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="grade">학년</Label>
          <Input id="grade" name="grade" placeholder="예: 고1" />
        </div>
        <Button type="submit" className="w-full">등록</Button>
      </form>
    </div>
  )
}
