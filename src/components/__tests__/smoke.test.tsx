import { render, screen } from "@testing-library/react"

test("vitest renders React", () => {
  render(<div>hello</div>)
  expect(screen.getByText("hello")).toBeInTheDocument()
})
