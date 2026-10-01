import { doctors } from "../../_data";

const DAYS = ["พฤ 1", "ศ 2", "ส 3", "อา 4", "จ 5", "อ 6", "พ 7"];

export default function ShiftsPage() {
  return (
    <div className="mx-auto max-w-7xl px-6 py-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">ตารางเวรแพทย์</h1>
          <p className="text-sm text-zinc-500">1–7 ตุลาคม 2569 · ระบบออกคิวให้เฉพาะแผนกที่มีแพทย์อยู่ในเวรขณะนั้น</p>
        </div>
        <button className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700">+ เพิ่มเวร</button>
      </div>

      <div className="mt-5 overflow-x-auto rounded-xl bg-white ring-1 ring-zinc-200">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-left text-xs text-zinc-500">
              <th className="px-4 py-3 font-medium">แพทย์</th>
              {DAYS.map((d) => <th key={d} className="px-2 py-3 text-center font-medium">{d}</th>)}
            </tr>
          </thead>
          <tbody>
            {doctors.map((doc) => (
              <tr key={doc.name} className="border-b border-zinc-100 last:border-0">
                <td className="px-4 py-3">
                  <div className="font-medium">{doc.name}</div>
                  <div className="text-xs text-zinc-500">{doc.department}</div>
                </td>
                {DAYS.map((d, i) => {
                  const off = i === 3 || (doc.department === "ศัลยกรรม" && i === 2);
                  return (
                    <td key={d} className="px-2 py-3 text-center">
                      {off ? (
                        <span className="text-xs text-zinc-300">—</span>
                      ) : (
                        <span className="inline-block rounded-md bg-teal-50 px-2 py-1 text-xs text-teal-800 ring-1 ring-teal-200">{doc.shift}</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-zinc-500">
        ยกเลิกเวรที่ยังมีผู้ป่วยรออยู่ ระบบจะแจ้งจำนวนผู้ป่วยที่ได้รับผลกระทบให้ย้ายคิวก่อนยืนยัน
      </p>
    </div>
  );
}
