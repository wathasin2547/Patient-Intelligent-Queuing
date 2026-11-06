import { MockProvider } from "@/lib/mock/store";

export default function DisplayLayout({ children }: { children: React.ReactNode }) {
  return <MockProvider>{children}</MockProvider>;
}
