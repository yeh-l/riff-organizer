export function matchesSearch(value: string, search: string): boolean {
  return value.toLowerCase().includes(search.trim().toLowerCase())
}
