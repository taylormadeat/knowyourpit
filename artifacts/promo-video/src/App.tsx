import VideoTemplate from "@/components/video/VideoTemplate";

/**
 * Outer page: black letterbox frame.
 * Inner: a fixed 9:16 stage that sizes to fit the viewport (width-bound or
 * height-bound), establishes a CSS size container so all child sizing units
 * (cqw / cqh) are stage-relative — guaranteeing a deterministic 9:16 output
 * regardless of preview viewport, suitable for App Store Preview / Reels capture.
 */
export default function App() {
  return (
    <div className="fixed inset-0 bg-black flex items-center justify-center">
      <div
        id="promo-video-stage"
        className="relative bg-charcoal overflow-hidden"
        style={{
          aspectRatio: "9 / 16",
          width: "min(100vw, calc(100vh * 9 / 16))",
          height: "min(100vh, calc(100vw * 16 / 9))",
          containerType: "size",
        }}
      >
        <VideoTemplate />
      </div>
    </div>
  );
}
