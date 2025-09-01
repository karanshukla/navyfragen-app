
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
    imageBackgroundColor: "#F0F2F5", // Light grey background
    cardGradientStart: "#FFFFFF", // Solid white card
    cardGradientEnd: "#FFFFFF",
    cardPadding: "10px", // Reduced padding
    cardBorderRadius: "5px", // Smaller border radius
    headerTextColor: "#333333", // Darker text for contrast
    messageBackgroundColor: "#E9ECEF", // Slightly darker message background
    messageTextColor: "#212529", // Dark text
    messagePadding: "10px", // Reduced message padding
    messageBorderRadius: "4px",
    footerTextColor: "#6C757D", // Grey footer text
    fontFamily:
      "'Noto Sans', 'Noto Sans JP', 'Noto Sans KR', 'Noto Sans SC', 'Noto Sans TC', 'Noto Sans Arabic', 'Noto Sans Devanagari', 'Noto Sans Hebrew', 'Noto Sans Thai', 'Noto Sans Ethiopic', 'Noto Sans Georgian', 'Noto Sans Armenian', 'Noto Color Emoji', sans-serif",
    imageMargin: "30px", // Reduced image margin
  },
  twitter: {
    imageBackgroundColor: "#FFFFFF", // White background
    cardGradientStart: "#FFFFFF", // White card
    cardGradientEnd: "#FFFFFF",
    cardPadding: "15px",
    cardBorderRadius: "12px",
    headerTextColor: "#0F1419", // Twitter dark text
    messageBackgroundColor: "#F7F9F9", // Light grey message background
    messageTextColor: "#0F1419",
    messagePadding: "12px 15px",
    messageBorderRadius: "12px",
    footerTextColor: "#536471", // Twitter grey text
    fontFamily:
      "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif", // Twitter font stack
    imageMargin: "40px",
  },
};
