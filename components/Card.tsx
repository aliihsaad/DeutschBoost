
import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  glass?: boolean;
}

const Card: React.FC<CardProps> = ({ children, className = '', hover = false, glass = false }) => {
  const baseClasses = glass
    ? 'bg-white/80 backdrop-blur-xl border border-white/20'
    : 'bg-white';

  const hoverClasses = hover
    ? 'transition-all duration-300 hover:shadow-2xl hover:-translate-y-1'
    : '';

  return (
    <div className={`${baseClasses} rounded-2xl shadow-lg p-6 ${hoverClasses} ${className}`}>
      {children}
    </div>
  );
};

export default Card;
