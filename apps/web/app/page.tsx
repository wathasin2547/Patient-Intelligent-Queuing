import { redirect } from "next/navigation";

// The app always starts at the login page; proxy.ts sends a signed-in user on to their own home.
// The map of every screen for developers moved to /dev.
export default function Root() {
  redirect("/login");
}
