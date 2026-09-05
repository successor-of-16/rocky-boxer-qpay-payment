"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function PaymentStatusListener({
  merchantOrderId,
}: {
  merchantOrderId: string;
}) {
  const [status, setStatus] = useState<"pending" | "success" | "error">(
    "pending",
  );

  useEffect(() => {
    const channel = supabase
      .channel(`qpay-response-${merchantOrderId}`)
      .on(
        "postgres_changes",
        {
          event: "*", // Listen to both INSERT and UPDATE
          schema: "public",
          table: "qpay_responses",
          filter: `merchant_order_id=eq.${merchantOrderId}`,
        },
        (payload) => {
          const pStatus = (payload.new as any).status?.toUpperCase();
          if (
            pStatus === "SUCCESS" ||
            pStatus === "PAID" ||
            pStatus === "COMPLETED"
          ) {
            setStatus("success");
          } else if (
            pStatus === "FAILED" ||
            pStatus === "CANCELLED" ||
            pStatus === "ERROR"
          ) {
            setStatus("error");
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [merchantOrderId]);

  if (status === "success") {
    return (
      <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-center mt-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
        <p className="font-semibold">Төлбөр амжилттай гүйцэтгэгдлээ!</p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-center mt-4">
        <p className="font-semibold">Төлбөр төлөгдсөнгүй эсвэл цуцлагдлаа.</p>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center gap-2 text-blue-600 mt-4">
      <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      <span className="text-sm font-medium">Төлбөр хүлээгдэж байна...</span>
    </div>
  );
}
