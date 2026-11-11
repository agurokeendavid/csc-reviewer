import "@fontsource-variable/dm-sans";
import "@fontsource-variable/manrope";
import "./globals.css";

export const metadata = {
  title: "CSC Reviewer PH | Civil Service Mock Exam",
  description: "Practice for the Philippine Career Service Exam with timed mock exams and answer explanations.",
};

export default function RootLayout({ children }) {
  return <html lang="en-PH"><body>{children}</body></html>;
}
