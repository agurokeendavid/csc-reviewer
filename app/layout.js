import "@fontsource-variable/public-sans";
import "@fontsource-variable/source-serif-4";
import "./globals.css";
import { THEME_COLORS, themeScript } from "../lib/theme.js";

const description = "Free practice for the Philippine Career Service Exam: timed Professional and Subprofessional mocks, plus topic drills with answer explanations.";

export const metadata = {
  title: "CSC Reviewer PH: Civil Service Exam practice",
  description,
  openGraph: {
    title: "CSC Reviewer PH",
    description,
    type: "website",
    locale: "en_PH",
  },
};

export const viewport = {
  themeColor: THEME_COLORS.light,
};

export default function RootLayout({ children }) {
  return (
    // The inline script may switch data-theme to dark before React hydrates.
    <html lang="en-PH" data-theme="light" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
