"use client";

import { useState, useRef } from "react";

// --- Reverted to Normal Image Compression Settings ---
async function compressImage(
  file: File,
  maxWidthOrHeight = 1024,
  quality = 0.7,
): Promise<File> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidthOrHeight) {
            height = Math.round((height * maxWidthOrHeight) / width);
            width = maxWidthOrHeight;
          }
        } else {
          if (height > maxWidthOrHeight) {
            width = Math.round((width * maxWidthOrHeight) / height);
            height = maxWidthOrHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas context not found"));
          return;
        }

        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error("Canvas toBlob failed"));
              return;
            }
            const compressedFile = new File(
              [blob],
              file.name.replace(/\.[^/.]+$/, "") + ".jpg",
              { type: "image/jpeg", lastModified: Date.now() },
            );
            resolve(compressedFile);
          },
          "image/jpeg",
          quality,
        );
      };
      img.onerror = reject;
    };
    reader.onerror = reject;
  });
}

interface FeedbackFormProps {
  machineId: string;
  onBack: () => void;
  submitAction: (
    formData: FormData,
  ) => Promise<{ success: boolean; message: string }>;
}

export default function FeedbackForm({
  machineId,
  onBack,
  submitAction,
}: FeedbackFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);

      const processedFiles = await Promise.all(
        newFiles.map(async (file) => {
          try {
            if (file.size < 500 * 1024) return file;
            return await compressImage(file);
          } catch (err) {
            console.error("Image compression failed:", err);
            return file;
          }
        }),
      );

      setSelectedFiles((prev) => [...prev, ...processedFiles]);
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);
    setStatus(null);

    const form = e.currentTarget;
    const formData = new FormData(form);

    // FIX: Remove the raw uncompressed files automatically grabbed from the <input type="file">
    formData.delete("photos");

    // Now append only the compressed files from our React state
    selectedFiles.forEach((file) => {
      formData.append("photos", file);
    });

    try {
      const result = await submitAction(formData);
      if (result.success) {
        setStatus({
          type: "success",
          message: "Санал хүсэлт амжилттай илгээгдлээ. Баярлалаа!",
        });
        setTimeout(() => onBack(), 2000);
      } else {
        setStatus({ type: "error", message: result.message });
      }
    } catch (err) {
      setStatus({ type: "error", message: "Сүлжээний алдаа гарлаа." });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="w-full flex flex-col h-full">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-2 text-gray-600 hover:text-blue-600 mb-6 transition-colors w-fit"
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
            d="M15 19l-7-7 7-7"
          />
        </svg>
        <span className="font-medium">Буцах</span>
      </button>

      <h2 className="text-xl font-bold text-gray-900 mb-6">
        Санал, хүсэлт илгээх
      </h2>

      <form onSubmit={handleSubmit} className="space-y-5 flex-1">
        <input type="hidden" name="machineId" value={machineId} />

        <div>
          <label
            htmlFor="title"
            className="block text-sm font-medium text-gray-800 mb-1.5"
          >
            Сэдэв <span className="text-red-500">*</span>
          </label>
          <select
            id="title"
            name="title"
            required
            defaultValue=""
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm bg-white text-gray-900"
          >
            <option value="" disabled>
              Сэдвийг сонгоно уу
            </option>
            <option value="refund">Мөнгө буцаах хүсэлт</option>
            <option value="problem">Асуудал мэдээлэх</option>
            <option value="suggestion">Санал хүсэлт</option>
          </select>
        </div>

        <div>
          <label
            htmlFor="description"
            className="block text-sm font-medium text-gray-800 mb-1.5"
          >
            Дэлгэрэнгүй тайлбар <span className="text-red-500">*</span>
          </label>
          <textarea
            id="description"
            name="description"
            required
            rows={4}
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all resize-none text-sm bg-white text-gray-900 placeholder:text-gray-400"
            placeholder="Асуудлын талаар дэлгэрэнгүй бичнэ үү..."
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-800 mb-1.5"
            >
              И-мэйл (холбогдох)
            </label>
            <input
              type="email"
              id="email"
              name="email"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm bg-white text-gray-900 placeholder:text-gray-400"
              placeholder="tanii@email.com"
            />
          </div>
          <div>
            <label
              htmlFor="phone"
              className="block text-sm font-medium text-gray-800 mb-1.5"
            >
              Утасны дугаар (холбогдох)
            </label>
            <input
              type="tel"
              id="phone"
              name="phone"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm bg-white text-gray-900 placeholder:text-gray-400"
              placeholder="99999999"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-800 mb-1.5">
            Зураг хавсаргах (Камераар авах)
          </label>
          <div className="flex items-center gap-3">
            <label className="cursor-pointer flex items-center gap-2 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded-lg transition-colors text-sm font-medium text-gray-700">
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
                  d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              Зураг авах / Сонгох
              <input
                ref={fileInputRef}
                type="file"
                name="photos"
                multiple
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleFileChange}
              />
            </label>
            <span className="text-xs text-gray-500">
              {selectedFiles.length > 0
                ? `${selectedFiles.length} зураг сонгогдсон`
                : "Заавал биш"}
            </span>
          </div>

          {selectedFiles.length > 0 && (
            <div className="grid grid-cols-3 gap-2 mt-3">
              {selectedFiles.map((file, index) => (
                <div key={index} className="relative group aspect-square">
                  <img
                    src={URL.createObjectURL(file)}
                    alt={`Preview ${index}`}
                    className="w-full h-full object-cover rounded-lg border border-gray-200"
                  />
                  <button
                    type="button"
                    onClick={() => removeFile(index)}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-sm hover:bg-red-600 transition-colors"
                  >
                    <svg
                      className="w-3 h-3"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={3}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {status && (
          <div
            className={`p-3 rounded-lg text-sm flex items-start gap-2 ${status.type === "success" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}
          >
            {status.type === "success" ? (
              <svg
                className="w-5 h-5 shrink-0 mt-0.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            ) : (
              <svg
                className="w-5 h-5 shrink-0 mt-0.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            )}
            <span>{status.message}</span>
          </div>
        )}

        <div className="pt-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-xl transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <svg
                  className="animate-spin h-5 w-5 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Илгээж байна...
              </>
            ) : (
              "Илгээх"
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
