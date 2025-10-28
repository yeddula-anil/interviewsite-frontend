'use client';
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/common/Button";
import { useAuth } from "@/context/AuthProvider";
import toast from "react-hot-toast";

export default function SignIn() {
  const router = useRouter();
  const { login } = useAuth();
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const { email, password } = formData;

    try {
      const res = await login(email, password);

      if (res.success) {
        toast.success("Logged in successfully!");

        // Redirect based on role
        if (res.user?.role === "CANDIDATE") router.push("/candidate");
        else if (res.user?.role === "RECRUITER") router.push("/recruiter");
        else router.push("/");

      } else {
        toast.error(res.message || "Login failed");
      }
    } catch (err) {
      console.error("Login error:", err);
      toast.error("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md bg-white shadow-lg rounded-2xl p-8 border border-gray-200">
        <h2 className="text-3xl font-semibold text-center text-gray-800 mb-6">
          Sign In
        </h2>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Email Field */}
          <div>
            <label className="block text-sm text-gray-600 mb-1">Email</label>
            <input
              type="email"
              name="email"
              placeholder="Enter your email"
              value={formData.email}
              onChange={handleChange}
              required
              className="w-full px-4 py-3 rounded-xl border border-gray-300 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Password Field */}
          <div>
            <label className="block text-sm text-gray-600 mb-1">Password</label>
            <input
              type="password"
              name="password"
              placeholder="Enter your password"
              value={formData.password}
              onChange={handleChange}
              required
              className="w-full px-4 py-3 rounded-xl border border-gray-300 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Sign In Button */}
          <Button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-3 font-medium transition-all"
            disabled={loading}
          >
            {loading ? "Signing In..." : "Sign In"}
          </Button>

          {/* Sign Up Redirect */}
          <p className="text-center text-gray-500 text-sm mt-3">
            Don’t have an account?{" "}
            <button
              type="button"
              onClick={() => router.push("/auth/signup")}
              className="text-blue-600 hover:underline"
            >
              Sign Up
            </button>
          </p>
        </form>
      </div>
    </div>
  );
}
