import React from 'react';

export const OfficialSeal = ({ className = '' }: { className?: string }) => {
  return (
    <div className={`select-none pointer-events-none ${className}`}>
      <svg viewBox="0 0 200 200" className="w-full h-full drop-shadow-xl" style={{ filter: 'drop-shadow(0px 4px 6px rgba(0,0,0,0.15))' }}>
        <defs>
          {/* Main Gold Gradient (Metallic Shine) */}
          <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#BF953F" />
            <stop offset="25%" stopColor="#FCF6BA" />
            <stop offset="50%" stopColor="#B38728" />
            <stop offset="75%" stopColor="#FBF5B7" />
            <stop offset="100%" stopColor="#AA771C" />
          </linearGradient>

          {/* Reverse Gradient for Embossed Look */}
          <linearGradient id="goldGradRev" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#AA771C" />
            <stop offset="25%" stopColor="#FBF5B7" />
            <stop offset="50%" stopColor="#B38728" />
            <stop offset="75%" stopColor="#FCF6BA" />
            <stop offset="100%" stopColor="#BF953F" />
          </linearGradient>

          {/* Text Path for Upper Arc */}
          <path id="textCurveTop" d="M 30,100 A 70,70 0 0,1 170,100" />
          
          {/* Text Path for Lower Arc */}
          <path id="textCurveBot" d="M 38,100 A 62,62 0 0,0 162,100" />
        </defs>

        {/* Outer Jagged Edge (Rosette) */}
        {/* Using a polyline to simulate a 32-point seal */}
        <path
          fill="url(#goldGrad)"
          d="M100,0 L106,12 L119,6 L121,20 L135,18 L133,32 L148,34 L142,47 L157,53 L148,65 L162,74 L150,84 L163,95 L149,103 L160,116 L145,122 L153,136 L138,139 L143,153 L128,153 L129,168 L115,164 L112,179 L100,172 L88,179 L85,164 L71,168 L72,153 L57,153 L62,139 L47,136 L55,122 L40,116 L51,103 L37,95 L50,84 L38,74 L52,65 L43,53 L58,47 L52,34 L67,32 L65,18 L79,20 L81,6 L94,12 L100,0 Z"
          stroke="#B38728"
          strokeWidth="1"
        />

        {/* Inner Ring (The pressed area) */}
        <circle cx="100" cy="100" r="76" fill="none" stroke="url(#goldGradRev)" strokeWidth="2" />
        <circle cx="100" cy="100" r="72" fill="none" stroke="#B38728" strokeWidth="0.5" opacity="0.5" />

        {/* Inner Circle Background (Slightly lighter to show text) */}
        <circle cx="100" cy="100" r="70" fill="url(#goldGrad)" opacity="0.1" />

        {/* Text */}
        <text className="font-serif font-bold text-[13px] tracking-[0.15em]" fill="#5c3a00" style={{ textShadow: '0px 1px 0px rgba(255,255,255,0.4)' }}>
          <textPath href="#textCurveTop" startOffset="50%" textAnchor="middle">
            OFFICIAL SELECTION
          </textPath>
        </text>

        <text className="font-serif font-bold text-[10px] tracking-[0.15em]" fill="#5c3a00" style={{ textShadow: '0px 1px 0px rgba(255,255,255,0.4)' }}>
          <textPath href="#textCurveBot" startOffset="50%" textAnchor="middle">
            VERIFIED ORDER
          </textPath>
        </text>

        {/* Center Element: The App Logo (3 Bars) */}
        <g transform="translate(78, 78) scale(2.2)">
           {/* Shadow for depth */}
           <g transform="translate(1, 1)" opacity="0.3">
             <rect x="0" y="0" width="20" height="2" rx="1" fill="#5c3a00" />
             <rect x="0" y="6" width="15" height="2" rx="1" fill="#5c3a00" />
             <rect x="0" y="12" width="10" height="2" rx="1" fill="#5c3a00" />
           </g>
           {/* Actual Bars */}
           <rect x="0" y="0" width="20" height="2" rx="1" fill="#5c3a00" />
           <rect x="0" y="6" width="15" height="2" rx="1" fill="#5c3a00" />
           <rect x="0" y="12" width="10" height="2" rx="1" fill="#5c3a00" />
        </g>
        
        {/* Shine Overlay (Specular highlight) */}
        <circle cx="100" cy="100" r="88" fill="url(#goldGrad)" opacity="0.1" style={{ mixBlendMode: 'overlay' }} />
      </svg>
    </div>
  );
};