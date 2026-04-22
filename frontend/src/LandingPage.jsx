import React from 'react';

export default function LandingPage({ onEnterApp }) {
  const heroImage = "/aura_hero_vehicle_1776841223607.png"; // This will need to be accessible to the frontend

  return (
    <div className="landing-container">
      <style>{`
        .landing-container {
          min-height: 100vh;
          background: #000;
          color: #fff;
          overflow-x: hidden;
        }

        /* Nav */
        nav {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 24px 48px;
          position: fixed;
          top: 0;
          width: 100%;
          z-index: 100;
        }

        .logo {
          font-family: 'Playfair Display', serif;
          font-size: 24px;
          font-weight: 700;
          letter-spacing: 0.1em;
          color: var(--aura-gold);
        }

        /* Hero */
        .hero-section {
          height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          text-align: center;
          padding: 0 24px;
        }

        .hero-bg {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: radial-gradient(circle at 50% 50%, rgba(6, 78, 59, 0.4) 0%, rgba(0,0,0,1) 100%);
          z-index: 1;
        }

        .hero-image-wrap {
          position: absolute;
          width: 80%;
          max-width: 1200px;
          opacity: 0.6;
          mask-image: linear-gradient(to bottom, rgba(0,0,0,1) 50%, rgba(0,0,0,0) 100%);
          z-index: 0;
        }

        .hero-content {
          position: relative;
          z-index: 10;
          max-width: 800px;
        }

        .hero-eyebrow {
          color: var(--aura-gold);
          font-size: 14px;
          font-weight: 800;
          letter-spacing: 4px;
          text-transform: uppercase;
          margin-bottom: 24px;
          display: block;
        }

        .hero-title {
          font-size: clamp(48px, 8vw, 96px);
          font-weight: 700;
          line-height: 1;
          margin-bottom: 32px;
        }

        .hero-subtitle {
          font-size: 18px;
          color: #94a3b8;
          max-width: 540px;
          margin: 0 auto 48px;
          line-height: 1.6;
        }

        /* Flywheel Section */
        .flywheel-section {
          padding: 120px 48px;
          background: #050505;
          text-align: center;
        }

        .section-title {
          font-size: 40px;
          margin-bottom: 64px;
        }

        .flywheel-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 32px;
          max-width: 1200px;
          margin: 0 auto;
        }

        .flywheel-card {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.05);
          padding: 48px 32px;
          border-radius: 24px;
          transition: all 0.3s ease;
        }

        .flywheel-card:hover {
          background: rgba(255,255,255,0.05);
          border-color: var(--aura-gold);
          transform: translateY(-8px);
        }

        .card-icon {
          font-size: 32px;
          margin-bottom: 24px;
          display: block;
        }

        .card-title {
          font-size: 20px;
          margin-bottom: 16px;
          color: var(--aura-gold-soft);
        }

        .card-text {
          color: #94a3b8;
          font-size: 15px;
          line-height: 1.6;
        }

        /* Footer */
        footer {
          padding: 48px;
          border-top: 1px solid rgba(255,255,255,0.1);
          text-align: center;
          font-size: 14px;
          color: #64748b;
        }
      `}</style>

      <nav>
        <div className="logo">AURA</div>
        <button className="aura-btn aura-btn-primary" onClick={onEnterApp}>
          LAUNCH APP
        </button>
      </nav>

      <div className="hero-section">
        <div className="hero-bg" />
        <div className="hero-image-wrap">
           <img src="/aura_hero.png" alt="AURA Hero" style={{ width: '100%', objectFit: 'cover' }} />
        </div>
        
        <div className="hero-content fade-up">
          <span className="hero-eyebrow">The Future of Inspection</span>
          <h1 className="hero-title">Precision <br/> Undercarriage <br/> AI.</h1>
          <p className="hero-subtitle">
            Advanced risk analysis and damage detection for the next generation of fleet management. 
            Empowered by the AURA Data Flywheel.
          </p>
          <div className="flex gap-4 justify-center">
            <button className="aura-btn aura-btn-primary" style={{ padding: '16px 40px' }} onClick={onEnterApp}>
              GET STARTED
            </button>
          </div>
        </div>
      </div>

      <div className="flywheel-section">
        <h2 className="section-title">The Data Flywheel</h2>
        <div className="flywheel-grid">
          <div className="flywheel-card fade-up" style={{ animationDelay: '0.1s' }}>
            <span className="card-icon">📱</span>
            <h3 className="card-title">Field Capture</h3>
            <p className="card-text">Operators capture high-fidelity vehicle data using the AURA Mobile integration.</p>
          </div>
          <div className="flywheel-card fade-up" style={{ animationDelay: '0.2s' }}>
            <span className="card-icon">🧠</span>
            <h3 className="card-title">AI Inference</h3>
            <p className="card-text">Our proprietary models detect micro-fractures, corrosion, and structural anomalies.</p>
          </div>
          <div className="flywheel-card fade-up" style={{ animationDelay: '0.3s' }}>
            <span className="card-icon">⚖️</span>
            <h3 className="card-title">Human Verification</h3>
            <p className="card-text">Expert reviews finalize the "Gold Standard" dataset, closing the loop for continuous training.</p>
          </div>
        </div>
      </div>

      <footer>
        &copy; 2026 AURA TECHNOLOGIES. POWERED BY VICTORASIDO AI.
      </footer>
    </div>
  );
}
