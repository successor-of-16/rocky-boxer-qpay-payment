import { createClient } from "@supabase/supabase-js";
import PaymentView from "./PaymentView"; // Adjust path if needed

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

interface GPGInvoiceResponse {
  success: boolean;
  data: GPGInvoiceData;
}

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

  const ONLINE_THRESHOLD = new Date(Date.now() - 90000).toISOString();

  const { data: recentCheck } = await supabase
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
        <PaymentView
          machineId={machineId}
          invoiceData={invoiceData}
          error={error}
          qrImageSrc={qrImageSrc}
        />
      </div>
    </main>
  );
}
