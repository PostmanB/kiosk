import { useEffect, useState } from "react";

const getIsDark = () => {
  if (typeof document === "undefined") {
    return false;
  }
  return document.documentElement.classList.contains("dark");
};

const useDocumentTheme = () => {
  const [isDark, setIsDark] = useState(getIsDark);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    const root = document.documentElement;
    const update = () => setIsDark(root.classList.contains("dark"));

    update();
    const observer = new MutationObserver(update);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });

    return () => observer.disconnect();
  }, []);

  return isDark;
};

export default useDocumentTheme;
