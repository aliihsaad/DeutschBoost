import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Page } from '../types';
import { useAuth } from '../src/contexts/AuthContext';
import toast from 'react-hot-toast';

interface HeaderProps {
  currentPage: Page;
  setPage: (page: Page) => void;
}

const NavItem: React.FC<{
  to: string;
  icon: string;
  isActive: boolean;
  children: React.ReactNode;
  onClick?: () => void;
}> = ({ to, icon, isActive, children, onClick }) => (
  <Link
    to={to}
    onClick={onClick}
    className={`flex items-center space-x-3 px-4 py-2.5 rounded-xl transition-all duration-200 font-medium ${
      isActive
        ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/50'
        : 'text-gray-700 hover:bg-blue-50 hover:text-blue-600'
    }`}
  >
    <i className={`fa-solid ${icon} text-lg`}></i>
    <span>{children}</span>
  </Link>
);

const Header: React.FC<HeaderProps> = ({ currentPage, setPage }) => {
  const { signOut, userData } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleSignOut = async () => {
    const { error } = await signOut();
    if (error) {
      toast.error('Failed to sign out');
    } else {
      toast.success('Signed out successfully');
      navigate('/login');
    }
  };

  const isActive = (path: string) => location.pathname === path;
  const closeMobileMenu = () => setMobileMenuOpen(false);

  return (
    <header className="bg-white/80 backdrop-blur-xl border-b border-gray-200/50 sticky top-0 z-50 shadow-sm">
      <div className="container mx-auto px-4 py-3">
        <div className="flex justify-between items-center">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-3 group">
            <div className="relative">
              <img
                src="https://em-content.zobj.net/source/apple/354/flag-germany_1f1e9-1f1ea.png"
                alt="German Flag"
                className="h-10 w-10 transition-transform duration-300 group-hover:scale-110"
              />
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                DeutschBoost
              </h1>
              <p className="text-xs text-gray-500 font-medium">Learn German Smarter</p>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center space-x-2">
            <NavItem to="/" icon="fa-house" isActive={isActive('/')}>
              Home
            </NavItem>
            <NavItem to="/placement-test" icon="fa-clipboard-question" isActive={isActive('/placement-test')}>
              Test
            </NavItem>
            <NavItem to="/learning-plan" icon="fa-map-signs" isActive={isActive('/learning-plan')}>
              Plan
            </NavItem>
            <NavItem to="/practice" icon="fa-dumbbell" isActive={isActive('/practice')}>
              Practice
            </NavItem>
            <NavItem to="/conversation" icon="fa-microphone-alt" isActive={isActive('/conversation')}>
              Speak
            </NavItem>
            <NavItem to="/profile" icon="fa-user-gear" isActive={isActive('/profile')}>
              Profile
            </NavItem>
            <button
              onClick={handleSignOut}
              className="flex items-center space-x-2 px-4 py-2.5 rounded-xl transition-all duration-200 font-medium text-red-600 hover:bg-red-50 border-2 border-red-200 hover:border-red-300"
              title="Sign Out"
            >
              <i className="fa-solid fa-right-from-bracket"></i>
              <span>Logout</span>
            </button>
          </nav>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2 rounded-xl hover:bg-gray-100 transition-colors"
            aria-label="Toggle menu"
          >
            <i className={`fa-solid ${mobileMenuOpen ? 'fa-times' : 'fa-bars'} text-2xl text-gray-700`}></i>
          </button>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <nav className="lg:hidden mt-4 pb-4 space-y-2 animate-fade-in">
            <NavItem to="/" icon="fa-house" isActive={isActive('/')} onClick={closeMobileMenu}>
              Home
            </NavItem>
            <NavItem to="/placement-test" icon="fa-clipboard-question" isActive={isActive('/placement-test')} onClick={closeMobileMenu}>
              Test
            </NavItem>
            <NavItem to="/learning-plan" icon="fa-map-signs" isActive={isActive('/learning-plan')} onClick={closeMobileMenu}>
              Plan
            </NavItem>
            <NavItem to="/practice" icon="fa-dumbbell" isActive={isActive('/practice')} onClick={closeMobileMenu}>
              Practice
            </NavItem>
            <NavItem to="/conversation" icon="fa-microphone-alt" isActive={isActive('/conversation')} onClick={closeMobileMenu}>
              Speak
            </NavItem>
            <NavItem to="/profile" icon="fa-user-gear" isActive={isActive('/profile')} onClick={closeMobileMenu}>
              Profile
            </NavItem>
            <button
              onClick={() => {
                handleSignOut();
                closeMobileMenu();
              }}
              className="w-full flex items-center space-x-3 px-4 py-2.5 rounded-xl transition-all duration-200 font-medium text-red-600 hover:bg-red-50 border-2 border-red-200"
            >
              <i className="fa-solid fa-right-from-bracket text-lg"></i>
              <span>Logout</span>
            </button>
          </nav>
        )}
      </div>
    </header>
  );
};

export default Header;