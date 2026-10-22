"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// โหลดข้อมูลใหม่ทุก 10 วินาที จะได้เห็นคิวที่เพิ่งเข้ามา
export default function AutoRefresh() {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => router.refresh(), 10_000);
    return () => clearInterval(t);
  }, [router]);
  return null;
}