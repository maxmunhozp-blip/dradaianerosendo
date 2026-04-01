import type React from "react";

interface WhatsAppButtonProps {
  phone: string;
  message: string;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  onMissingPhone?: () => void;
}

export const WhatsAppButton = ({
  phone,
  message,
  children,
  className,
  disabled,
  onMissingPhone,
}: WhatsAppButtonProps) => {
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const clean = phone.replace(/\D/g, "");
    if (!clean) {
      onMissingPhone?.();
      return;
    }

    const number = clean.startsWith("55") ? clean : "55" + clean;
    const url = "https://wa.me/" + number + "?text=" + encodeURIComponent(message);
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <button type="button" onClick={handleClick} className={className} disabled={disabled}>
      {children}
    </button>
  );
};

export default WhatsAppButton;
