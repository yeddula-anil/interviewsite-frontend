// src/app/(recruiter)/dashboard/page.js

import { Button } from '@/components/common/Button';
import Link from 'next/link';
import StatsOverviewCard from '@/components/dashboard/StatsOverviewCard'; // Import the stats component

// --- DUMMY DATA ---
// Replace this with actual API data fetching in a production app
const UpcomingInterviews = [
  { candidate: 'Jane Doe', role: 'Software Engineer', time: 'Today, 1:00 PM', actions: ['Join'] },
  { candidate: 'John Smith', role: 'UX Designer', time: 'Tomorrow, 10:30 AM', actions: ['Join', 'Edit'] },
  { candidate: 'Priya Verma', role: 'Data Scientist', time: 'Friday, 3:00 PM', actions: ['Edit', 'Cancel'] },
];

const RecentActivity = [
  { type: 'Review Required', candidate: 'Sarah Lee', role: 'Data Scientist', action: 'Submit Scorecard' },
  { type: 'Review Out', candidate: 'Mark Chen', role: 'DevOps Engineer', action: 'Watch Recording' },
  { type: 'Feedback Submitted', candidate: 'Alex Rio', role: 'Backend Engineer', action: 'Review Final Score' },
];
// --- END DUMMY DATA ---


export default function StatsOverviewCard() {
  return (
    <div className="space-y-8">
      
      <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
      
      {/* 1. KPI Stats Row (Integrated from StatsOverviewCard) */}
      <StatsOverviewCard />
      
      {/* 2. Main Content Area - Split into two columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Column 1 (2/3 width): Upcoming Interviews Table */}
        <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-md">
          <div className="flex justify-between items-center mb-4">
             <h2 className="text-xl font-semibold text-gray-800">Upcoming Interviews</h2>
             <Link href="/schedule">
                 <span className="text-sm text-teal-600 hover:underline">View Calendar →</span>
             </Link>
          </div>
          
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr className="text-left text-sm font-medium text-gray-500 uppercase tracking-wider">
                <th className="py-3">Candidate</th>
                <th className="py-3">Role</th>
                <th className="py-3">Time</th>
                <th className="py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200 text-sm">
              {UpcomingInterviews.map((item, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="py-3 font-semibold text-gray-900">{item.candidate}</td>
                  <td className="py-3 text-gray-600">{item.role}</td>
                  <td className="py-3 text-teal-600">{item.time}</td>
                  <td className="py-3 text-right space-x-3">
                    {item.actions.includes('Join') && (
                        <Link href={`/candidate/${item.candidate.toLowerCase().replace(' ', '-')}`}>
                            <Button intent="primary" size="small">Join</Button>
                        </Link>
                    )}
                    {item.actions.includes('Edit') && <Link href="#" className="text-gray-500 hover:text-gray-800 text-sm">Edit</Link>}
                    {item.actions.includes('Cancel') && <Link href="#" className="text-red-500 hover:text-red-700 text-sm">Cancel</Link>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Column 2 (1/3 width): Recent Activity & Feedback */}
        <div className="lg:col-span-1 bg-white p-6 rounded-xl shadow-md space-y-4">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Recent Activity & Feedback</h2>
          {RecentActivity.map((item, index) => (
            <div key={index} className="border-b pb-4 last:border-b-0 last:pb-0">
              <p className="text-xs font-semibold uppercase text-teal-600 mb-1">{item.type}</p>
              <p className="text-sm font-medium text-gray-900">Candidate: {item.candidate}</p>
              <p className="text-sm text-gray-600">Role: {item.role}</p>
              
              <div className="mt-2">
                <Button intent="secondary" size="small" className="text-xs">
                    {item.action}
                </Button>
              </div>
            </div>
          ))}
          <div className="pt-2 text-center">
             <Link href="/review">
                 <span className="text-sm text-teal-600 hover:underline">View All Activity →</span>
             </Link>
          </div>
        </div>
      </div>
    </div>
  );
}