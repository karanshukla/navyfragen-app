type UpdateApplier = () => void;
type Listener = () => void;

let updateReady = false;
let applier: UpdateApplier | null = null;
const listeners = new Set<Listener>();

export function subscribeToUpdate(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function isUpdateReady(): boolean {
  return updateReady;
}

export function markUpdateReady(): void {
  if (updateReady) return;
  updateReady = true;
  for (const listener of listeners) listener();
}

export function setUpdateApplier(fn: UpdateApplier | null): void {
  applier = fn;
}

export function applyUpdate(): void {
  applier?.();
}
