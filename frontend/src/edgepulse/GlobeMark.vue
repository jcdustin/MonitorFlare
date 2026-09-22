<template>
  <svg class="globe" viewBox="0 0 320 160" role="img" aria-label="Single-region monitoring">
    <defs>
      <radialGradient id="g" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#16375c" />
        <stop offset="100%" stop-color="#0a1628" />
      </radialGradient>
    </defs>
    <ellipse cx="160" cy="80" rx="78" ry="78" fill="url(#g)" stroke="rgba(73,208,234,0.45)" />
    <ellipse cx="160" cy="80" rx="78" ry="28" fill="none" stroke="rgba(73,208,234,0.25)" />
    <ellipse cx="160" cy="80" rx="28" ry="78" fill="none" stroke="rgba(73,208,234,0.18)" />
    <path d="M90 80 H230" stroke="rgba(73,208,234,0.15)" />
    <circle cx="188" cy="62" r="3.5" fill="#49d0ea">
      <animate attributeName="opacity" values="1;0.4;1" dur="2.8s" repeatCount="indefinite" />
    </circle>
    <text x="160" y="148" text-anchor="middle" fill="#8ea3bb" font-size="12">Single-region monitoring</text>
  </svg>
</template>
