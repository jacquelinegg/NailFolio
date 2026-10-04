type Listener = () => void;
const listeners = new Set<Listener>();

export function subscribeSavedNailsChange(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function emitSavedNailsChange() {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch {
      // ignore subscriber errors
    }
  });
}
