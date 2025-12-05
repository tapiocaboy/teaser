import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

// All available themes
export const THEMES = {
  light: {
    id: 'light',
    name: 'Light',
    description: 'Clean and professional light theme',
    category: 'Classic',
    icon: '☀️',
  },
  dark: {
    id: 'dark',
    name: 'Dark',
    description: 'Easy on the eyes dark theme',
    category: 'Classic',
    icon: '🌙',
  },
  'ai-cyber': {
    id: 'ai-cyber',
    name: 'Cyber',
    description: 'Cyberpunk-inspired cyan & magenta',
    category: 'AI',
    icon: '🤖',
  },
  'ai-neon': {
    id: 'ai-neon',
    name: 'Neon',
    description: 'Electric violet with neon accents',
    category: 'AI',
    icon: '💜',
  },
  'ai-matrix': {
    id: 'ai-matrix',
    name: 'Matrix',
    description: 'Classic green-on-black hacker style',
    category: 'AI',
    icon: '💚',
  },
  'ai-gradient': {
    id: 'ai-gradient',
    name: 'Gradient',
    description: 'Vibrant purple to pink gradient',
    category: 'AI',
    icon: '🌈',
  },
  darkrise: {
    id: 'darkrise',
    name: 'Darkrise',
    description: 'Modern SaaS with electric blue',
    category: 'Professional',
    icon: '💙',
  },
  'darkrise-purple': {
    id: 'darkrise-purple',
    name: 'Darkrise Purple',
    description: 'Purple gradient variant',
    category: 'Professional',
    icon: '🔮',
  },
  'darkrise-ocean': {
    id: 'darkrise-ocean',
    name: 'Darkrise Ocean',
    description: 'Teal and ocean accents',
    category: 'Professional',
    icon: '🌊',
  },
  'enterprise-elite': {
    id: 'enterprise-elite',
    name: 'Enterprise Elite',
    description: 'Premium animated enterprise theme',
    category: 'Enterprise',
    icon: '⚡',
  },
  'enterprise-slate': {
    id: 'enterprise-slate',
    name: 'Enterprise Slate',
    description: 'Professional static design',
    category: 'Enterprise',
    icon: '🏢',
  },
  'quantum-pro': {
    id: 'quantum-pro',
    name: 'Quantum Pro',
    description: 'Ultra-modern high-tech theme',
    category: 'Enterprise',
    icon: '🔷',
  },
  'retro-90s': {
    id: 'retro-90s',
    name: 'Retro 90s',
    description: 'Nostalgic Windows 95 aesthetic',
    category: 'Fun',
    icon: '💾',
  },
};

// Group themes by category
export const THEME_CATEGORIES = {
  Classic: ['light', 'dark'],
  AI: ['ai-cyber', 'ai-neon', 'ai-matrix', 'ai-gradient'],
  Professional: ['darkrise', 'darkrise-purple', 'darkrise-ocean'],
  Enterprise: ['enterprise-elite', 'enterprise-slate', 'quantum-pro'],
  Fun: ['retro-90s'],
};

const ThemeContext = createContext(undefined);

const STORAGE_KEY = 'echo-theme';

