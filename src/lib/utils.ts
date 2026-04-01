import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function whatsappLink(phone: string, message: string = "") {
  const cleanPhone = phone.replace(/\D/g, "");
  const phoneWithCountry = cleanPhone.startsWith("55") ? cleanPhone : "55" + cleanPhone;
  const url = `https://wa.me/${phoneWithCountry}`;
  return message ? `${url}?text=${encodeURIComponent(message)}` : url;
}

export function sanitizeWhatsappUrl(url: string): string {
  if (!url.includes("whatsapp") && !url.includes("wa.me")) return url;
  const phoneMatch = url.match(/phone=(\d+)/) || url.match(/wa\.me\/(\d+)/);
  const textMatch = url.match(/text=([^&]+)/);
  if (!phoneMatch) return url;
  const phone = phoneMatch[1];
  const text = textMatch ? textMatch[1] : "";
  return "https://wa.me/" + phone + (text ? "?text=" + text : "");
}
