export default function Icon({ name, size = 20 }) {
  const paths = {
    search: <><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></>,
    pin: <><path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2"/></>,
    bee: <><ellipse cx="12" cy="14" rx="4" ry="7"/><path d="M8 12h8M8 16h8M10 7 8 3m6 4 2-4M8 10C0 1 0 15 8 14m8-4c8-9 8 5 0 4"/></>,
    bag: <><path d="M5 8h14l1 13H4L5 8Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></>,
    map: <><path d="m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2V5Zm6-2v16m6-14v16"/></>,
    layers: <><path d="m3 8 9-5 9 5-9 5-9-5Zm0 5 9 5 9-5M3 18l9 5 9-5"/></>,
    arrow: <path d="M4 12h16m-6-6 6 6-6 6"/>,
    close: <path d="m6 6 12 12M6 18 18 6"/>,
    filter: <><path d="M3 6h18M3 12h18M3 18h18"/><circle cx="8" cy="6" r="2" fill="currentColor"/><circle cx="16" cy="12" r="2" fill="currentColor"/><circle cx="10" cy="18" r="2" fill="currentColor"/></>,
    sun: <><circle cx="12" cy="12" r="4"/><path d="M12 1v3m0 16v3M1 12h3m16 0h3M4 4l2 2m12 12 2 2M4 20l2-2M18 6l2-2"/></>,
    home: <><path d="m3 11 9-8 9 8M5 10v10h5v-6h4v6h5V10"/></>,
    user: <><circle cx="12" cy="7.5" r="3.5"/><path d="M4 21a8 8 0 0 1 16 0Z"/></>,
    records: <><rect x="4" y="6" width="16" height="14" rx="3"/><path d="M8 6V4h8v2m-6 6H7m10 0h-3m-7 4h10"/></>,
    honey: <><path d="M12 2c-2 4-6.5 7.6-6.5 12.1a6.5 6.5 0 1 0 13 0C18.5 9.6 14 6 12 2Z"/><path d="M9 15a3 3 0 0 0 3 3"/></>,
    visit: <><path d="m12 2 9 5v10l-9 5-9-5V7Z"/><circle cx="12" cy="9" r="2.4"/><path d="M7.5 16a4.6 4.6 0 0 1 9 0"/></>,
    both: <path d="m6.5 3 5.5 3v6l-5.5 3L1 12V6l5.5-3Zm11 0L23 6v6l-5.5 3L12 12v-6l5.5-3Zm-11 12v5l5.5 3 5.5-3v-5"/>,
    chevron: <path d="m6 9 6 6 6-6"/>,
    next: <path d="m9 6 6 6-6 6"/>,
    back: <path d="M20 12H4m6-6-6 6 6 6"/>,
    refresh: <><path d="M20 7V3m0 4h-4M4 17v4m0-4h4"/><path d="M20 7A8 8 0 0 0 6 5m-2 12a8 8 0 0 0 14 2"/></>,
    locate: <><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/><path d="M12 2v4m0 12v4M2 12h4m12 0h4"/></>,
    mail: <><rect x="3" y="5" width="18" height="14" rx="3"/><path d="m4 8 8 6 8-6"/></>,
    phone: <path d="M4 4h4l2 5-2 2a13 13 0 0 0 5 5l2-2 5 2v4a1 1 0 0 1-1 1C10 21 3 14 3 5a1 1 0 0 1 1-1Z"/>,
    check: <><circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">{paths[name] || paths.bee}</svg>;
}
