export type KitchenTicketItem = {
  name: string;
  quantity: number;
  modifiers?: Record<string, string[]>;
};

export type KitchenTicketPayload = {
  type: "kitchen";
  table: string;
  createdAt: string;
  items: KitchenTicketItem[];
  paperWidthMm?: number;
};

export type BillItem = {
  name: string;
  quantity: number;
  price?: number;
  modifiers?: Record<string, string[]>;
  registerCode?: string | null;
};

export type BillPayload = {
  type: "bill";
  table: string;
  openedAt?: string;
  items: BillItem[];
  total?: number;
  currency?: string;
  paperWidthMm?: number;
};

export type PrintResult = {
  supported: boolean;
  ok: boolean;
};

export type PrinterState =
  | "connected"
  | "connecting"
  | "retrying"
  | "disconnected"
  | "error"
  | "idle"
  | "unknown";

export type PrinterStatus = {
  state: PrinterState;
  message?: string;
  updatedAt?: number;
};

export type PairedPrinter = {
  name: string;
  address: string;
};

export type PairedPrintersResponse = {
  ok: boolean;
  devices: PairedPrinter[];
  error?: string;
};

type AndroidPrinterBridge = {
  printKitchenTicket?: (payloadJson: string) => void;
  printBill?: (payloadJson: string) => void;
  getStatus?: () => string;
  getPairedPrinters?: () => string;
  setPrinterTarget?: (target: string) => void;
};

const getAndroidPrinter = (): AndroidPrinterBridge | null => {
  if (typeof window === "undefined") return null;
  const printer = (window as Window & { AndroidPrinter?: AndroidPrinterBridge }).AndroidPrinter;
  return printer ?? null;
};

export const isAndroidPrinterAvailable = () => {
  const printer = getAndroidPrinter();
  return Boolean(printer?.printKitchenTicket || printer?.printBill || printer?.getStatus);
};

export const getPrinterStatus = (): PrinterStatus | null => {
  const printer = getAndroidPrinter();
  if (!printer || typeof printer.getStatus !== "function") {
    return null;
  }
  try {
    const raw = printer.getStatus();
    if (!raw) return { state: "unknown" };
    const data = JSON.parse(raw) as Partial<PrinterStatus> | null;
    if (!data || typeof data.state !== "string") {
      return { state: "unknown" };
    }
    return {
      state: data.state as PrinterState,
      message: data.message,
      updatedAt: data.updatedAt,
    };
  } catch (error) {
    console.warn("[print] getStatus failed", error);
    return { state: "unknown" };
  }
};

export const getPairedPrinters = (): PairedPrintersResponse | null => {
  const printer = getAndroidPrinter();
  if (!printer || typeof printer.getPairedPrinters !== "function") {
    return null;
  }
  try {
    const raw = printer.getPairedPrinters();
    const data = JSON.parse(raw) as Partial<PairedPrintersResponse> | null;
    if (!data || !Array.isArray(data.devices)) {
      return { ok: false, devices: [], error: "Invalid paired printers payload." };
    }
    return {
      ok: Boolean(data.ok),
      devices: data.devices
        .filter((item): item is PairedPrinter => {
          return Boolean(item && typeof item.name === "string" && typeof item.address === "string");
        })
        .map((item) => ({ name: item.name, address: item.address })),
      error: typeof data.error === "string" ? data.error : undefined,
    };
  } catch (error) {
    console.warn("[print] getPairedPrinters failed", error);
    return { ok: false, devices: [], error: "Failed to parse paired printers." };
  }
};

export const setPrinterTarget = (target: string): PrintResult => {
  const printer = getAndroidPrinter();
  if (!printer || typeof printer.setPrinterTarget !== "function") {
    return { supported: false, ok: false };
  }
  try {
    printer.setPrinterTarget(target);
    return { supported: true, ok: true };
  } catch (error) {
    console.warn("[print] setPrinterTarget failed", error);
    return { supported: true, ok: false };
  }
};

const callAndroidPrinter = (
  method: keyof AndroidPrinterBridge,
  payload: KitchenTicketPayload | BillPayload
): PrintResult => {
  const printer = getAndroidPrinter();
  if (!printer) {
    return { supported: false, ok: false };
  }
  const methodCandidate = printer[method];
  if (typeof methodCandidate !== "function") {
    return { supported: false, ok: false };
  }
  try {
    methodCandidate.call(printer, JSON.stringify(payload));
    return { supported: true, ok: true };
  } catch (error) {
    console.warn(`[print] ${String(method)} failed`, error);
    return { supported: true, ok: false };
  }
};

export const printKitchenTicket = (payload: KitchenTicketPayload): PrintResult =>
  callAndroidPrinter("printKitchenTicket", payload);

export const printBill = (payload: BillPayload): PrintResult =>
  callAndroidPrinter("printBill", payload);
