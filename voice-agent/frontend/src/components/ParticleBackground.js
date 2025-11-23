import React, { useCallback, useMemo } from 'react';
import Particles from '@tsparticles/react';
import { loadSlim } from '@tsparticles/slim';

const PARTICLE_CONFIGS = {
  neon: {
    background: '#0a0a0a',
    colors: ['#7CFC00', '#1e88e5', '#8e24aa', '#00bcd4'],
    linkColor: '#7CFC00',
    linkOpacity: 0.15,
    speed: 1,
    particleCount: 80,
    interactivity: true,
  },
  dsp: {
    background: '#000000',
    colors: ['#39FF14'],
    linkColor: '#39FF14',
    linkOpacity: 0.2,
    speed: 0.8,
    particleCount: 60,
    interactivity: true,
  },
  synthwave: {
    background: '#0f0820',
    colors: ['#ff006e', '#8338ec', '#3a86ff', '#fb5607', '#ffbe0b'],
    linkColor: '#ff006e',
    linkOpacity: 0.12,
    speed: 0.3, // Very slow motion
    particleCount: 120,
    interactivity: true,
  },
};

const ParticleBackground = ({ themeName = 'neon' }) => {
  const particlesInit = useCallback(async (engine) => {
    await loadSlim(engine);
  }, []);

  const particlesLoaded = useCallback(async (container) => {
    console.log('Particles loaded:', container);
  }, []);

  const config = PARTICLE_CONFIGS[themeName] || PARTICLE_CONFIGS.neon;

  const options = useMemo(() => ({
    background: {
      color: {
        value: config.background,
      },
    },
    fpsLimit: 120,
    interactivity: {
      events: {
        onClick: {
          enable: config.interactivity,
          mode: 'push',
        },
        onHover: {
          enable: config.interactivity,
          mode: 'repulse',
        },
        resize: true,
      },
      modes: {
        push: {
          quantity: 4,
        },
        repulse: {
          distance: themeName === 'synthwave' ? 150 : 200,
          duration: themeName === 'synthwave' ? 0.8 : 0.4,
        },
      },
    },
    particles: {
      color: {
        value: config.colors,
      },
      links: {
        color: config.linkColor,
        distance: themeName === 'synthwave' ? 180 : 150,
        enable: true,
        opacity: config.linkOpacity,
        width: themeName === 'synthwave' ? 1.5 : 1,
      },
      move: {
        direction: 'none',
        enable: true,
        outModes: {
          default: 'bounce',
        },
        random: themeName === 'synthwave',
        speed: config.speed,
        straight: false,
      },
      number: {
        density: {
          enable: true,
          area: 800,
        },
        value: config.particleCount,
      },
      opacity: {
        value: themeName === 'synthwave' ? { min: 0.2, max: 0.5 } : { min: 0.1, max: 0.3 },
        animation: {
          enable: true,
          speed: themeName === 'synthwave' ? 0.5 : 1,
          minimumValue: themeName === 'synthwave' ? 0.2 : 0.1,
          sync: false,
        },
      },
      shape: {
        type: 'circle',
      },
      size: {
        value: themeName === 'synthwave' ? { min: 2, max: 5 } : { min: 1, max: 3 },
        animation: {
          enable: true,
          speed: themeName === 'synthwave' ? 1 : 2,
          minimumValue: themeName === 'synthwave' ? 2 : 1,
          sync: false,
        },
      },
    },
    detectRetina: true,
  }), [themeName, config]);

  return (
    <Particles
      id="tsparticles"
      key={themeName} // Force re-render when theme changes
      init={particlesInit}
      loaded={particlesLoaded}
      options={options}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: -1,
        pointerEvents: 'none',
      }}
    />
  );
};

export default ParticleBackground;
