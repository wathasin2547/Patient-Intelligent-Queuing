import { prisma } from "@/lib/prisma";
import { callNext, callQueue, finishQueue } from "./actions";
import AutoRefresh from "./AutoRefresh";

export const dynamic = "force-dynamic";

const LEVEL: Record<number, string> = {
  1: "ฉุกเฉินมาก",
  2: "เร่งด่วน",
  3: "ปานกลาง",
  4: "ไม่รุนแรง",
  5: "ไม่เร่งด่วน",
};

const cell = { padding: "8px 12px", borderBottom: "1px solid #ddd", textAlign: "left" as const };

export default async function StaffPage() {
  const queues = await prisma.queue.findMany({
    where: { status: { in: ["WAITING", "CALLED"] } },
    include: { department: true },
    orderBy: [{ priorityLevel: "asc" }, { checkInTime: "asc" }],
  });
  const waiting = queues.filter((q) => q.status === "WAITING");
  const called = queues.filter((q) => q.status === "CALLED");

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: 24, fontFamily: "sans-serif" }}>
      <AutoRefresh />
      <h1>คิวผู้ป่วย</h1>

      <form action={callNext}>
        <button type="submit" disabled={waiting.length === 0} style={{ padding: "10px 20px", fontSize: 16 }}>
          เรียกคิวถัดไป
        </button>
      </form>

      <h2>กำลังเรียก ({called.length})</h2>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <tbody>
          {called.map((q) => (
            <tr key={q.id}>
              <td style={cell}><b>{q.queueNumber}</b></td>
              <td style={cell}>{q.department.name}</td>
              <td style={cell}>
                <form action={finishQueue.bind(null, q.id)}>
                  <button type="submit">จบคิว</button>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>รออยู่ ({waiting.length})</h2>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={cell}>คิว</th>
            <th style={cell}>แผนก</th>
            <th style={cell}>ความเร่งด่วน</th>
            <th style={cell}>มาถึง</th>
            <th style={cell}></th>
          </tr>
        </thead>
        <tbody>
          {waiting.map((q) => (
            <tr key={q.id}>
              <td style={cell}><b>{q.queueNumber}</b></td>
              <td style={cell}>{q.department.name}</td>
              <td style={cell}>ระดับ {q.priorityLevel} ({LEVEL[q.priorityLevel] ?? "-"})</td>
              <td style={cell}>
                {q.checkInTime.toLocaleTimeString("th-TH", { timeZone: "Asia/Bangkok" })}
              </td>
              <td style={cell}>
                <form action={callQueue.bind(null, q.id)}>
                  <button type="submit">เรียก</button>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}