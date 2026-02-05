import { useEffect, useMemo, useRef, useState } from "react";

type TextTarget = HTMLInputElement | HTMLTextAreaElement;

const NON_TEXT_TYPES = new Set([
  "button",
  "checkbox",
  "color",
  "file",
  "hidden",
  "image",
  "radio",
  "range",
  "reset",
  "submit",
]);

const isTextTarget = (target: EventTarget | null): TextTarget | null => {
  if (!target || !(target instanceof HTMLElement)) return null;
  if (target instanceof HTMLTextAreaElement) {
    if (target.readOnly || target.disabled) return null;
    if (target.dataset.virtualKeyboard === "off") return null;
    return target;
  }
  if (target instanceof HTMLInputElement) {
    if (NON_TEXT_TYPES.has(target.type)) return null;
    if (target.readOnly || target.disabled) return null;
    if (target.dataset.virtualKeyboard === "off") return null;
    return target;
  }
  return null;
};

const setNativeValue = (element: TextTarget, value: string) => {
  const valueDescriptor = Object.getOwnPropertyDescriptor(element, "value");
  const proto = Object.getPrototypeOf(element);
  const protoDescriptor = Object.getOwnPropertyDescriptor(proto, "value");
  const setter = protoDescriptor?.set ?? valueDescriptor?.set;
  if (setter) {
    setter.call(element, value);
  } else {
    element.value = value;
  }
};

const applyValue = (element: TextTarget, value: string, cursor: number) => {
  setNativeValue(element, value);
  if (element.setSelectionRange) {
    try {
      element.setSelectionRange(cursor, cursor);
    } catch {
      // Some input types (e.g. number) do not support selection ranges.
    }
  }
  element.dispatchEvent(new Event("input", { bubbles: true }));
};

const insertText = (element: TextTarget, text: string) => {
  const value = element.value ?? "";
  const start = element.selectionStart ?? value.length;
  const end = element.selectionEnd ?? value.length;
  const nextValue = `${value.slice(0, start)}${text}${value.slice(end)}`;
  applyValue(element, nextValue, start + text.length);
};

const backspaceText = (element: TextTarget) => {
  const value = element.value ?? "";
  const start = element.selectionStart ?? value.length;
  const end = element.selectionEnd ?? value.length;
  if (start === 0 && end === 0) return;
  if (start !== end) {
    const nextValue = `${value.slice(0, start)}${value.slice(end)}`;
    applyValue(element, nextValue, start);
    return;
  }
  const nextValue = `${value.slice(0, start - 1)}${value.slice(end)}`;
  applyValue(element, nextValue, start - 1);
};

const clearText = (element: TextTarget) => {
  applyValue(element, "", 0);
};

const getFieldLabel = (element: TextTarget) => {
  const ariaLabel = element.getAttribute("aria-label");
  if (ariaLabel) return ariaLabel;
  if (element.id) {
    try {
      const label = document.querySelector(`label[for="${CSS.escape(element.id)}"]`);
      const labelText = label?.textContent?.trim();
      if (labelText) return labelText;
    } catch {
      // Ignore selector errors and fall back to other identifiers.
    }
  }
  if (element.placeholder) return element.placeholder;
  if (element.name) return element.name;
  return "Active field";
};

