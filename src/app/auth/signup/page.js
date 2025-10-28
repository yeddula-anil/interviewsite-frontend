'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthProvider';
import { Button } from '@/components/common/Button';
import toast from 'react-hot-toast';

export default function SignupPage() {
  const router = useRouter();
  const { signup } = useAuth(); // use context
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    role: '',
    password: '',
  });
  const [loading, setLoading] = useState(false);

  const roles = ['CANDIDATE', 'RECRUITER'];

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { success, user, message } = await signup(
        formData.username,
        formData.email,
        formData.password,
        formData.role
      );

      if (success) {
        toast.success('Signup successful!');

        // Redirect based on role
        switch (user.role) {
          case 'CANDIDATE':
            router.push('/candidate/');
            break;
          case 'RECRUITER':
            router.push('/recruiter');
            break;
          default:
            router.push('/');
        }
      } else {
        toast.error(message);
      }
    } catch (err) {
      console.error(err);
      toast.error('Signup failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="bg-white shadow-md rounded-2xl p-8 w-full max-w-md border border-gray-200">
        <h2 className="text-3xl font-bold text-center text-gray-800 mb-8">
          Create Account
        </h2>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Username */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Username
            </label>
            <input
              type="text"
              name="username"
              value={formData.username}
              onChange={handleChange}
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              placeholder="Enter your username"
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Email
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              placeholder="Enter your email"
            />
          </div>

          {/* Role */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Role
            </label>
            <select
              name="role"
              value={formData.role}
              onChange={handleChange}
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-800 bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
            >
              <option value="">Select Role</option>
              {roles.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Password
            </label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              placeholder="Enter your password"
            />
          </div>

          {/* Submit */}
          <Button
            type="submit"
            disabled={loading}
            className="w-full text-white font-semibold py-2 rounded-lg transition"
          >
            {loading ? 'Signing up...' : 'Sign Up'}
          </Button>
        </form>

        <p className="text-sm text-center mt-6 text-gray-600">
          Already have an account?{' '}
          <span
            onClick={() => router.push('/auth/signin')}
            className="text-indigo-600 cursor-pointer hover:underline font-medium"
          >
            Login
          </span>
        </p>
      </div>
    </div>
  );
}
