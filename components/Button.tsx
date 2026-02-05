import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  isLoading?: boolean;
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  isLoading, 
  icon,
  className = '',
  ...props 
}) => {
  // iOS Style: Pill shapes, backdrop blur where applicable, subtle borders
  const baseStyles = "inline-flex items-center justify-center px-5 py-2.5 rounded-full font-medium text-sm transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none active:scale-95";
  
  const variants = {
    // Vibrant Blue with subtle glow
    primary: "bg-[#0A84FF] hover:bg-[#007AFF] text-white shadow-[0_0_15px_rgba(10,132,255,0.3)] border border-white/10",
    // Glassy background
    secondary: "bg-white/10 backdrop-blur-md hover:bg-white/20 text-white border border-white/10",
    // Red tint glass
    danger: "bg-red-500/20 backdrop-blur-md hover:bg-red-500/30 text-red-100 border border-red-500/30",
    // Transparent with hover effect
    ghost: "bg-transparent hover:bg-white/5 text-slate-300 hover:text-white"
  };

  return (
    <button 
      className={`${baseStyles} ${variants[variant]} ${className}`}
      disabled={isLoading || props.disabled}
      {...props}
    >
      {isLoading ? (
        <svg className="animate-spin h-5 w-5 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      ) : icon ? (
        <span className={children ? "mr-2" : ""}>{icon}</span>
      ) : null}
      {children}
    </button>
  );
};