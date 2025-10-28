// src/components/common/Button.js

import React from 'react';

export const Button = ({ 
  children, 
  intent = 'primary', 
  size = 'medium', 
  className = '', 
  ...props 
}) => {
  
  const baseStyles = 'rounded-lg font-semibold transition duration-150 ease-in-out';
  
  // Defines the color scheme for the button intents
  const intentStyles = {
    // Primary CTA (e.g., "Start Free Trial", "Get Started")
    primary: 'bg-teal-600 text-white hover:bg-teal-700 focus:ring-4 focus:ring-teal-500 focus:ring-opacity-50',
    // Secondary CTA (e.g., "GO" button, "View Feedback")
    secondary: 'bg-gray-200 text-gray-800 hover:bg-gray-300 focus:ring-4 focus:ring-gray-400 focus:ring-opacity-50',
    // Accent CTA (e.g., "+ Schedule New" button in the sidebar)
    accent: 'bg-teal-500 text-white hover:bg-teal-600 focus:ring-4 focus:ring-teal-400 focus:ring-opacity-50', 
  };
  
  // Defines the size and padding
  const sizeStyles = {
    small: 'px-3 py-1 text-sm',
    medium: 'px-4 py-2 text-base',
    large: 'px-6 py-3 text-lg',
    xlarge: 'px-8 py-4 text-xl',
  };

  return (
    <button
      className={`${baseStyles} ${intentStyles[intent]} ${sizeStyles[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};