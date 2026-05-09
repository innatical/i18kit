import { useEffect } from "react";

const useTheme = () => {
  useEffect(() => {
    const root = window.document.documentElement;

    root.classList.remove("light", "dark");

    const systemTheme = window.matchMedia("(prefers-color-scheme: dark)")
      .matches
      ? "dark"
      : "light";

    root.classList.add(systemTheme);
    return;
  }, []);
};

export default useTheme;
