export const SUPPORTED_LOCALES = ["ko", "en"] as const;

export type GameLocale = (typeof SUPPORTED_LOCALES)[number];

export const GAME_CONFIG = {
  slug: "morning-star-catch",
  creator: "Manse",
  sourceUrl: "https://github.com/ahndohun/manse-game-morning-star-catch",
  defaultLocale: "en" as GameLocale,
  heroImageUrl: "/packs/morning-star-catch/assets/images/morning-star-hero.png",
  localized: {
    ko: {
      title: "반짝별 잡기",
      summary: "고요한 밤하늘을 떠다니는 반짝별을 향해 손을 뻗어 잡아 보세요.",
      heroAlt: "페리윙클 구름 사이 밤하늘에서 부드러운 곡선을 그리며 흐르는 세 개의 금빛 반짝별",
    },
    en: {
      title: "Morning Star Catch",
      summary: "Reach out and catch the twinkling stars drifting across the calm night sky.",
      heroAlt: "Three warm golden stars drifting in gentle arcs through a navy sky above layered periwinkle clouds",
    },
  },
} as const;
