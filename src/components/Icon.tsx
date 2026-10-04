// Контурные иконки 24×24, цвет берут из currentColor.

const PATHS: Record<string, string> = {
  // иконки направлений (как в макете + запас для своих)
  bulb: 'M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z',
  dumbbell: 'M6 7v10M18 7v10M3 10v4M21 10v4M6 12h12',
  tools: 'M13 4l7 7-3 3-7-7zM11.5 8.5L4 16v4h4l7.5-7.5',
  brush: 'M4 20l4-1 11-11-3-3L5 16zM14 7l3 3',
  monitor: 'M3 4h18v12H3zM8 20h8M12 16v4',
  heart: 'M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z',
  music: 'M9 18V5l11-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM20 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0z',
  globe: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3 12h18M12 3c2.5 2.5 3.5 5.5 3.5 9s-1 6.5-3.5 9c-2.5-2.5-3.5-5.5-3.5-9s1-6.5 3.5-9z',
  leaf: 'M5 19c0-9 6-14 15-14 0 9-5 15-14 15M5 19l7-7',
  code: 'M8 7l-5 5 5 5M16 7l5 5-5 5M14 4l-4 16',
  chef: 'M7 14a4 4 0 0 1-1-7.9A5 5 0 0 1 16 5a4 4 0 0 1 1 9zM7 14v6h10v-6',
  coin: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM15 9h-4a2 2 0 0 0 0 4h2a2 2 0 0 1 0 4H9M12 7v2M12 17v2',
  backspace: 'M21 5H9l-6 7 6 7h12zM17 9l-6 6M11 9l6 6',
  shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM8.5 12l2.5 2.5 4.5-5',
  upload: 'M12 20V9M7 14l5-5 5 5M5 4h14',
  web: 'M12 2v20M2 12h20M5 5l14 14M19 5L5 19M12 6l4.2 1.8L18 12l-1.8 4.2L12 18l-4.2-1.8L6 12l1.8-4.2z',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c0-4 4-6 8-6s8 2 8 6',
  tree: 'M12 3a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM6 17a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM18 17a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM12 7v5M6 17v-5h12v5',
  plus: 'M12 5v14M5 12h14',
  journal: 'M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6',
  menu: 'M4 7h16M4 12h16M4 17h16',
  flame: 'M12 3c1 4 5 5 5 10a5 5 0 0 1-10 0c0-3 2-4 2-7 1 1 2 2 3 4 0-2 0-5 0-7z',
  camera: 'M4 8h3l2-3h6l2 3h3v11H4zM12 9.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z',
  check: 'M5 12l5 5 9-10',
  x: 'M6 6l12 12M18 6L6 18',
  lock: 'M5 11h14v10H5zM8 11V8a4 4 0 0 1 8 0v3',
  target: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zM12 11.5v1',
  right: 'M9 6l6 6-6 6',
  up: 'M6 15l6-6 6 6',
  down: 'M6 9l6 6 6-6',
  back: 'M15 6l-6 6 6 6',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  edit: 'M4 20l4-1 11-11-3-3L5 16zM14 7l3 3',
  dots: 'M5 12h.01M12 12h.01M19 12h.01',
  book: 'M4 5a2 2 0 0 1 2-2h12v16H6a2 2 0 0 0-2 2zM4 5v16',
  hammer: 'M13 4l7 7-3 3-7-7zM11.5 8.5L4 16v4h4l7.5-7.5',
  link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  trophy: 'M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 20h8',
  alert: 'M12 7v6M12 17v.5',
  image: 'M4 5h16v14H4zM4 15l5-5 4 4 3-3 4 4M15 9h.01',
  sprout: 'M12 21V10M12 10c0-4 3-6 7-6 0 4-3 6-7 6zM12 13c0-3-2-5-6-5 0 3 2 5 6 5z',
  calendar: 'M4 5h16v15H4zM4 10h16M9 3v4M15 3v4',
  compass: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM15.5 8.5l-2 5-5 2 2-5z',
  sword: 'M14 4l6 6M4 20l9-9M9 4l11 11-3 3L6 7z',
  medal: 'M12 4a5 5 0 1 0 0 10 5 5 0 0 0 0-10zM9 13.5L8 21l4-2 4 2-1-7.5',
  crown: 'M4 18h16M4 18L3 8l5 4 4-7 4 7 5-4-1 10',
  chart: 'M4 20V4M4 20h16M8 16l4-5 3 3 5-6',
  star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z',
  wrench: 'M14.7 6.3a4 4 0 0 0 5 5L12 19a2.1 2.1 0 0 1-3-3z',
  voice: 'M4 5h16v11H9l-5 4zM8 9h8M8 12h5',
  moon: 'M20 14A8 8 0 1 1 10 4a6 6 0 0 0 10 10z',
  sun: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  repeat: 'M17 2l3 3-3 3M4 11V9a4 4 0 0 1 4-4h12M7 22l-3-3 3-3M20 13v2a4 4 0 0 1-4 4H4',
  dice: 'M4 4h16v16H4zM8.5 8.5h.01M15.5 8.5h.01M12 12h.01M8.5 15.5h.01M15.5 15.5h.01',
  settings: 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM19 12l2-1-1-3-2 .2-1.3-1.5.3-2-3-1-1 2h-2l-1-2-3 1 .3 2L6 7.2 4 7 3 10l2 1v2l-2 1 1 3 2-.2 1.3 1.5-.3 2 3 1 1-2h2l1 2 3-1-.3-2 1.3-1.5 2 .2 1-3-2-1z',
  spark: 'M12 2l1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8zM19 15l.9 2.6 2.6.9-2.6.9L19 22l-.9-2.6-2.6-.9 2.6-.9z',
  download: 'M12 4v11M7 10l5 5 5-5M5 20h14',
};

export type IconName = keyof typeof PATHS | string;

export function Icon({ name, size = 22, stroke = 2 }: { name: IconName; size?: number; stroke?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width={stroke} stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d={PATHS[name] ?? PATHS.star} />
    </svg>
  );
}
