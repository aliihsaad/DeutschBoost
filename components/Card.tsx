
import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  glass?: boolean;
  onClick?: () => void;
}

const Card: React.FC<CardProps> = ({ children, className = '', hover = false, glass = false, onClick }) => {
  const baseClasses = glass
    ? 'bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl border border-white/20 dark:border-gray-700/30'
    : 'bg-white dark:bg-gray-800';

  const hoverClasses = hover
    ? 'transition-all duration-300 hover:shadow-2xl hover:-translate-y-1'
    : '';

  return (
    <div
      className={`${baseClasses} rounded-2xl shadow-lg dark:shadow-gray-900/30 p-6 ${hoverClasses} ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  );
};

export default Card;
