import type { Metadata } from "next";
import QRGeneratorLite from "../components/QRGeneratorLite";

export const metadata: Metadata = {
  title: "TUM QR Lite",
};

export default function Page() {
  return (
    <main className="max-w-6xl mx-auto px-6 py-6">
      <QRGeneratorLite />
    </main>
  );
}
