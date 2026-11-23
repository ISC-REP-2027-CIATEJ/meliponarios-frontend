export default function DetailIcon({ name, size = 22 }) {
  const icons = {
    sound: (
      <>
        <path d="m3 9 4 0 5-4v14l-5-4H3V9Zm13-1a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14" />
      </>
    ),
    stop: <path d="M7 5v14M17 5v14" />,
    home: (
      <>
        <path d="m3 11 9-8 9 8M5 10v11h14V10M9 21v-8h6v8" />
      </>
    ),
    leaf: (
      <>
        <path d="M12 22V9M12 15C1 17 3 3 3 3s11 1 9 12Zm1-4c-2-9 8-9 8-9s3 10-8 9Z" />
      </>
    ),
    box: (
      <>
        <path d="m3 7 9-4 9 4v12l-9 4-9-4V7Zm0 0 9 4 9-4M12 11v12M7 5l10 4" />
      </>
    ),
    jar: (
      <>
        <path d="M8 3h8v4H8zM7 7h10l2 4v10H5V11l2-4ZM8 13h8v5H8z" />
      </>
    ),
    person: (
      <>
        <circle cx="12" cy="7" r="4" />
        <path d="M4 22v-3a8 8 0 0 1 16 0v3" />
      </>
    ),
    route: (
      <>
        <path d="m3 11 18-8-8 18-2-8-8-2ZM11 13 21 3" />
      </>
    ),
    share: (
      <>
        <circle cx="5" cy="12" r="3" />
        <circle cx="19" cy="5" r="3" />
        <circle cx="19" cy="19" r="3" />
        <path d="m8 11 8-5M8 13l8 5" />
      </>
    ),
    expand: <path d="M9 3H3v6m12-6h6v6M3 15v6h6m6 0h6v-6" />,
    phone: (
      <path d="m7 3 4 5-3 3c1 3 2 4 5 5l3-3 5 4c-1 5-4 6-9 3S3 12 3 7c0-2 2-4 4-4Z" />
    ),
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0"
    >
      {icons[name] || icons.leaf}
    </svg>
  );
}
