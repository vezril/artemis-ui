import { redirect } from "next/navigation";

/** The console opens on Health. */
export default function HomePage() {
  redirect("/health");
}
