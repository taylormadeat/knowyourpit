import colors from "@/constants/colors";
import { contrastRatio } from "@/constants/contrast";
import { touch, typography } from "@/constants/theme";

describe("mobile visual tokens", () => {
  it("meets WCAG AA contrast for primary reading pairs", () => {
    expect(contrastRatio(colors.dark.foreground, colors.dark.background)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(colors.dark.cardForeground, colors.dark.card)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(colors.dark.primaryForeground, colors.dark.primary)).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps touch and type scales mobile-safe", () => {
    expect(touch.target).toBeGreaterThanOrEqual(44);
    expect(typography.fontSize.base).toBeGreaterThanOrEqual(14);
    expect(typography.fontSize.xxl).toBeLessThanOrEqual(64);
  });
});