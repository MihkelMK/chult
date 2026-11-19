<script lang="ts">
  import { Toaster } from '#lib/components/ui/sonner/index.ts';
  import '../app.css';

  let { children } = $props();
</script>

{@render children?.()}
<Toaster position="top-center" richColors />
