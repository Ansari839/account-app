import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/context/ThemeContext";
import { NotificationProvider } from "@/context/NotificationContext";
import { CompanyProvider } from "@/context/CompanyContext";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Antigravity ERP - Advanced Accounting",
  description: "State-of-the-art financial management system",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider>
          <NotificationProvider>
            <CompanyProvider>
              {children}
            </CompanyProvider>
          </NotificationProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
