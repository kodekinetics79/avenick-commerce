import { redirect } from "next/navigation";
import { requireSellerSession } from "@/lib/auth";
import { sellerLandingRoute } from "@/lib/seller-home";

export default async function RootPage() {
  const { membership } = await requireSellerSession();
  redirect(sellerLandingRoute(membership.permissions));
}
