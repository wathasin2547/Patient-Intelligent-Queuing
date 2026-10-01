import Link from "next/link";
import { MockBanner } from "../_ui";

export default function LoginMockup() {
  return (
    <div className="flex min-h-screen flex-col bg-zinc-50">
      <MockBanner />
      <div className="flex flex-1 items-center justify-center px-4">
        <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-sm ring-1 ring-zinc-200">
          <div className="flex flex-col items-center text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-teal-600 text-xl font-bold text-white">P</div>
            <h1 className="mt-3 text-xl font-semibold">เข้าสู่ระบบ</h1>
            <p className="text-sm text-zinc-500">สำหรับบุคลากรทางการแพทย์</p>
          </div>
          <form className="mt-6 flex flex-col gap-3">
            <div>
              <label className="text-xs text-zinc-500">ชื่อผู้ใช้</label>
              <input className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm" placeholder="เช่น staff.med" />
            </div>
            <div>
              <label className="text-xs text-zinc-500">รหัสผ่าน</label>
              <input type="password" className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm" />
            </div>
            <Link href="/mockup/staff" className="mt-2 rounded-lg bg-teal-600 py-2 text-center text-sm font-medium text-white hover:bg-teal-700">
              เข้าสู่ระบบ
            </Link>
          </form>
          <p className="mt-5 text-center text-xs text-zinc-400">ไม่มีบัญชี? ติดต่อผู้ดูแลระบบเพื่อสร้างบัญชีให้</p>
        </div>
      </div>
    </div>
  );
}
