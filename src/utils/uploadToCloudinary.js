import axios from "axios";

export async function uploadToCloudinary(file) {
  if (!file) throw new Error("No file selected");

  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const preset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

  if (!cloudName || !preset) {
    throw new Error("Cloudinary cloud name or preset missing. Check .env");
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", preset);

  // Detect PDF/doc upload → use /raw upload
  const ext = file.name.toLowerCase();
  const isRaw =
    ext.endsWith(".pdf") ||
    ext.endsWith(".doc") ||
    ext.endsWith(".docx") ||
    file.type === "application/pdf";

  const endpoint = isRaw ? "raw/upload" : "upload";

  try {
    const response = await axios.post(
      `https://api.cloudinary.com/v1_1/${cloudName}/${endpoint}`,
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      }
    );

    return response.data.secure_url;
  } catch (err) {
    console.error("Cloudinary upload error:", err.response?.data || err);
    throw err;
  }
}
