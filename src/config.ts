export const SITE = {
  website: "https://jtforrest.com/", 
  author: "Josh Forrest",
  profile: "https://jtforrest.com/",
  desc: "Personal site of Josh Forrest — projects and write-ups.",
  title: "Josh Forrest",
  ogImage: "astropaper-og.jpg",
  lightAndDarkMode: true,
  postPerIndex: 4,
  postPerPage: 4,
  scheduledPostMargin: 15 * 60 * 1000, // 15 minutes
  showArchives: true,
  showBackButton: true, // show back button in post detail
  editPost: {
    enabled: false,
    text: "Edit page",
    url: "",
  },
  dynamicOgImage: true,
  dir: "ltr", // "rtl" | "auto"
  lang: "en", // html lang code. Set this empty and default will be "en"
  timezone: "Europe/London",
} as const;
