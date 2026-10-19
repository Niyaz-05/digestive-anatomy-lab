/**
 * Where the food is on its journey. The 3D scene advances it every frame; React only hears about
 * it when the food enters a new stage, so the panel re-renders a few times per journey, not per frame.
 */
type Listener = (stage: string | null) => void;

const listeners = new Set<Listener>();

export const journey = {
  /** Route step (structure id, e.g. "stomach", "duodenum") the food is in, or null when idle. */
  stage: null as string | null,
  setStage(stage: string | null) {
    if (stage === this.stage) return;
    this.stage = stage;
    listeners.forEach((fn) => fn(stage));
  },
  subscribe(fn: Listener): () => void {
    listeners.add(fn);
    return () => { listeners.delete(fn); };
  },
};

/** The route step a model part belongs to (the duodenum's parts are one step, as is the colon). */
export function stageOf(part: string): string {
  if (part.startsWith('duodenum') || part === 'duodenal-bulb') return 'duodenum';
  if (part === 'terminal-ileum') return 'ileum';
  if (['ascending-colon', 'hepatic-flexure', 'transverse-colon', 'splenic-flexure', 'descending-colon', 'sigmoid-colon'].includes(part)) return 'colon';
  return part;
}
