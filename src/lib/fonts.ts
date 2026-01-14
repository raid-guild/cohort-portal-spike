import localFont from "next/font/local";
import { Ubuntu_Mono } from "next/font/google";

export const maziusDisplay = localFont({
  src: [
    {
      path: "../../public/fonts/MaziusDisplay-Bold.otf",
      weight: "700",
      style: "normal",
    },
    {
      path: "../../public/fonts/MaziusDisplay-ExtraItalicBold.otf",
      weight: "700",
      style: "italic",
    },
  ],
  variable: "--font-display",
  display: "swap",
});

export const ebGaramond = localFont({
  src: [
    {
      path: "../../public/fonts/EBGaramond-VariableFont_wght.ttf",
      weight: "400 700",
      style: "normal",
    },
    {
      path: "../../public/fonts/EBGaramond-Italic-VariableFont_wght.ttf",
      weight: "400 700",
      style: "italic",
    },
  ],
  variable: "--font-body",
  display: "swap",
});

export const ubuntuMono = Ubuntu_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
  weight: ["400", "700"],
});
