"use client";

import { useEffect, useState } from "react";

export default function PaymentStatusListener({
  merchantOrderId,
}: {
  merchantOrderId: string;
}) {
  const [status, setStatus] = useState<"pending" | "success" | "error">(
    "pending",
  );

  useEffect(() => {
    // Stop polling if we've already reached a terminal state
    if (status === "success" || status === "error") return;

    let isMounted = true;

    const checkStatus = async () => {
      try {
        const res = await fetch(
          `/api/check-payment-status?merchantOrderId=${encodeURIComponent(merchantOrderId)}`,
        );

        if (!res.ok) {
          throw new Error("Failed to fetch payment status");
        }

        const data = await res.json();

        if (isMounted) {
          setStatus(data.status);
        }
      } catch (err) {
        console.error("Failed to check payment status", err);
      }
    };

    checkStatus(); // Initial immediate check
    const intervalId = setInterval(checkStatus, 2000); // Poll every 2 seconds

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, [merchantOrderId, status]);

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
