import Image from "next/image";
import { createClient } from "@supabase/supabase-js";
import PaymentStatusListener from "./PaymentStatusListener"; // Adjust path if needed

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

interface GPGBankLink {
  name: string;
  code: string;
  link: string;
}

interface GPGInvoiceData {
  id: string;
  merchantOrderId: string;
  amount: number;
  currency: string;
  customerId?: string;
  customerName?: string;
  status: string;
  qr_text?: string;
  qr_image?: string;
  urls?: GPGBankLink[];
  cardPayment?: boolean;
  cardPaymentUrl?: string | null;
  expiresAt?: string;
  createdAt?: string;
}

interface GPGInvoiceResponse {
  success: boolean;
  data: GPGInvoiceData;
}

const getBankIcon = (bankName: string) => {
  const key = Object.keys(BANK_ICONS).find(
    (k) => k.toLowerCase() === bankName.toLowerCase(),
  );
  return key ? BANK_ICONS[key] : "https://qpay.mn/q/img/qpay-wallet.webp";
};

async function getGPGInvoice(machineId: string): Promise<GPGInvoiceData> {
  const supabaseUrl = process.env.SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data: machine, error: machineError } = await supabase
    .from("machines")
    .select("price_per_set")
    .eq("id", machineId)
    .single();

  if (machineError || !machine) {
    throw new Error(
      `Машины үнийн мэдээлэл авахад алдаа гарлаа: ${machineError?.message || "Машин олдсонгүй"}`,
    );
  }

  const pricePerSet = Number(machine.price_per_set) || 5000;
  const baseUrl = process.env.GPG_BASE_URL || "https://dev-api.gpaygateway.com";
  const apiKey = process.env.GPG_API_KEY;
  const secret = process.env.GPG_SIGNING_SECRET;

  if (!apiKey || !secret) {
    throw new Error("GPG тохиргоо .env.local файл дээр хийгдээгүй байна.");
  }

  const merchantOrderId = `MACHINE_${machineId}_${Date.now()}`;
  const payload = {
    merchantOrderId,
    amount: pricePerSet,
    customerId: `MACHINE_${machineId}`,
    customerName: "Машины хэрэглэгч",
    description: `Машин ${machineId}-ийн төлбөр`,
  };

  const body = JSON.stringify(payload);
  const method = "POST";
  const path = "/api/v1/terminal/invoices";

  const ts = new Date().toISOString();
  const canonical = `${method}\n${path}\n${ts}\n${body}`;

  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(canonical);

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signatureBuffer = await crypto.subtle.sign(
    "HMAC",
    cryptoKey,
    messageData,
  );
  const hashHex = Array.from(new Uint8Array(signatureBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const signature = `sha256=${hashHex}`;

  const resp = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": apiKey,
      "X-GPG-Request-Timestamp": ts,
      "X-GPG-Request-Signature": signature,
    },
    body,
  });

  if (!resp.ok) {
    const errorText = await resp.text();
    throw new Error(
      `GPG нэхэмжлэл үүсгэхэд алдаа гарлаа: ${resp.status} ${errorText}`,
    );
  }

  const responseData: GPGInvoiceResponse = await resp.json();

  if (!responseData.success || !responseData.data) {
    throw new Error("GPG API-аас буцаж ирсэн хариу буруу байна.");
  }

  return responseData.data;
}

export default async function PaymentPage({
  params,
}: {
  params: Promise<{ machineId: string }>;
}) {
  // 1. Check for maintenance mode first to bypass all DB/API calls
  if (process.env.MAINTENANCE === "1") {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden p-8 text-center">
          <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-yellow-100 mb-4">
            <svg
              className="h-8 w-8 text-yellow-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Засвар үйлчилгээ хийгдэж байна
          </h1>
          <p className="text-gray-600">
            Системд техник засвар үйлчилгээ хийгдэж байна. Түр хүлээнэ үү, бид
            удахгүй хэвийн ажиллагаанд орно.
          </p>
        </div>
      </main>
    );
  }

  const { machineId } = await params;

  let invoiceData: GPGInvoiceData | null = null;
  let error: string | null = null;

  const supabaseUrl = process.env.SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  // 2. Check if machine is online (network=true within the last 1.5 minutes / 90 seconds)
  const ONLINE_THRESHOLD = new Date(Date.now() - 90000).toISOString();

  const { data: recentCheck, error: checkError } = await supabase
    .from("status_checks")
    .select("id")
    .eq("machine", machineId)
    .gte("created_at", ONLINE_THRESHOLD)
    .limit(1)
    .maybeSingle();

  if (!recentCheck) {
    error =
      "Машин офлайн байна эсвэл сүлжээний холболтгүй байна. QR код үүсгэх боломжгүй.";
  } else {
    // 3. Machine is verified online, proceed to get GPG Invoice
    try {
      invoiceData = await getGPGInvoice(machineId);
    } catch (err) {
      error =
        err instanceof Error
          ? err.message
          : "Төлбөрийн сонголтуудыг ачаалах үед тодорхойгүй алдаа гарлаа.";
    }
  }

  const qrImageSrc = invoiceData?.qr_image
    ? invoiceData.qr_image.startsWith("data:")
      ? invoiceData.qr_image
      : `data:image/png;base64,${invoiceData.qr_image}`
    : null;

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden">
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
              {/* Server-side Polling Listener */}
              <PaymentStatusListener
                merchantOrderId={invoiceData.merchantOrderId}
              />

              {/* QR Code Display: Hidden on mobile, visible on tablet (md) and desktop (lg) */}
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

              {/* Bank Deep Links: Visible on mobile and tablet, hidden on desktop (lg) */}
              {invoiceData.urls && invoiceData.urls.length > 0 && (
                <div className="block lg:hidden space-y-3">
                  <p className="text-gray-600 text-center text-sm font-medium md:block hidden">
                    Эсвэл банкны апп-аа сонгоно уу:
                  </p>
                  {/* Compact Grid Layout */}
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

              {/* Card Payment Fallback */}
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
      </div>
    </main>
  );
}
