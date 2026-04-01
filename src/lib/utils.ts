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
