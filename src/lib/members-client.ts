export function buildBoyUrl(shopId: number, boyId: number): string {
  return `https://www.dgdgdg.com/boy/detail.php?shop_id=${shopId}&boy_id=${boyId}`;
}

export function parseBoyUrl(input: string): { shopId: number; boyId: number } | null {
  try {
    const url = new URL(input.trim());
    if (!url.hostname.endsWith("dgdgdg.com")) return null;
    const shopId = Number(url.searchParams.get("shop_id"));
    const boyId = Number(url.searchParams.get("boy_id"));
    if (!Number.isInteger(shopId) || !Number.isInteger(boyId) || shopId <= 0 || boyId <= 0) {
      return null;
    }
    return { shopId, boyId };
  } catch {
    return null;
  }
}
