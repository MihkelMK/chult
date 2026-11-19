<script lang="ts">
  import { DIContainer, setDIContainer } from '#lib/contexts/diContext.ts';
  import { LocalStateDM } from '#lib/stores/localStateDM.svelte.ts';
  import { LocalStatePlayer } from '#lib/stores/localStatePlayer.svelte.ts';

  const container = new DIContainer();
  container.register(Symbol.for('LocalStateDM'), LocalStateDM);
  container.register(Symbol.for('LocalStatePlayer'), LocalStatePlayer);
  setDIContainer(container);

  let { children } = $props();
</script>

{@render children?.()}
