export function applyOpacity(color: string | undefined | null, alpha: number): string {
  if (!color) return "";
  if (color.startsWith("#")) {
    const cleanHex = color.replace("#", "");
    let r = 0, g = 0, b = 0;
    if (cleanHex.length === 3) {
      r = parseInt(cleanHex[0] + cleanHex[0], 16);
      g = parseInt(cleanHex[1] + cleanHex[1], 16);
      b = parseInt(cleanHex[2] + cleanHex[2], 16);
    } else if (cleanHex.length === 6 || cleanHex.length === 8) {
      r = parseInt(cleanHex.substring(0, 2), 16);
      g = parseInt(cleanHex.substring(2, 4), 16);
      b = parseInt(cleanHex.substring(4, 6), 16);
    } else {
      return color;
    }
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  } else if (color.startsWith("rgba")) {
    // Fix bug 9: Replace only the last comma separated value which is alpha
    const parts = color.substring(5, color.length - 1).split(",");
    if (parts.length >= 3) {
      return `rgba(${parts[0]}, ${parts[1]}, ${parts[2]}, ${alpha})`;
    }
    return color;
  } else if (color.startsWith("rgb")) {
    const parts = color.substring(4, color.length - 1).split(",");
    if (parts.length >= 3) {
      return `rgba(${parts[0]}, ${parts[1]}, ${parts[2]}, ${alpha})`;
    }
    return color;
  }
  return color;
}
