import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Walkable Metro Map",
  description: "WMATA stations with selectable walking isochrones.",
  icons: {
    icon: "/WMATA_Metro_Logo_small.svg",
    apple: "/WMATA_Metro_Logo_small.svg"
  }
};

type RootLayoutProps = {
  children: ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