export function ThemeProvider({ children, defaultTheme = 'dark' }) {
  const [theme, setThemeState] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && THEMES[stored]) {
        return stored;
      }
    }
    return defaultTheme;
  });

  // Apply theme to document
  useEffect(() => {
    const root = window.document.documentElement;
    
    // Remove all theme classes
    Object.keys(THEMES).forEach((themeId) => {
      root.classList.remove(themeId);
    });
    
    // Add current theme class
    root.classList.add(theme);
    
    // Update body background based on theme
    updateBodyBackground(theme);
  }, [theme]);

  const setTheme = useCallback((newTheme) => {
    if (THEMES[newTheme]) {
      setThemeState(newTheme);
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, newTheme);
      }
    }
  }, []);

  const value = {
    theme,
    setTheme,
    themes: THEMES,
    categories: THEME_CATEGORIES,
    currentTheme: THEMES[theme],
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

// Helper function to update body background based on theme
function updateBodyBackground(theme) {
  const body = document.body;
  
  // Reset styles
  body.style.backgroundColor = '';
  body.style.backgroundImage = '';
  
  switch (theme) {
    case 'light':
      body.style.backgroundColor = 'oklch(0.99 0.005 240)';
      break;
    case 'dark':
      body.style.backgroundColor = 'oklch(0.08 0.02 240)';
      body.style.backgroundImage = `
        radial-gradient(circle at 20% 20%, oklch(0.15 0.1 260 / 0.3), transparent 45%),
        radial-gradient(circle at 80% 80%, oklch(0.15 0.08 200 / 0.2), transparent 40%)
      `;
      break;
    case 'ai-cyber':
      body.style.backgroundColor = 'oklch(0.05 0.03 240)';
      body.style.backgroundImage = `
        radial-gradient(circle at 15% 50%, oklch(0.2 0.15 195 / 0.2), transparent 40%),
        radial-gradient(circle at 85% 30%, oklch(0.2 0.15 320 / 0.15), transparent 35%)
      `;
      break;
    case 'ai-neon':
      body.style.backgroundColor = 'oklch(0.06 0.04 280)';
      body.style.backgroundImage = `
        radial-gradient(circle at 30% 70%, oklch(0.25 0.2 280 / 0.25), transparent 40%),
        radial-gradient(circle at 70% 20%, oklch(0.25 0.15 130 / 0.15), transparent 35%)
      `;
      break;
    case 'ai-matrix':
      body.style.backgroundColor = 'oklch(0.03 0.01 140)';
      body.style.backgroundImage = `
        linear-gradient(180deg, oklch(0.03 0.01 140) 0%, oklch(0.05 0.02 140) 100%),
        radial-gradient(circle at 50% 50%, oklch(0.15 0.1 140 / 0.1), transparent 60%)
      `;
      break;
    case 'ai-gradient':
      body.style.backgroundColor = 'oklch(0.08 0.08 290)';
      body.style.backgroundImage = `
        linear-gradient(135deg, 
          oklch(0.08 0.08 290) 0%,
          oklch(0.1 0.1 310) 50%,
          oklch(0.08 0.08 260) 100%
        )
      `;
      break;
    case 'darkrise':
      body.style.backgroundColor = 'oklch(0.06 0.04 250)';
      body.style.backgroundImage = `
        radial-gradient(circle at 0% 0%, oklch(0.15 0.12 240 / 0.3), transparent 50%),
        radial-gradient(circle at 100% 100%, oklch(0.12 0.1 220 / 0.2), transparent 50%)
      `;
      break;
    case 'darkrise-purple':
      body.style.backgroundColor = 'oklch(0.06 0.04 270)';
      body.style.backgroundImage = `
        radial-gradient(circle at 20% 80%, oklch(0.18 0.15 270 / 0.25), transparent 45%),
        radial-gradient(circle at 80% 20%, oklch(0.15 0.12 290 / 0.2), transparent 40%)
      `;
      break;
    case 'darkrise-ocean':
      body.style.backgroundColor = 'oklch(0.06 0.04 210)';
      body.style.backgroundImage = `
        radial-gradient(circle at 30% 90%, oklch(0.18 0.12 190 / 0.25), transparent 45%),
        radial-gradient(circle at 70% 10%, oklch(0.15 0.1 170 / 0.2), transparent 40%)
      `;
      break;
    case 'enterprise-elite':
      body.style.backgroundColor = 'oklch(0.05 0.05 240)';
      body.style.backgroundImage = `
        radial-gradient(circle at 10% 20%, oklch(0.2 0.15 230 / 0.15), transparent 40%),
        radial-gradient(circle at 90% 80%, oklch(0.15 0.12 270 / 0.1), transparent 40%)
      `;
      break;
    case 'enterprise-slate':
      body.style.backgroundColor = '#0f172a';
      body.style.backgroundImage = 'none';
      break;
    case 'quantum-pro':
      body.style.backgroundColor = 'oklch(0.04 0.04 220)';
      body.style.backgroundImage = `
        radial-gradient(circle at 25% 25%, oklch(0.15 0.1 195 / 0.15), transparent 50%),
        radial-gradient(circle at 75% 75%, oklch(0.12 0.08 210 / 0.1), transparent 50%)
      `;
      break;
    case 'retro-90s':
      body.style.backgroundColor = '#C0C0C0';
      body.style.backgroundImage = 'none';
      break;
    default:
      body.style.backgroundColor = 'oklch(0.08 0.02 240)';
  }
}

export default ThemeContext;

