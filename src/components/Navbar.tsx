import { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { FiLock, FiMenu, FiX } from "react-icons/fi";
import ThemeToggle from "./ui/ThemeToggle";
import { PIN_UNLOCK_KEY } from "../features/pin/PinGate";

const navLinks = [
  { to: "/cashier", label: "Cashier" },
  { to: "/bills", label: "Bills" },
  { to: "/kitchen", label: "Kitchen" },
  { to: "/admin", label: "Admin" },
];

const Navbar = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const handleLock = () => {
    localStorage.removeItem(PIN_UNLOCK_KEY);
    window.location.reload();
  };

  const desktopLinkClass = ({ isActive }: { isActive: boolean }) =>
    [
      "transition-colors hover:text-brand",
      isActive ? "text-brand" : "text-contrast/80",
    ]
      .filter(Boolean)
      .join(" ");

  const mobileLinkClass = ({ isActive }: { isActive: boolean }) =>
    [
      "rounded-md px-3 py-2 transition hover:bg-accent-2/70 hover:text-brand",
      isActive ? "bg-accent-2/90 text-brand" : "text-contrast/80",
    ]
      .filter(Boolean)
      .join(" ");

  return (
    <>
      <header className="border-b border-accent-3/50 bg-primary/80 backdrop-blur">
        <nav className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-contrast/80">
          <Link
            to="/"
            className="text-lg font-semibold text-brand transition-colors hover:text-brand/80"
          >
            Kiosk Control
          </Link>
          <div className="hidden items-center gap-6 sm:flex">
            {navLinks.map((link) => (
              <NavLink
                key={link.label}
                to={link.to}
                className={desktopLinkClass}
                end={link.to === "/"}
              >
                {link.label}
              </NavLink>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <button
              type="button"
              onClick={handleLock}
              className="hidden items-center gap-2 rounded-full border border-accent-3/60 bg-accent-2/70 px-4 py-2 text-sm font-semibold text-contrast shadow transition-transform hover:-translate-y-0.5 hover:border-brand/50 hover:text-brand hover:shadow-md sm:inline-flex"
            >
              <FiLock className="h-4 w-4" />
              Lock
            </button>
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-md p-2 text-contrast/70 transition hover:bg-accent-2 hover:text-brand focus:outline-none focus:ring-2 focus:ring-brand sm:hidden"
              onClick={() => setIsMenuOpen(true)}
              aria-label="Open menu"
            >
              <FiMenu className="h-6 w-6" />
            </button>
          </div>
        </nav>
      </header>
      {isMenuOpen && (
        <div className="fixed inset-0 z-40">
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 bg-primary/40 backdrop-blur"
            onClick={() => setIsMenuOpen(false)}
          />
          <div className="relative ml-auto flex h-full w-72 max-w-full flex-col bg-primary shadow-2xl">
            <div className="flex items-center justify-between border-b border-accent-3/60 px-4 py-4">
              <span className="text-lg font-semibold text-brand">
                Kiosk Control
              </span>
              <button
                type="button"
                className="rounded-md p-2 text-contrast/70 transition hover:bg-accent-2 hover:text-brand focus:outline-none focus:ring-2 focus:ring-brand"
                onClick={() => setIsMenuOpen(false)}
                aria-label="Close menu"
              >
                <FiX className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex flex-1 flex-col gap-4 px-4 py-6 text-sm font-medium text-contrast/80">
              {navLinks.map((link) => (
                <NavLink
                  key={link.label}
                  to={link.to}
                  className={mobileLinkClass}
                  onClick={() => setIsMenuOpen(false)}
                  end={link.to === "/"}
                >
                  {link.label}
                </NavLink>
              ))}
              <ThemeToggle variant="menu" />
              <button
                type="button"
                className="mt-auto flex items-center justify-center gap-2 rounded-full border border-accent-3/60 bg-accent-2/70 px-4 py-2 text-sm font-semibold text-contrast shadow transition-transform hover:-translate-y-0.5 hover:border-brand/50 hover:text-brand hover:shadow-md"
                onClick={() => {
                  setIsMenuOpen(false);
                  handleLock();
                }}
              >
                <FiLock className="h-4 w-4" />
                Lock
              </button>
            </nav>
          </div>
        </div>
      )}
    </>
  );
};

export default Navbar;
