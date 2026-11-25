<script setup lang="ts">
// 24×24 stroke icons for action buttons. Decorative: the button or link carries the label.
defineProps<{ name: 'trash' | 'edit' | 'qr' | 'plus' }>()

const paths = {
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13M9 7V4h6v3',
  edit: 'M4 20h4L18.5 9.5a2.12 2.12 0 0 0-3-3L5 17v3ZM13.5 6.5l3 3',
  qr: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h3v3h-3zM20 14v2M14 20h2M18 18h2v2',
  plus: 'M12 5v14M5 12h14',
}
</script>

<template>
  <svg
    class="size-5"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.75"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path :d="paths[name]" />
  </svg>
</template>