const VirtualKeyboard = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [shift, setShift] = useState(false);
  const [activeLabel, setActiveLabel] = useState("Active field");
  const [activeValue, setActiveValue] = useState("");
  const [activePlaceholder, setActivePlaceholder] = useState("");
  const activeRef = useRef<TextTarget | null>(null);
  const keyboardRef = useRef<HTMLDivElement | null>(null);
  const repeatTimeoutRef = useRef<number | null>(null);
  const repeatIntervalRef = useRef<number | null>(null);
  const repeatKeyRef = useRef<string | null>(null);

  const rows = useMemo(
    () => [
      ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"],
      ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
      ["a", "s", "d", "f", "g", "h", "j", "k", "l"],
      ["shift", "z", "x", "c", "v", "b", "n", "m", "backspace"],
      ["space", "-", "@", ".", ",", "/", "clear", "done"],
    ],
    []
  );

  useEffect(() => {
    const handleFocusIn = (event: FocusEvent) => {
      const target = isTextTarget(event.target);
      if (!target) return;
      activeRef.current = target;
      setIsOpen(true);
      setShift(false);
      setActiveLabel(getFieldLabel(target));
      setActiveValue(target.value ?? "");
      setActivePlaceholder(target.placeholder ?? "");
      window.setTimeout(() => {
        target.scrollIntoView({ block: "center", behavior: "smooth" });
      }, 0);
    };

    const handleFocusOut = () => {
      window.setTimeout(() => {
        const active = isTextTarget(document.activeElement);
        if (active) {
          activeRef.current = active;
          setActiveLabel(getFieldLabel(active));
          setActiveValue(active.value ?? "");
          setActivePlaceholder(active.placeholder ?? "");
          return;
        }
        setIsOpen(false);
        activeRef.current = null;
        setActiveValue("");
        setActivePlaceholder("");
      }, 0);
    };

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && keyboardRef.current?.contains(target)) return;
      if (isTextTarget(target)) return;
      setIsOpen(false);
      activeRef.current = null;
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
        activeRef.current?.blur();
        activeRef.current = null;
      }
    };

    const handlePointerUp = () => {
      stopRepeat();
    };

    const handleInput = (event: Event) => {
      const target = isTextTarget(event.target);
      if (!target || target !== activeRef.current) return;
      setActiveValue(target.value ?? "");
      setActivePlaceholder(target.placeholder ?? "");
    };

    document.addEventListener("focusin", handleFocusIn);
    document.addEventListener("focusout", handleFocusOut);
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("pointerup", handlePointerUp);
    document.addEventListener("pointercancel", handlePointerUp);
    document.addEventListener("input", handleInput);

    return () => {
      if (repeatTimeoutRef.current) {
        window.clearTimeout(repeatTimeoutRef.current);
      }
      if (repeatIntervalRef.current) {
        window.clearInterval(repeatIntervalRef.current);
      }
      document.removeEventListener("focusin", handleFocusIn);
      document.removeEventListener("focusout", handleFocusOut);
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("pointerup", handlePointerUp);
      document.removeEventListener("pointercancel", handlePointerUp);
      document.removeEventListener("input", handleInput);
    };
  }, []);

  const stopRepeat = () => {
    if (repeatTimeoutRef.current) {
      window.clearTimeout(repeatTimeoutRef.current);
      repeatTimeoutRef.current = null;
    }
    if (repeatIntervalRef.current) {
      window.clearInterval(repeatIntervalRef.current);
      repeatIntervalRef.current = null;
    }
    repeatKeyRef.current = null;
  };

  const handleKeyPress = (key: string) => {
    const target = activeRef.current;
    if (!target) return;
    if (key === "shift") {
      setShift((prev) => !prev);
      return;
    }
    if (key === "backspace") {
      backspaceText(target);
      return;
    }
    if (key === "space") {
      insertText(target, " ");
      return;
    }
    if (key === "clear") {
      clearText(target);
      return;
    }
    if (key === "done") {
      setIsOpen(false);
      activeRef.current = null;
      return;
    }
    const output = shift ? key.toUpperCase() : key;
    insertText(target, output);
    if (shift) setShift(false);
  };

  const handlePressStart = (key: string) => {
    handleKeyPress(key);
    if (key !== "backspace") return;
    stopRepeat();
    repeatKeyRef.current = key;
    repeatTimeoutRef.current = window.setTimeout(() => {
      repeatIntervalRef.current = window.setInterval(() => {
        if (repeatKeyRef.current === key) {
          handleKeyPress(key);
        }
      }, 60);
    }, 350);
  };

  const handlePressEnd = () => {
    stopRepeat();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[70] px-4 pb-4">
      <div
        ref={keyboardRef}
        className="mx-auto w-full max-w-5xl rounded-3xl border border-accent-3/60 bg-primary/95 p-4 shadow-2xl backdrop-blur"
      >
        <div className="mb-4 rounded-2xl border border-accent-3/60 bg-accent-1/80 px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-contrast/60">
            {activeLabel}
          </p>
          <div className="mt-2 min-h-[1.5rem] text-base font-semibold text-contrast">
            {activeValue || activePlaceholder || " "}
          </div>
        </div>
        <div className="mb-3 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-[0.3em] text-brand/70">
            Virtual Keyboard
          </span>
          <button
            type="button"
            onPointerDown={(event) => {
              event.preventDefault();
              handleKeyPress("done");
            }}
            className="rounded-full border border-accent-3/60 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-contrast/70 transition hover:border-brand/50 hover:text-brand"
          >
            Hide
          </button>
        </div>
        <div className="space-y-2">
          {rows.map((row, rowIndex) => (
            <div key={`row-${rowIndex}`} className="flex gap-2">
              {row.map((key) => {
                const isSpecial = ["shift", "backspace", "space", "done", "clear"].includes(key);
                const isShiftActive = key === "shift" && shift;
                const label =
                  key === "backspace"
                    ? "Backspace"
                    : key === "space"
                      ? "Space"
                      : key === "clear"
                        ? "Clear"
                        : key === "done"
                          ? "Done"
                          : key === "shift"
                            ? "Shift"
                            : shift
                              ? key.toUpperCase()
                              : key;
                const widthClass =
                  key === "space"
                    ? "flex-[2.5]"
                    : key === "backspace"
                      ? "flex-[1.6]"
                      : key === "shift"
                        ? "flex-[1.4]"
                        : key === "done"
                          ? "flex-[1.3]"
                          : key === "clear"
                            ? "flex-[1.2]"
                            : "flex-1";
                return (
                  <button
                    key={key}
                    type="button"
                    onPointerDown={(event) => {
                      event.preventDefault();
                      handlePressStart(key);
                    }}
                    onPointerUp={handlePressEnd}
                    onPointerLeave={handlePressEnd}
                    onPointerCancel={handlePressEnd}
                    onContextMenu={(event) => event.preventDefault()}
                    className={`rounded-2xl border px-3 py-3 text-sm font-semibold shadow-sm transition active:scale-[0.98] ${widthClass} ${
                      isShiftActive
                        ? "border-brand/60 bg-brand/15 text-brand"
                        : isSpecial
                          ? "border-accent-3/60 bg-accent-2/80 text-contrast/80 hover:border-brand/40 hover:text-brand"
                          : "border-accent-3/60 bg-accent-1/80 text-contrast/80 hover:border-brand/40 hover:text-brand"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default VirtualKeyboard;
