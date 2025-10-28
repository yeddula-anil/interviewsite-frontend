  // src/app/(recruiter)/layout.js

  'use client'; 

  import { Sidebar } from '@/components/candidate/Sidebar';
  // import { TopBar } from '@/components/layouts/TopBar';

  export default function RecruiterLayout({ children }) {
    return (
      <div className="flex h-screen bg-gray-100">
        
        {/* 1. Sidebar Component (Mini-bar on the left, expands on hover) */}
        <Sidebar />

        <div className="flex flex-col flex-1 overflow-hidden">
          
          {/* 2. Top Bar Component */}
          

          {/* 3. Main Content Area */}
          <main 
            className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-100 p-0 md:p-0"
          >
            {children}
          </main>
        </div>
      </div>
    );
  }