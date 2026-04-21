import "./globals.css";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="de"><body className="p-6">{children}</body></html>;
}
