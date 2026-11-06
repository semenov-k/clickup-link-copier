const svg = (body: string, size = 16) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

export const icons = {
  link: (s?: number) =>
    svg('<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>', s),
  check: (s?: number) => svg('<path d="M20 6 9 17l-5-5"/>', s),
  plus: (s?: number) => svg('<path d="M12 5v14M5 12h14"/>', s),
  x: (s?: number) => svg('<path d="M18 6 6 18M6 6l12 12"/>', s),
  trash: (s?: number) =>
    svg('<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>', s),
  chevronUp: (s?: number) => svg('<path d="m18 15-6-6-6 6"/>', s),
  copy: (s?: number) =>
    svg('<rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>', s),
  listPlus: (s?: number) => svg('<path d="M11 12H3M16 6H3M16 18H3M18 9v6M21 12h-6"/>', s),
  grip: (s?: number) =>
    `<svg xmlns="http://www.w3.org/2000/svg" width="${s ?? 16}" height="${s ?? 16}" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/></svg>`,
  listCheck: (s?: number) => svg('<path d="M11 12H3M16 6H3M11 18H3M15 18l2 2 4-4"/>', s),
};
