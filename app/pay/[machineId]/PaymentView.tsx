"use client";

import { useState } from "react";
import Image from "next/image";
import PaymentStatusListener from "./PaymentStatusListener";
import FeedbackForm from "./FeedbackForm";
import { submitFeedback } from "@/app/actions"; // Adjust path if needed

interface GPGInvoiceData {
  id: string;
  merchantOrderId: string;
  amount: number;
  currency: string;
  customerId?: string;
  customerName?: string;
  status: string;
  qr_image?: string;
  urls?: { name: string; code: string; link: string }[];
  cardPayment?: boolean;
  cardPaymentUrl?: string | null;
}

const BANK_ICONS: Record<string, string> = {
  "Khan bank": "https://qpay.mn/q/img/khanbank.webp",
  "Trade and Development bank": "https://qpay.mn/q/img/tdb.webp",
  "Social Pay": "https://qpay.mn/q/img/socialpay.webp",
  "State bank 3.0": "https://qpay.mn/q/img/statebank.webp",
  "Xac bank": "https://qpay.mn/q/img/xacbank.webp",
  "Capitron bank": "https://qpay.mn/q/img/capitron-bank.webp",
  "Bogd bank": "https://qpay.mn/q/img/bogd-bank.webp",
  "National investment bank": "https://qpay.mn/q/img/nibank.webp",
  "Most money": "https://qpay.mn/q/img/most-money.webp",
  "Trans bank": "https://qpay.mn/q/img/transbank.webp",
  "M bank": "https://qpay.mn/q/img/mbank.webp",
  "Arig bank": "https://qpay.mn/q/img/arig-bank.webp",
  "Chinggis khaan bank": "https://qpay.mn/q/img/ckbank.webp",
  Monpay: "https://qpay.mn/q/img/monpay.webp",
  Toki: "https://qpay.mn/q/img/tokipay.webp",
  "Ard App": "https://qpay.mn/q/img/ard.webp?v=2",
  Hipay: "https://qpay.mn/q/img/hipay.webp",
  "Happy Pay": "https://qpay.mn/q/img/tdbwallet.webp",
  Sono: "https://qpay.mn/q/img/sono.webp",
  PayOn: "https://qpay.mn/q/img/payon.webp",
  Tino: "https://qpay.mn/q/img/tino.webp",
  "Pass.mn": "https://qpay.mn/q/img/pass.webp",
  "qPay wallet": "https://qpay.mn/q/img/qpay-wallet.webp",
};

const getBankIcon = (bankName: string) => {
  const key = Object.keys(BANK_ICONS).find(
    (k) => k.toLowerCase() === bankName.toLowerCase(),
  );
  return key ? BANK_ICONS[key] : "https://qpay.mn/q/img/qpay-wallet.webp";
};

export default function PaymentView({
  machineId,
  invoiceData,
  error,
  qrImageSrc,
}: {
  machineId: string;
  invoiceData: GPGInvoiceData | null;
  error: string | null;
  qrImageSrc: string | null;
}) {
  const [showFeedback, setShowFeedback] = useState(false);

  // CONSTRAINT 1: Only show form with possibility to go back
  if (showFeedback) {
    return (
      <div className="p-6">
        <FeedbackForm
          machineId={machineId}
          onBack={() => setShowFeedback(false)}
          submitAction={submitFeedback}
        />
      </div>
    );
  }

  return (
    <>
      {/* Header */}
      <div className="bg-blue-600 p-6 text-center">
        <h1 className="text-2xl font-bold text-white">Машины төлбөр</h1>
        <p className="text-blue-100 mt-1">
          Машины дугаар:{" "}
          <span className="font-mono font-semibold">{machineId}</span>
        </p>
        {invoiceData && (
          <p className="text-blue-100 text-sm mt-1">
            Дүн:{" "}
            <span className="font-semibold">
              {invoiceData.amount.toLocaleString()} ₮
            </span>
          </p>
        )}
      </div>

      {/* Content */}
      <div className="p-6">
        {error ? (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-center">
            <p className="font-semibold">Тохиргооны алдаа</p>
            <p className="text-sm mt-1">{error}</p>
          </div>
        ) : !invoiceData ? (
          <p className="text-gray-500 text-center py-8">
            Төлбөрийн сонголтуудыг ачаалж байна...
          </p>
        ) : (
          <div className="space-y-6 flex flex-col items-center">
            {/* Feedback Trigger Button */}
            <button
              type="button"
              onClick={() => setShowFeedback(true)}
              className="w-full mt-4 flex items-center justify-center gap-2 text-gray-600 hover:text-blue-600 font-medium py-3 border border-gray-200 rounded-xl hover:bg-gray-50 transition-all"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
                />
              </svg>
              Санал, хүсэлт илгээх
            </button>

            <PaymentStatusListener
              merchantOrderId={invoiceData.merchantOrderId}
            />

            {qrImageSrc && (
              <div className="hidden md:flex flex-col items-center space-y-2">
                <p className="text-gray-600 text-sm font-medium text-center">
                  QR кодыг уншуулан төлнө үү
                </p>
                <Image
                  src={qrImageSrc}
                  alt="Төлбөрийн QR код"
                  width={220}
                  height={220}
                  className="rounded-lg border border-gray-200 p-2 bg-white"
                  unoptimized
                />
              </div>
            )}

            {invoiceData.urls && invoiceData.urls.length > 0 && (
              <div className="block lg:hidden space-y-3 w-full">
                <p className="text-gray-600 text-center text-sm font-medium md:block hidden">
                  Эсвэл банкны апп-аа сонгоно уу:
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {invoiceData.urls.map((bank, index) => {
                    const iconUrl = getBankIcon(bank.name);
                    return (
                      <a
                        key={index}
                        href={bank.link}
                        className="flex items-center gap-2 p-2 border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-all duration-200 group"
                      >
                        <Image
                          src={iconUrl}
                          alt={bank.name}
                          width={32}
                          height={32}
                          className="rounded object-contain bg-white shrink-0"
                          unoptimized
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm text-gray-800 group-hover:text-blue-700 truncate">
                            {bank.name}
                          </p>
                          <p className="text-xs text-gray-500 truncate">
                            {bank.code}
                          </p>
                        </div>
                      </a>
                    );
                  })}
                </div>
              </div>
            )}

            {invoiceData.cardPayment && invoiceData.cardPaymentUrl && (
              <a
                href={invoiceData.cardPaymentUrl}
                className="block w-full bg-gray-900 hover:bg-gray-800 text-white font-semibold py-3 px-4 rounded-xl transition-colors duration-200 text-center"
              >
                Картаар төлөх
              </a>
            )}
          </div>
        )}
      </div>
    </>
  );
}
