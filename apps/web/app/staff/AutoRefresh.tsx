"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AutoRefresh() {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => router.refresh(), 10_000);
    return () => clearInterval(t);
  }, [router]);
  return null;
}