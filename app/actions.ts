"use server";

import { createClient } from "@supabase/supabase-js";

export async function submitFeedback(formData: FormData) {
  try {
    const machineId = formData.get("machineId") as string;
    const title = formData.get("title") as string;
    const description = formData.get("description") as string;
    const email = formData.get("email") as string;
    const phone = formData.get("phone") as string;
    const photos = formData.getAll("photos") as File[];

    if (!title || !description) {
      return {
        success: false,
        message: "Сэдэв болон дэлгэрэнгүй мэдээлэл заавал шаардлагатай.",
      };
    }

    const supabaseUrl = process.env.SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const parsedMachineId = machineId ? parseInt(machineId, 10) : null;
    const validMachineId =
      parsedMachineId && !isNaN(parsedMachineId) ? parsedMachineId : null;

    const photoUrls: string[] = [];

    // Upload photos to Supabase Storage
    if (photos && photos.length > 0) {
      for (const file of photos) {
        if (file.size > 0) {
          const fileExt = file.name.split(".").pop() || "jpg";
          const fileName = `${validMachineId || "unknown"}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${fileExt}`;
          const filePath = `feedback/${fileName}`;

          const { error: uploadError } = await supabase.storage
            .from("feedback-photos") // ⚠️ Make sure to create this bucket in Supabase Dashboard
            .upload(filePath, file, {
              cacheControl: "3600",
              upsert: false,
            });

          if (uploadError) {
            console.error("Upload error:", uploadError);
            return {
              success: false,
              message: "Зураг хуулах үед алдаа гарлаа.",
            };
          }

          const {
            data: { publicUrl },
          } = supabase.storage.from("feedback-photos").getPublicUrl(filePath);

          photoUrls.push(publicUrl);
        }
      }
    }

    const { error: dbError } = await supabase.from("feedback").insert({
      machine_id: validMachineId,
      title,
      description,
      email: email || null,
      phone: phone || null,
      status: "pending",
      photos: photoUrls.length > 0 ? photoUrls : null,
    });

    if (dbError) {
      console.error("DB error:", dbError);
      return { success: false, message: "Санал хүсэлт илгээхэд алдаа гарлаа." };
    }

    return { success: true, message: "Амжилттай" };
  } catch (err) {
    console.error("Submission error:", err);
    return { success: false, message: "Гэнэтийн алдаа гарлаа." };
  }
}
