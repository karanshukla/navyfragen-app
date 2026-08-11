import * as s from "./ImageThemePreview.styles";

/**
 * Wireframe of what each image-export theme produces. Every dimension and colour
 * lives in the styles module; these functions only describe the arrangement.
 */

function DefaultPreview() {
  return (
    <div style={s.defaultRoot}>
      <div style={s.centered}>
        <div style={s.defaultHeading} />
      </div>
      <div style={s.defaultQuote}>
        <div style={s.defaultQuoteLine} />
        <div style={s.defaultQuoteLineShort} />
      </div>
      <div style={s.centered}>
        <div style={s.defaultFooter} />
      </div>
    </div>
  );
}

function CompressedPreview() {
  return (
    <div style={s.compressedRoot}>
      <div style={s.compressedBlock}>
        <div style={s.compressedTitle} />
        <div style={s.compressedLine} />
        <div style={s.compressedLineShort} />
        <div style={s.compressedMeta} />
      </div>
    </div>
  );
}

function TwitterPreview() {
  return (
    <div style={s.twitterRoot}>
      <div style={s.twitterCard}>
        <div style={s.twitterHeader}>
          <div style={s.twitterAvatar} />
          <div style={{ flex: 1 }}>
            <div style={s.twitterName} />
            <div style={s.twitterHandle} />
          </div>
        </div>
        <div style={s.twitterLine} />
        <div style={s.twitterLineShort} />
        <div style={s.twitterRule} />
        <div style={s.twitterAction} />
      </div>
    </div>
  );
}

const PREVIEWS: Record<string, () => React.JSX.Element> = {
  default: DefaultPreview,
  compressed: CompressedPreview,
  twitter: TwitterPreview,
};

export function ImageThemePreview({ theme }: { theme: string }) {
  const Preview = PREVIEWS[theme];
  return <Preview />;
}
