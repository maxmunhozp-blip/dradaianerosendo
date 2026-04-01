import { createContext, useContext, useState, type ReactNode } from "react";

interface ViewAsContextType {
  viewAsUserId: string | null;
  viewAsEmail: string | null;
  startViewAs: (userId: string, email: string) => void;
  stopViewAs: () => void;
  isViewingAs: boolean;
}

const ViewAsContext = createContext<ViewAsContextType>({
  viewAsUserId: null,
  viewAsEmail: null,
  startViewAs: () => {},
  stopViewAs: () => {},
  isViewingAs: false,
});

export function ViewAsProvider({ children }: { children: ReactNode }) {
  const [viewAsUserId, setViewAsUserId] = useState<string | null>(null);
  const [viewAsEmail, setViewAsEmail] = useState<string | null>(null);

  const startViewAs = (userId: string, email: string) => {
    setViewAsUserId(userId);
    setViewAsEmail(email);
  };

  const stopViewAs = () => {
    setViewAsUserId(null);
    setViewAsEmail(null);
  };

  return (
    <ViewAsContext.Provider value={{ viewAsUserId, viewAsEmail, startViewAs, stopViewAs, isViewingAs: !!viewAsUserId }}>
      {children}
    </ViewAsContext.Provider>
  );
}

export function useViewAs() {
  return useContext(ViewAsContext);
}
