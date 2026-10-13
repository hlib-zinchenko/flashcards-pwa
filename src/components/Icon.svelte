<script lang="ts" module>
  const paths = {
    plus: 'M12 5v14M5 12h14',
    back: 'm15 18-6-6 6-6',
    close: 'M18 6 6 18M6 6l12 12',
    check: 'M20 6 9 17l-5-5',
    up: 'm18 15-6-6-6 6',
    down: 'm6 9 6 6 6-6',
    right: 'm9 18 6-6-6-6',
    more: 'M12 12h.01M19 12h.01M5 12h.01',
    search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3',
    trash: 'M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6',
    edit: 'M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z',
    play: 'M7 4v16l13-8z',
    decks: 'M12 2 2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5',
    settings: 'M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6',
    upload: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12',
    download: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3',
    flip: 'M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5',
    reorder: 'm21 16-4 4-4-4M17 20V4M3 8l4-4 4 4M7 4v16',
    reset: 'M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8M3 3v5h5',
    share: 'M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13',
    tag: 'M12.6 2.6A2 2 0 0 0 11.2 2H4a2 2 0 0 0-2 2v7.2a2 2 0 0 0 .6 1.4l8.7 8.7a2.4 2.4 0 0 0 3.4 0l6.6-6.6a2.4 2.4 0 0 0 0-3.4zM7.5 7.5h.01',
  } as const;
  export type IconName = keyof typeof paths;
</script>

<script lang="ts">
  let { name, size = 22, stroke = 2 }: { name: IconName; size?: number; stroke?: number } = $props();
</script>

<svg
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width={name === 'more' ? 3.2 : stroke}
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
>
  <path d={paths[name]} />
</svg>
