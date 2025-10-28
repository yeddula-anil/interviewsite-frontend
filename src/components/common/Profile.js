'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/common/Button';
import { PencilIcon } from '@heroicons/react/24/outline';
import toast, { Toaster } from 'react-hot-toast';
import { useAuth } from '@/context/AuthProvider';
import { uploadToCloudinary } from '@/utils/uploadToCloudinary';

import axiosInstance from '@/utils/axiosInstance';

const UserProfileUpdate = () => {
  const { user } = useAuth(); // ✅ get user from context

  const [newUsername, setNewUsername] = useState(user?.username || '');
  const [newProfilePic, setNewProfilePic] = useState(user?.profilePicUrl || '');
  const [newBanner, setNewBanner] = useState(user?.bannerUrl || '');
  const [loading, setLoading] = useState(false);
  console.log("user data",user)

  useEffect(() => {
    // Update state if authUser changes
    setNewUsername(user?.username || '');
    setNewProfilePic(user?.profilePicUrl || '');
    setNewBanner(user?.bannerUrl || '');
  }, [user]);

  // Handle file uploads
  const handleFileChange = async (e, type) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      toast.loading('Uploading...');
      const url = await uploadToCloudinary(file);
      toast.dismiss();
      toast.success('Upload successful!');

      if (type === 'profile') setNewProfilePic(url);
      if (type === 'banner') setNewBanner(url);
    } catch (err) {
      toast.dismiss();
      toast.error('Upload failed');
      console.error(err);
    }
  };

  // Update profile on backend
  const handleProfileUpdate = async () => {
    try {
      setLoading(true);
      const payload = {
        username: newUsername,
        profilePicUrl: newProfilePic,
        bannerUrl: newBanner,
      };

      await axiosInstance.put(`/user/update/${user.id}`, payload);
      toast.success('✅ Profile updated successfully!');
    } catch (err) {
      console.error(err);
      toast.error('Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return <div className="p-8 text-center">Loading user data...</div>;
  }

  return (
    <div className="p-8 bg-gray-100 min-h-screen flex justify-center">
      <Toaster position="top-right" />
      <div className="bg-white shadow-lg rounded-xl w-full max-w-2xl overflow-hidden border border-gray-300">
        {/* Banner */}
        <div className="relative h-44 border-b border-gray-200">
          <img
            src={newBanner || 'https://via.placeholder.com/800x200?text=Banner'}
            alt="Banner"
            className="w-full h-full object-cover rounded-t-xl border-b-4 border-white shadow-inner"
          />
          <label className="absolute top-2 right-2 bg-white border border-gray-300 p-1.5 rounded-full cursor-pointer hover:bg-gray-100 transition">
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleFileChange(e, 'banner')}
            />
            <PencilIcon className="w-5 h-5 text-gray-700" />
          </label>

          {/* Profile Picture */}
          <div className="absolute -bottom-16 left-1/2 transform -translate-x-1/2">
            <div className="relative w-32 h-32">
              {newProfilePic ? (
                <img
                  src={newProfilePic}
                  alt="Profile"
                  className="w-32 h-32 rounded-full border-4 border-white shadow-md object-cover bg-white"
                />
              ) : (
                <div className="w-32 h-32 rounded-full border-4 border-white shadow-md flex items-center justify-center bg-gray-400 text-white text-4xl font-bold">
                  {newUsername?.charAt(0).toUpperCase() || 'C'}
                </div>
              )}
              <label className="absolute bottom-0 right-0 bg-white border border-gray-300 p-1.5 rounded-full cursor-pointer hover:bg-gray-100 transition">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleFileChange(e, 'profile')}
                />
                <PencilIcon className="w-4 h-4 text-gray-700" />
              </label>
            </div>
          </div>
        </div>

        {/* Profile Info */}
        <div className="p-6 mt-20">
          <div className="mb-4">
            <label className="block text-gray-700 font-medium mb-1">Username</label>
            <input
              type="text"
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              className="w-full border border-gray-300 px-3 py-2 rounded-md focus:ring-2 focus:ring-blue-500 outline-none text-gray-800"
            />
          </div>

          <div className="mb-4">
            <label className="block text-gray-700 font-medium mb-1">Email</label>
            <input
              type="text"
              value={user.email}
              disabled
              className="w-full border border-gray-300 px-3 py-2 rounded-md bg-gray-100 text-gray-600 cursor-not-allowed"
            />
          </div>

          <div className="mb-4">
            <label className="block text-gray-700 font-medium mb-1">Role</label>
            <input
              type="text"
              value={user.role}
              disabled
              className="w-full border border-gray-300 px-3 py-2 rounded-md bg-gray-100 text-gray-600 cursor-not-allowed"
            />
          </div>

          <Button
            size="medium"
            intent="primary"
            onClick={handleProfileUpdate}
            className="w-full"
            disabled={loading}
          >
            {loading ? 'Updating...' : 'Update Profile'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default UserProfileUpdate;
