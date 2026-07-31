// @vitest-environment jsdom

import React from "react"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { NotesScopeSwitch } from "@/components/notes/notes-scope-switch"

afterEach(cleanup)

describe("NotesScopeSwitch", () => {
  it("exposes the selected scope and changes it on click", () => {
    const onChange = vi.fn()
    render(React.createElement(NotesScopeSwitch, { value: "view", onChange }))

    expect(screen.getByRole("button", { name: "Current View" }).getAttribute("aria-pressed")).toBe("true")
    expect(screen.getByRole("button", { name: "All Notes" }).getAttribute("aria-pressed")).toBe("false")

    fireEvent.click(screen.getByRole("button", { name: "All Notes" }))
    expect(onChange).toHaveBeenCalledWith("all")
  })
})
