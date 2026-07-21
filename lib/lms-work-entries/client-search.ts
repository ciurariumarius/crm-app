export function matchesLmsClientSearch(client: string, search: string) {
  const normalizedSearch = search.trim().toLocaleLowerCase("ro-RO")
  if (!normalizedSearch) return true
  return client.toLocaleLowerCase("ro-RO").includes(normalizedSearch)
}
