import type { Metadata } from "next";
import QRFullMode from "../components/QRFullMode";

export const metadata: Metadata = {
  title: "TUM QR Full",
};

export default function Page() {
  return (
    <main className="max-w-6xl mx-auto px-6 py-6">
      <QRFullMode />
    </main>
  );
}
