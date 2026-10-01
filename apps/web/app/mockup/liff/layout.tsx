import { MockBanner } from "../_ui";

// Shows LIFF screens inside a phone-sized frame on desktop; full width on a real phone.
export default function LiffLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-zinc-200">
      <MockBanner />
      <div className="flex flex-1 justify-center sm:py-6">
        <div className="flex w-full max-w-[400px] flex-col overflow-hidden bg-white sm:rounded-[28px] sm:shadow-xl sm:ring-8 sm:ring-zinc-900">
          <div className="flex items-center gap-2 bg-[#06C755] px-4 py-3 text-white">
            <span className="text-lg">‹</span>
            <span className="text-sm font-semibold">โรงพยาบาลตัวอย่าง (PIQ)</span>
          </div>
          <div className="flex flex-1 flex-col">{children}</div>
        </div>
      </div>
    </div>
  );
}
