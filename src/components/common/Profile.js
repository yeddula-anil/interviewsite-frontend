"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/common/Button";
import { PencilIcon } from "@heroicons/react/24/outline";
import toast, { Toaster } from "react-hot-toast";
import { useAuth } from "@/context/AuthProvider";
import { uploadToCloudinary } from "@/utils/uploadToCloudinary";
import axiosInstance from "@/utils/axiosInstance";

const UserProfileUpdate = () => {
  const { user, checkAuth } = useAuth();

  const [newUsername, setNewUsername] = useState(user?.username || "");
  const [newProfilePic, setNewProfilePic] = useState(user?.profilePicUrl || "");
  const [newBanner, setNewBanner] = useState(user?.bannerUrl || "");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setNewUsername(user?.username || "");
    setNewProfilePic(user?.profilePicUrl || "");
    setNewBanner(user?.bannerUrl || "");
  }, [user]);

  const handleFileChange = async (e, type) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      toast.loading("Uploading...");
      const url = await uploadToCloudinary(file);
      toast.dismiss();
      toast.success("Upload successful!");

      if (type === "profile") setNewProfilePic(url);
      if (type === "banner") setNewBanner(url);
    } catch (err) {
      toast.dismiss();
      toast.error("Upload failed");
      console.error(err);
    }
  };

  const handleProfileUpdate = async () => {
    try {
      setLoading(true);
      const payload = {
        username: newUsername,
        profilePicUrl: newProfilePic,
        bannerUrl: newBanner,
      };

      await axiosInstance.put(`/user/update/${user.id}`, payload);
      if (checkAuth) await checkAuth();
      toast.success("Profile updated successfully!");
    } catch (err) {
      toast.error("Failed to update profile");
    } finally {
      setLoading(false);
    }
  };

  /** LOADING SCREEN (MATCHING THEME) **/
  if (!user) {
    return (
      <div
        className="w-full h-screen flex justify-center items-center text-[#38f2b9] text-xl font-semibold"
        style={{
          background:
            "linear-gradient(180deg, #031719 0%, #041214 60%, #02090A 100%)",
        }}
      >
        Loading user data...
      </div>
    );
  }

  return (
    <div
      className="min-h-screen w-full flex justify-center items-center px-6"
      style={{
        background:
          "linear-gradient(180deg, #031719 0%, #041214 60%, #02090A 100%)",
      }}
    >
      <Toaster position="top-right" />

      <div className="w-full max-w-3xl bg-[#041e1e] border border-[#0e3a35] shadow-[0_0_40px_#072a2a80] rounded-2xl overflow-hidden backdrop-blur-xl">

        {/* ---------- BANNER SECTION ---------- */}
        <div className="relative h-52 group">
          <img
            src={
              newBanner ||
              "https://via.placeholder.com/800x200?text=Profile+Banner"
            }
            className="w-full h-full object-cover opacity-95"
          />

          {/* Edit Banner Button */}
          <label className="absolute top-4 right-4 bg-[#00000055] p-2 rounded-full border border-[#38f2b9] cursor-pointer hover:bg-[#00000088] transition">
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleFileChange(e, "banner")}
            />
            <PencilIcon className="w-5 h-5 text-[#38f2b9]" />
          </label>

          {/* Floating Profile Image */}
          <div className="absolute -bottom-20 left-1/2 transform -translate-x-1/2">
            <div className="relative w-40 h-40 rounded-full border-4 border-[#38f2b9] shadow-[0_0_25px_#38f2b9] overflow-hidden bg-[#072525]">
              {newProfilePic ? (
                <img
                  src={newProfilePic}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-5xl font-bold text-white">
                  {newUsername?.charAt(0)?.toUpperCase() || "U"}
                </div>
              )}

              {/* Edit Profile Picture */}
              <label className="absolute bottom-2 right-2 bg-[#00000077] border border-[#38f2b9] p-2 rounded-full cursor-pointer hover:bg-[#00000099]">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleFileChange(e, "profile")}
                />
                <PencilIcon className="w-4 h-4 text-[#38f2b9]" />
              </label>
            </div>
          </div>
        </div>

        {/* ---------- FORM SECTION ---------- */}
        <div className="p-8 mt-24">
          <h2 className="text-2xl text-center font-bold text-[#38f2b9] mb-8 tracking-wide">
            Update Your Profile
          </h2>

          {/* Username */}
          <div className="mb-6">
            <label className="text-[#7dd9c8] text-sm mb-1 block">
              Username
            </label>
            <input
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              className="w-full bg-[#031f1f] border border-[#0e3a35] rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:ring-2 focus:ring-[#38f2b9] outline-none transition"
            />
          </div>

          {/* Email */}
          <div className="mb-6">
            <label className="text-[#7dd9c8] text-sm mb-1 block">
              Email
            </label>
            <input
              value={user.email}
              disabled
              className="w-full bg-[#062a28] border border-[#0e3a35] rounded-lg px-4 py-3 text-gray-400 cursor-not-allowed"
            />
          </div>

          {/* Role */}
          <div className="mb-6">
            <label className="text-[#7dd9c8] text-sm mb-1 block">Role</label>
            <input
              value={user.role}
              disabled
              className="w-full bg-[#062a28] border border-[#0e3a35] rounded-lg px-4 py-3 text-gray-400 cursor-not-allowed"
            />
          </div>

          {/* Submit Button */}
          <Button
            size="large"
            intent="primary"
            onClick={handleProfileUpdate}
            disabled={loading}
            className="w-full text-lg py-3 rounded-lg bg-[#38f2b9] text-black font-semibold hover:brightness-110 transition shadow-[0_0_20px_#38f2b977]"
          >
            {loading ? "Updating..." : "Update Profile"}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default UserProfileUpdate;
