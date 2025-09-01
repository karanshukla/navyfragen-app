export interface Theme {
  imageBackgroundColor: string;
  cardGradientStart: string;
  cardGradientEnd: string;
  cardPadding: string;
  cardBorderRadius: string;
  headerTextColor: string;
  messageBackgroundColor: string;
  messageTextColor: string;
  messagePadding: string;
  messageBorderRadius: string;
  footerTextColor: string;
  fontFamily: string;
  imageMargin: string;
}

export const themes: { [key: string]: Theme } = {
  default: {
    imageBackgroundColor: "#1A1A1A",
    cardGradientStart: "#007bff",
    cardGradientEnd: "#6f42c1",
    cardPadding: "20px",
    cardBorderRadius: "10px",
    headerTextColor: "#FFFFFF",
    messageBackgroundColor: "#FFFFFF",
    messageTextColor: "#000000",
    messagePadding: "20px",
    messageBorderRadius: "8px",
    footerTextColor: "#FFFFFF",
    fontFamily:
      "'Noto Sans', 'Noto Sans JP', 'Noto Sans KR', 'Noto Sans SC', 'Noto Sans TC', 'Noto Sans Arabic', 'Noto Sans Devanagari', 'Noto Sans Hebrew', 'Noto Sans Thai', 'Noto Sans Ethiopic', 'Noto Sans Georgian', 'Noto Sans Armenian', 'Noto Color Emoji', sans-serif",
    imageMargin: "60px",
  },
  compressed: {
    imageBackgroundColor: "#F8F9FA",
    cardGradientStart: "#FFFFFF",
    cardGradientEnd: "#FFFFFF",
    cardPadding: "15px",
    cardBorderRadius: "6px",
    headerTextColor: "#6C757D",
    messageBackgroundColor: "#FFFFFF",
    messageTextColor: "#212529",
    messagePadding: "15px",
    messageBorderRadius: "6px",
    footerTextColor: "#868E96",
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    imageMargin: "15px",
  },
  twitter: {
    imageBackgroundColor: "#FFFFFF",
    cardGradientStart: "#FFFFFF",
    cardGradientEnd: "#FFFFFF",
    cardPadding: "16px",
    cardBorderRadius: "16px",
    headerTextColor: "#0F1419",
    messageBackgroundColor: "#FFFFFF",
    messageTextColor: "#0F1419",
    messagePadding: "16px",
    messageBorderRadius: "16px",
    footerTextColor: "#1D9BF0",
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    imageMargin: "20px",
  },
};
