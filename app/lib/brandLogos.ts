import { TUM_QR_LOGO, TRU_QR_LOGO } from "./qrLogos";

export type BrandLogoId = "tru" | "tum";

export type BrandLogoOption = {
  id: BrandLogoId;
  label: string;
  dataUrl: string | null;
};

export const brandLogoOptions: BrandLogoOption[] = [
  {
    id: "tru",
    label: "TRU",
    dataUrl: TRU_QR_LOGO,
  },
  {
    id: "tum",
    label: "TUM",
    dataUrl: TUM_QR_LOGO,
  },
];

export const getBrandLogo = (id: BrandLogoId): string | null => {
  const option = brandLogoOptions.find(item => item.id === id);
  return option?.dataUrl ?? null;
};
