export function formatKsh(n: number) {
  return `KSh ${Math.round(n).toLocaleString("en-KE")}`;
}
export function formatQty(n: number) {
  return Number(n).toLocaleString("en-KE", { maximumFractionDigits: 2 });
}
