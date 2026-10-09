export function FoodArt({
  kind = "پاستا",
  className = "",
}: {
  kind?: string;
  className?: string;
}) {
  const rice = kind === "برنج",
    herb = kind === "سبزی",
    cutlet = kind === "کتلت" || kind === "کوکو",
    lentil = kind === "عدس";
  return (
    <svg
      className={`food-art ${className}`}
      viewBox="0 0 500 330"
      role="img"
      aria-label="تصویرسازی غذا"
    >
      <defs>
        <radialGradient id={`plate-${kind}`}>
          <stop stopColor="#ffffff" />
          <stop offset=".85" stopColor="#f7f9f2" />
          <stop offset="1" stopColor="#dce2d4" />
        </radialGradient>
        <filter id={`shadow-${kind}`}>
          <feDropShadow
            dx="0"
            dy="10"
            stdDeviation="10"
            floodColor="#405c40"
            floodOpacity=".13"
          />
        </filter>
      </defs>
      <rect
        width="500"
        height="330"
        fill={herb ? "#dde7d8" : rice ? "#eee8d6" : "#e8eadf"}
      />
      <path
        d="M0 285L500 245M20 0L90 330"
        stroke="#ffffff"
        strokeOpacity=".35"
        strokeWidth="30"
      />
      <ellipse
        cx="255"
        cy="278"
        rx="155"
        ry="25"
        fill="#52664a"
        opacity=".08"
      />
      <circle
        cx="250"
        cy="162"
        r="130"
        fill={`url(#plate-${kind})`}
        filter={`url(#shadow-${kind})`}
      />
      <circle
        cx="250"
        cy="162"
        r="108"
        fill="none"
        stroke="#cdd8c8"
        strokeWidth="2"
      />
      {cutlet ? (
        <g
          fill={herb ? "#4f7438" : kind === "کوکو" ? "#d8ac4e" : "#a8743e"}
          stroke="#956e36"
          strokeWidth="2"
        >
          {[
            [205, 125, -20],
            [282, 122, 20],
            [200, 194, 20],
            [285, 194, -20],
          ].map(([x, y, a], i) => (
            <ellipse
              key={i}
              cx={x}
              cy={y}
              rx="38"
              ry="48"
              transform={`rotate(${a} ${x} ${y})`}
            />
          ))}
        </g>
      ) : herb ? (
        <g fill="#497036">
          {[
            [200, 130],
            [285, 135],
            [220, 205],
            [280, 200],
          ].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r="40" />
          ))}
        </g>
      ) : (
        <g>
          {Array.from({ length: rice ? 85 : 45 }, (_, i) => {
            const angle = i * 2.4,
              r = 12 + Math.sqrt(i) * (rice ? 9 : 12),
              x = 250 + Math.cos(angle) * r,
              y = 162 + Math.sin(angle) * r * 0.82;
            return rice ? (
              <ellipse
                key={i}
                cx={x}
                cy={y}
                rx="9"
                ry="3.5"
                fill={i % 5 === 0 ? "#cf6c3d" : "#e2b95e"}
                transform={`rotate(${i * 35} ${x} ${y})`}
              />
            ) : lentil ? (
              <circle
                key={i}
                cx={x}
                cy={y}
                r="9"
                fill={i % 3 === 0 ? "#ad985e" : "#bca675"}
              />
            ) : (
              <rect
                key={i}
                x={x - 13}
                y={y - 6}
                width="30"
                height="14"
                rx="5"
                fill={i % 4 === 0 ? "#c08b58" : "#e7c88d"}
                stroke="#d5b473"
                transform={`rotate(${i * 41} ${x} ${y})`}
              />
            );
          })}
        </g>
      )}
      <g fill="#548452">
        <ellipse
          cx="247"
          cy="121"
          rx="8"
          ry="18"
          transform="rotate(-35 247 121)"
        />
        <ellipse
          cx="268"
          cy="119"
          rx="8"
          ry="18"
          transform="rotate(35 268 119)"
        />
        <ellipse
          cx="261"
          cy="141"
          rx="7"
          ry="15"
          transform="rotate(60 261 141)"
        />
      </g>
      <g fill="#b95837">
        <circle cx="157" cy="202" r="15" />
        <circle cx="155" cy="176" r="14" />
      </g>
      <g stroke="#456b45" strokeWidth="4" fill="none" strokeLinecap="round">
        <path d="M423 33q-55 35-45 102M408 51l-25-2M394 68l22 2M385 87l-23-2M380 105l22 3" />
      </g>
      <path
        d="M58 75v163m-13-163v45q13 18 26 0V75M416 168v96"
        stroke="#94a48d"
        strokeWidth="7"
        strokeLinecap="round"
        fill="none"
      />
      <ellipse cx="416" cy="153" rx="13" ry="22" fill="#94a48d" />
    </svg>
  );
}
