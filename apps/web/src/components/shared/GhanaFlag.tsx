import { memo } from 'react';

interface GhanaFlagProps {
  size?: 'sm' | 'md' | 'lg';
  animate?: boolean;
  className?: string;
}

const SIZES = {
  sm: { width: 20, height: 14, pole: 2 },
  md: { width: 32, height: 22, pole: 3 },
  lg: { width: 48, height: 32, pole: 4 },
} as const;

export const GhanaFlag = memo(function GhanaFlag({
  size = 'md',
  animate = true,
  className = '',
}: GhanaFlagProps) {
  const { width, height, pole } = SIZES[size];
  const stripeH = height / 3;
  const dur = '2s';

  const makeWavePaths = (y: number, h: number) => {
    const w = width;
    const flat = `M0,${y} L${w},${y} L${w},${y + h} L0,${y + h} Z`;
    const waved = `M0,${y} C${w * 0.25},${y - 1.5} ${w * 0.75},${y + 1.5} ${w},${y} L${w},${y + h} C${w * 0.75},${y + h + 1.5} ${w * 0.25},${y + h - 1.5} 0,${y + h} Z`;
    return { flat, waved };
  };

  const red = makeWavePaths(0, stripeH);
  const gold = makeWavePaths(stripeH, stripeH);
  const green = makeWavePaths(stripeH * 2, stripeH);

  const starCx = width * 0.5;
  const starCy = height * 0.5;
  const starSize = Math.min(width, height) * 0.15;

  const starPath = (() => {
    const points: string[] = [];
    for (let i = 0; i < 5; i++) {
      const outerAngle = (Math.PI / 2) * -1 + (i * 2 * Math.PI) / 5;
      const innerAngle = outerAngle + Math.PI / 5;
      points.push(
        `${starCx + Math.cos(outerAngle) * starSize},${starCy + Math.sin(outerAngle) * starSize}`
      );
      points.push(
        `${starCx + Math.cos(innerAngle) * starSize * 0.4},${starCy + Math.sin(innerAngle) * starSize * 0.4}`
      );
    }
    return `M${points.join('L')}Z`;
  })();

  return (
    <div className={`inline-flex items-end gap-px ${className}`}>
      {/* Gold pole */}
      <div
        className="rounded-t-full self-stretch"
        style={{
          width: `${pole}px`,
          background: 'linear-gradient(180deg, #E8C873, #D4A843, #B8860B)',
        }}
      >
        {/* Finial */}
        <div
          className="rounded-full"
          style={{
            width: `${pole + 2}px`,
            height: `${pole + 2}px`,
            background: '#D4A843',
            marginLeft: '-1px',
            marginTop: '-1px',
          }}
        />
      </div>

      {/* Flag SVG */}
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="Ghana flag"
        style={{ display: 'block' }}
      >
        <style>{`
          @media (prefers-reduced-motion: reduce) {
            .gh-flag-anim { display: none; }
          }
        `}</style>

        {/* Red stripe */}
        <path d={red.flat} fill="#CE1126">
          {animate && (
            <animate
              className="gh-flag-anim"
              attributeName="d"
              values={`${red.flat};${red.waved};${red.flat}`}
              dur={dur}
              repeatCount="indefinite"
              calcMode="spline"
              keySplines="0.45 0 0.55 1;0.45 0 0.55 1"
            />
          )}
        </path>

        {/* Gold stripe */}
        <path d={gold.flat} fill="#FCD116">
          {animate && (
            <animate
              className="gh-flag-anim"
              attributeName="d"
              values={`${gold.flat};${gold.waved};${gold.flat}`}
              dur={dur}
              begin="0.15s"
              repeatCount="indefinite"
              calcMode="spline"
              keySplines="0.45 0 0.55 1;0.45 0 0.55 1"
            />
          )}
        </path>

        {/* Green stripe */}
        <path d={green.flat} fill="#006B3F">
          {animate && (
            <animate
              className="gh-flag-anim"
              attributeName="d"
              values={`${green.flat};${green.waved};${green.flat}`}
              dur={dur}
              begin="0.3s"
              repeatCount="indefinite"
              calcMode="spline"
              keySplines="0.45 0 0.55 1;0.45 0 0.55 1"
            />
          )}
        </path>

        {/* Black star with gentle pulse */}
        <path d={starPath} fill="#000000">
          {animate && (
            <animate
              className="gh-flag-anim"
              attributeName="opacity"
              values="1;0.85;1"
              dur="2s"
              repeatCount="indefinite"
              calcMode="spline"
              keySplines="0.45 0 0.55 1;0.45 0 0.55 1"
            />
          )}
        </path>
      </svg>
    </div>
  );
});
