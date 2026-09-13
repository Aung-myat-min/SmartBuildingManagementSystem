"use client";

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";

// Every result in this product reports the same way: one line, bottom-left,
// six seconds, no undo. The Log Book is the record — the toast is only the
// acknowledgement, so it stays dark and out of the way of the page.
const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      position="bottom-left"
      duration={6000}
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "#111318",
          "--normal-text": "#ffffff",
          "--normal-border": "#111318",
          "--border-radius": "5px",
          "--width": "460px",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast:
            "cn-toast !bg-[#111318] !text-white !border-[#111318] !shadow-[0_8px_24px_rgba(17,19,24,0.28)] !text-[12px] !font-[450]",
          description: "!text-white/70",
          closeButton: "!bg-transparent !border-0 !text-white/60",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
