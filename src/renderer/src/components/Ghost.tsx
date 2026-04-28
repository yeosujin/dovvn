interface Props {
  size?: number
  className?: string
  expression?: 'happy' | 'sleepy' | 'curious' | 'shy'
  withBadge?: boolean
  sleeping?: boolean
}

export function Ghost({
  size = 56,
  className = '',
  expression = 'happy',
  withBadge = false,
  sleeping = false
}: Props): React.JSX.Element {
  const eyeY = 46
  const effectiveExpression = sleeping ? 'sleepy' : expression
  const mouth = {
    happy: 'M44 58 Q50 64 56 58',
    sleepy: 'M44 60 L56 60',
    curious: 'M47 60 Q50 57 53 60',
    shy: 'M44 60 Q50 62 56 60'
  }[effectiveExpression]

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <radialGradient id="ghostBody" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#f3efff" />
        </radialGradient>
        <filter id="ghostShadow" x="-30%" y="-10%" width="160%" height="130%">
          <feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="#7c6ae8" floodOpacity="0.22" />
        </filter>
      </defs>

      {/* 바디 */}
      <path
        d="M20 44 C20 27 33 15 50 15 C67 15 80 27 80 44 L80 82 C80 85 77 86 74 84 L68 80 C66 79 64 79 62 81 L57 85 C54 87 51 87 48 85 L43 81 C41 79 39 79 37 80 L31 84 C28 86 25 85 25 82 L25 78 C22 78 20 75 20 72 Z"
        fill="url(#ghostBody)"
        stroke="#e8e2fb"
        strokeWidth="1.2"
        filter="url(#ghostShadow)"
      />

      {/* 볼터치 */}
      <ellipse cx="32" cy="54" rx="5" ry="3.2" fill="#fbb6ce" opacity="0.75" />
      <ellipse cx="68" cy="54" rx="5" ry="3.2" fill="#fbb6ce" opacity="0.75" />

      {/* 눈 */}
      {sleeping ? (
        <g>
          <path
            d="M36 46 Q40 50 44 46"
            stroke="#2d2a3d"
            strokeWidth="2"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d="M56 46 Q60 50 64 46"
            stroke="#2d2a3d"
            strokeWidth="2"
            strokeLinecap="round"
            fill="none"
          />
        </g>
      ) : (
        <g className="ghost-blink">
          <ellipse cx="40" cy={eyeY} rx="2.6" ry="3.6" fill="#2d2a3d" />
          <ellipse cx="60" cy={eyeY} rx="2.6" ry="3.6" fill="#2d2a3d" />
          <circle cx="41" cy={eyeY - 1} r="0.9" fill="#ffffff" />
          <circle cx="61" cy={eyeY - 1} r="0.9" fill="#ffffff" />
        </g>
      )}

      {/* 입 */}
      <path d={mouth} stroke="#2d2a3d" strokeWidth="2" strokeLinecap="round" fill="none" />

      {/* Z Z Z (자는 중) */}
      {sleeping && (
        <g fill="#8b7cf4" opacity="0.85" fontFamily="system-ui, sans-serif" fontWeight="700">
          <text x="74" y="28" fontSize="10">
            z
          </text>
          <text x="80" y="20" fontSize="12">
            Z
          </text>
          <text x="88" y="12" fontSize="14">
            Z
          </text>
        </g>
      )}

      {/* 다운로드 뱃지 */}
      {withBadge && (
        <g transform="translate(62 62)">
          <circle cx="14" cy="14" r="15" fill="#ffffff" />
          <circle cx="14" cy="14" r="13" fill="url(#badgeGrad)" />
          <defs>
            <linearGradient id="badgeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#8b7cf4" />
              <stop offset="100%" stopColor="#6b5bd9" />
            </linearGradient>
          </defs>
          <path
            d="M14 7 L14 18 M9 14 L14 19 L19 14 M8 21 L20 21"
            stroke="#ffffff"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </g>
      )}
    </svg>
  )
}
