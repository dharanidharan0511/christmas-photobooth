import { createContext, useContext, useState, type ReactNode } from "react";

interface ShortcutsContextValue {
  isOpen: boolean;
  openShortcuts: () => void;
  closeShortcuts: () => void;
}

const ShortcutsContext = createContext<ShortcutsContextValue | null>(null);

export function ShortcutsProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <ShortcutsContext.Provider
      value={{
        isOpen,
        openShortcuts: () => setIsOpen(true),
        closeShortcuts: () => setIsOpen(false),
      }}
    >
      {children}
    </ShortcutsContext.Provider>
  );
}

export function useShortcuts(): ShortcutsContextValue {
  const ctx = useContext(ShortcutsContext);
  if (!ctx) throw new Error("useShortcuts must be used within ShortcutsProvider");
  return ctx;
}
