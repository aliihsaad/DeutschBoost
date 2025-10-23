import React from 'react';

const LoadingSpinner: React.FC<{ text?: string }> = ({ text = "Loading..." }) => {
  return (
    <div className="flex flex-col items-center justify-center space-y-4">
      <div className="relative">
        {/* Outer ring */}
        <div className="animate-spin rounded-full h-16 w-16 border-4 border-gray-200"></div>
        {/* Inner spinning part */}
        <div className="absolute top-0 left-0 animate-spin rounded-full h-16 w-16 border-4 border-transparent border-t-blue-600 border-r-blue-600"></div>
      </div>
      <p className="text-gray-700 font-medium text-lg animate-pulse">{text}</p>
    </div>
  );
};

export default LoadingSpinner;
