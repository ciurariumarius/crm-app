export type SearchPaginationState = {
    total: number
    page: number
    perPage: number
    totalPages: number
    pageStart: number
    pageEnd: number
    shouldPaginate: boolean
    prevPage: number | null
    nextPage: number | null
}
