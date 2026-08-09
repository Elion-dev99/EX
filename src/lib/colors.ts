/** Stable, readable color from boyId for large rosters. */
export function colorFromBoyId(boyId: number): string {
  const hue = (boyId * 47) % 360;
  return `hsl(${hue} 52% 36%)`;
}
