"use server"

import { requireAuth } from "@/lib/auth"
import {
    executeGlobalSearch,
    type GlobalSearchResultProject,
    type GlobalSearchResultTask,
    type GlobalSearchResultPartner,
    type GlobalSearchResultNote,
    type GlobalSearchResultSite,
    type GlobalSearchResults,
} from "@/lib/search/global-search-core"

export type {
    GlobalSearchResultProject,
    GlobalSearchResultTask,
    GlobalSearchResultPartner,
    GlobalSearchResultNote,
    GlobalSearchResultSite,
    GlobalSearchResults,
}

export async function globalSearch(query: string): Promise<GlobalSearchResults> {
    try {
        await requireAuth()
        return await executeGlobalSearch(query)
    } catch (error) {
        console.error("[search] global search server action failed", error)
        return {
            projects: [],
            tasks: [],
            partners: [],
            notes: [],
            sites: [],
        }
    }
}
