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

type AndroidPrinterBridge = {
  printKitchenTicket?: (payloadJson: string) => void;
  printBill?: (payloadJson: string) => void;
};

const getAndroidPrinter = (): AndroidPrinterBridge | null => {
  if (typeof window === "undefined") return null;
  const printer = (window as Window & { AndroidPrinter?: AndroidPrinterBridge }).AndroidPrinter;
  return printer ?? null;
};

export const isAndroidPrinterAvailable = () => {
  const printer = getAndroidPrinter();
  return Boolean(printer?.printKitchenTicket || printer?.printBill);
};

const callAndroidPrinter = (
  method: keyof AndroidPrinterBridge,
  payload: KitchenTicketPayload | BillPayload
): PrintResult => {
  const printer = getAndroidPrinter();
  const handler = printer?.[method];
  if (!printer || typeof handler !== "function") {
    return { supported: false, ok: false };
  }
  try {
    handler(JSON.stringify(payload));
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
