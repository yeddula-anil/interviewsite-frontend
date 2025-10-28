// utils/uploadToCloudinary.js
import axios from "axios";

export async function uploadToCloudinary(file) {
  if (!file) throw new Error("No file selected");

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET);

  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;

  try {
    const response = await axios.post(
      `https://api.cloudinary.com/v1_1/${cloudName}/upload`,
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      }
    );

    return response.data.secure_url; // ✅ Public URL
  } catch (error) {
    console.error("Cloudinary upload error:", error);
    throw error;
  }
}
