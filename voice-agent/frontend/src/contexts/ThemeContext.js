import React, { createContext, useContext, useEffect } from 'react';

// Industrial High-Tech AI Theme
const THEME = {
  id: 'akordi-echo',
  name: 'Akordi Echo',
  description: 'Industrial high-tech theme for voice AI',
};

const ThemeContext = createContext(undefined);

export function ThemeProvider({ children }) {
  // Apply industrial high-tech theme on mount
  useEffect(() => {
    document.body.style.backgroundColor = '#06080d';
    document.body.style.minHeight = '100vh';
    document.body.style.color = '#e8edf5';
  }, []);

  const value = {
    theme: THEME,
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

export default ThemeContext;
