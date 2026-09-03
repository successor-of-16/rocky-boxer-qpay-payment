import Image from "next/image";
import { createClient } from "@supabase/supabase-js";

// Type definitions matching the GPG API response envelope
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

/**
 * Server-side function to create a GPG invoice using HMAC-SHA256 signing
 */
async function getGPGInvoice(machineId: string): Promise<GPGInvoiceData> {
  const supabaseUrl = process.env.SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  // 1. Get machine's price_per_set from the database
  const { data: machine, error: machineError } = await supabase
    .from("machines")
    .select("price_per_set")
    .eq("id", machineId)
    .single();

  if (machineError || !machine) {
    throw new Error(
      `Failed to fetch machine price: ${machineError?.message || "Machine not found"}`,
    );
  }

  const pricePerSet = Number(machine.price_per_set) || 5000;
  const baseUrl = process.env.GPG_BASE_URL || "https://dev-api.gpaygateway.com";
  const apiKey = process.env.GPG_API_KEY;
  const secret = process.env.GPG_SIGNING_SECRET;
  //   const callbackUrl =
  //     process.env.GPG_CALLBACK_URL || "https://yoursite.com/api/gpg/callback";

  if (!apiKey || !secret) {
    throw new Error("GPG credentials are not configured in .env.local");
  }

  // 2. Prepare payload
  const merchantOrderId = `MACHINE_${machineId}_${Date.now()}`;
  const payload = {
    merchantOrderId,
    amount: pricePerSet,
    customerId: `MACHINE_${machineId}`,
    customerName: "Machine User",
    description: `Payment for machine ${machineId}`,
    // callbackUrl,
  };

  const body = JSON.stringify(payload);
  const method = "POST";
  const path = "/api/v1/terminal/invoices";

  // 3. Generate HMAC-SHA256 Signature
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

  // 4. Execute Request
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
      `Failed to create GPG invoice: ${resp.status} ${errorText}`,
    );
  }

  const responseData: GPGInvoiceResponse = await resp.json();

  if (!responseData.success || !responseData.data) {
    throw new Error("Invalid response format from GPG API");
  }

  return responseData.data;
}

/**
 * Next.js Server Component
 */
export default async function PaymentPage({
  params,
}: {
  params: Promise<{ machineId: string }>;
}) {
  const { machineId } = await params;

  let invoiceData: GPGInvoiceData | null = null;
  let error: string | null = null;

  try {
    invoiceData = await getGPGInvoice(machineId);
  } catch (err) {
    error =
      err instanceof Error
        ? err.message
        : "An unknown error occurred while fetching payment options.";
  }

  // Helper to ensure base64 image has correct prefix for Next.js Image component
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
          <h1 className="text-2xl font-bold text-white">Machine Payment</h1>
          <p className="text-blue-100 mt-1">
            Machine ID:{" "}
            <span className="font-mono font-semibold">{machineId}</span>
          </p>
          {invoiceData && (
            <p className="text-blue-100 text-sm mt-1">
              Amount:{" "}
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
              <p className="font-semibold">Configuration Error</p>
              <p className="text-sm mt-1">{error}</p>
            </div>
          ) : !invoiceData ? (
            <p className="text-gray-500 text-center">
              Loading payment options...
            </p>
          ) : (
            <div className="space-y-6">
              {/* QR Code Display */}
              {qrImageSrc && (
                <div className="flex flex-col items-center space-y-2">
                  <p className="text-gray-600 text-sm font-medium">
                    Scan QR Code to Pay
                  </p>
                  <Image
                    src={qrImageSrc}
                    alt="Payment QR Code"
                    width={220}
                    height={220}
                    className="rounded-lg border border-gray-200 p-2 bg-white"
                    unoptimized
                  />
                </div>
              )}

              {/* Bank Deep Links */}
              {invoiceData.urls && invoiceData.urls.length > 0 && (
                <div className="space-y-3">
                  <p className="text-gray-600 text-center text-sm font-medium">
                    Or select a banking app:
                  </p>
                  <ul className="space-y-3">
                    {invoiceData.urls.map((bank, index) => (
                      <li key={index}>
                        <a
                          href={bank.link}
                          className="flex items-center p-3 border border-gray-200 rounded-xl hover:bg-blue-50 hover:border-blue-300 transition-all duration-200 group"
                        >
                          <div className="flex-1">
                            <p className="font-semibold text-gray-800 group-hover:text-blue-700">
                              {bank.name}
                            </p>
                            <p className="text-xs text-gray-500">
                              Code: {bank.code}
                            </p>
                          </div>
                          <svg
                            className="w-5 h-5 text-gray-400 group-hover:text-blue-500"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9 5l7 7-7 7"
                            />
                          </svg>
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Card Payment Fallback */}
              {invoiceData.cardPayment && invoiceData.cardPaymentUrl && (
                <a
                  href={invoiceData.cardPaymentUrl}
                  className="block w-full bg-gray-900 hover:bg-gray-800 text-white font-semibold py-3 px-4 rounded-xl transition-colors duration-200 text-center"
                >
                  Pay with Card
                </a>
              )}

              <p className="text-xs text-gray-400 text-center mt-4">
                Order Reference: {invoiceData.merchantOrderId}
              </p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
