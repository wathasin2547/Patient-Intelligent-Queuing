"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { questions } from "../../_data";

type Msg = { from: "bot" | "me"; text: string };
const NONE = "ไม่มีอาการเหล่านี้";

export default function ScreeningMockup() {
  const [msgs, setMsgs] = useState<Msg[]>([
    { from: "bot", text: "สวัสดีค่ะ ระบบจะถามอาการทีละข้อเพื่อแนะนำแผนกและออกคิวให้ ใช้เวลาประมาณ 1–2 นาที" },
    { from: "bot", text: questions[0].text },
  ]);
  const [step, setStep] = useState(0); // index in questions, then "text", "done"
  const [multi, setMulti] = useState<string[]>([]);
  const [phase, setPhase] = useState<"q" | "text" | "processing" | "emergency" | "result">("q");
  const [freeText, setFreeText] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, phase]);

  const say = (...m: Msg[]) => setMsgs((prev) => [...prev, ...m]);

  function answer(text: string) {
    const q = questions[step];
    say({ from: "me", text });
    // red flag answered -> stop immediately, no further questions (rule-based, before LLM)
    if (q.multi && text !== NONE) {
      setPhase("emergency");
      return;
    }
    let next = step + 1;
    // follow-up question only when "ปวดท้อง" was chosen
    if (next === 3 && text !== "ปวดท้อง") next = 4;
    if (next < questions.length) {
      setStep(next);
      say({ from: "bot", text: questions[next].text });
    } else {
      setPhase("text");
      say({ from: "bot", text: "อยากเล่าอาการเพิ่มเติมไหมคะ พิมพ์ได้ตามสะดวก หรือกดข้ามได้" });
    }
  }

  function submitText(skip: boolean) {
    if (!skip && freeText.trim()) say({ from: "me", text: freeText.trim() });
    setPhase("processing");
    setTimeout(() => setPhase("result"), 1200);
  }

  const q = questions[step];

  return (
    <div className="flex flex-1 flex-col bg-[#8CABD9]/25">
      <div className="flex flex-1 flex-col gap-2 overflow-y-auto px-3 py-4">
        {msgs.map((m, i) => (
          <div key={i} className={`flex ${m.from === "me" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[78%] rounded-2xl px-3 py-2 text-sm ${m.from === "me" ? "bg-[#06C755] text-white rounded-br-sm" : "bg-white text-zinc-800 rounded-bl-sm shadow-sm"}`}>
              {m.text}
            </div>
          </div>
        ))}

        {phase === "processing" && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-sm bg-white px-3 py-2 text-sm text-zinc-500 shadow-sm">กำลังคัดกรองและหาแพทย์ที่อยู่เวร…</div>
          </div>
        )}

        {phase === "emergency" && (
          <div className="mt-2 rounded-2xl bg-red-600 p-4 text-white shadow">
            <div className="text-lg font-semibold">กรุณาไปที่ห้องฉุกเฉินทันที</div>
            <p className="mt-1 text-sm text-red-50">
              อาการที่แจ้งต้องได้รับการดูแลโดยเร็ว ระบบไม่ออกคิวผู้ป่วยนอกให้ และแจ้งเจ้าหน้าที่แล้ว
            </p>
            <a href="tel:1669" className="mt-3 block rounded-xl bg-white py-2.5 text-center font-semibold text-red-700">โทร 1669</a>
          </div>
        )}

        {phase === "result" && (
          <div className="mt-2 rounded-2xl bg-white p-4 shadow">
            <div className="text-xs text-zinc-500">แผนกที่ระบบแนะนำ</div>
            <div className="text-lg font-semibold">ศัลยกรรม</div>
            <div className="mt-3 flex items-center justify-between rounded-xl bg-zinc-50 px-3 py-2">
              <span className="text-sm text-zinc-500">หมายเลขคิว</span>
              <span className="font-mono text-2xl font-bold">SUR-007</span>
            </div>
            <p className="mt-2 text-xs text-zinc-500">ระบบแนะนำแผนกจากอาการที่แจ้ง ไม่ใช่การวินิจฉัยโรค แพทย์จะเป็นผู้ตรวจอีกครั้ง</p>
            <Link href="/mockup/liff/queue" className="mt-3 block rounded-xl bg-[#06C755] py-2.5 text-center font-medium text-white">ดูสถานะคิว</Link>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {phase === "q" && (
        <div className="border-t border-zinc-200 bg-white p-3">
          <div className="flex flex-wrap gap-1.5">
            {q.options.map((o) =>
              q.multi ? (
                <button
                  key={o}
                  onClick={() => (o === NONE ? answer(NONE) : setMulti(multi.includes(o) ? multi.filter((x) => x !== o) : [...multi, o]))}
                  className={`rounded-full px-3 py-1.5 text-sm ring-1 ${o === NONE ? "bg-zinc-100 ring-zinc-300" : multi.includes(o) ? "bg-red-50 text-red-700 ring-red-300" : "ring-zinc-300"}`}
                >
                  {o}
                </button>
              ) : (
                <button key={o} onClick={() => answer(o)} className="rounded-full px-3 py-1.5 text-sm text-[#06A847] ring-1 ring-[#06C755]">
                  {o}
                </button>
              ),
            )}
          </div>
          {q.multi && multi.length > 0 && (
            <button onClick={() => answer(multi.join(", "))} className="mt-2 w-full rounded-xl bg-red-600 py-2 text-sm font-medium text-white">
              ยืนยัน ({multi.length} อาการ)
            </button>
          )}
        </div>
      )}

      {phase === "text" && (
        <div className="flex items-center gap-2 border-t border-zinc-200 bg-white p-3">
          <input value={freeText} onChange={(e) => setFreeText(e.target.value)} className="input" placeholder="เช่น ปวดท้องขวาล่าง กดแล้วเจ็บ มีไข้" />
          <button onClick={() => submitText(false)} className="shrink-0 rounded-lg bg-[#06C755] px-3 py-2 text-sm font-medium text-white">ส่ง</button>
          <button onClick={() => submitText(true)} className="shrink-0 text-sm text-zinc-500">ข้าม</button>
        </div>
      )}
    </div>
  );
}
