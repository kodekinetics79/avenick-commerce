import { redirect } from "next/navigation";

// Dispatch queue lives in the warehouse pick/pack pipeline.
export default function DispatchPage() {
  redirect("/warehouse/pickpack?tab=dispatch");
}
