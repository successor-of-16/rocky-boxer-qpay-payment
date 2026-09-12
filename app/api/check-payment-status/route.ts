import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const merchantOrderId = searchParams.get("merchantOrderId");

  if (!merchantOrderId) {
    return NextResponse.json(
      { status: "error", message: "merchantOrderId is required" },
      { status: 400 },
    );
  }

  const supabaseUrl = process.env.SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data, error } = await supabase
    .from("qpay_responses")
    .select("status")
    .eq("merchant_order_id", merchantOrderId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ status: "pending" });
  }

  const pStatus = data.status?.toUpperCase();
  let mappedStatus: "pending" | "success" | "error" = "pending";

  if (["SUCCESS", "PAID", "COMPLETED"].includes(pStatus)) {
    mappedStatus = "success";
  } else if (["FAILED", "CANCELLED", "ERROR"].includes(pStatus)) {
    mappedStatus = "error";
  }

  return NextResponse.json({ status: mappedStatus });
}
