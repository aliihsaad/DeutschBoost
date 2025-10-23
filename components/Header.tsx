import React from 'react';
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
}> = ({ to, icon, isActive, children }) => (
  <Link
    to={to}
    className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors duration-200 ${
      isActive
        ? 'bg-blue-600 text-white shadow-md'
        : 'text-gray-700 hover:bg-gray-200'
    }`}
  >
    <i className={`fa-solid ${icon}`}></i>
    <span>{children}</span>
  </Link>
);

const Header: React.FC<HeaderProps> = ({ currentPage, setPage }) => {
  const { signOut, userData } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

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

  return (
    <header className="bg-white shadow-sm p-4 sticky top-0 z-50">
      <div className="container mx-auto flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <img src="https://em-content.zobj.net/source/apple/354/flag-germany_1f1e9-1f1ea.png" alt="German Flag" className="h-8 w-8" />
          <h1 className="text-2xl font-bold text-blue-700">DeutschBoost</h1>
        </div>
        <nav className="flex items-center space-x-2">
          <NavItem to="/" icon="fa-house" isActive={isActive('/')}>
            Home
          </NavItem>
          <NavItem to="/placement-test" icon="fa-clipboard-question" isActive={isActive('/placement-test')}>
            Test
          </NavItem>
          <NavItem to="/learning-plan" icon="fa-map-signs" isActive={isActive('/learning-plan')}>
            Plan
          </NavItem>
          <NavItem to="/conversation" icon="fa-microphone-alt" isActive={isActive('/conversation')}>
            Sprechen
          </NavItem>
          <NavItem to="/profile" icon="fa-user-gear" isActive={isActive('/profile')}>
            Profile
          </NavItem>
          <button
            onClick={handleSignOut}
            className="flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors duration-200 text-red-600 hover:bg-red-50 border border-red-300"
            title="Sign Out"
          >
            <i className="fa-solid fa-right-from-bracket"></i>
            <span>Logout</span>
          </button>
        </nav>
      </div>
    </header>
  );
};

export default Header;