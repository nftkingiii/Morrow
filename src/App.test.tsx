// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi } from "vitest";
import App from "./App";

vi.mock("./lib/evidence", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./lib/evidence")>();
  return { ...actual, verifyPoolTransactions: vi.fn().mockResolvedValue([]) };
});

describe("funding secret acknowledgement", () => {
  it("keeps the funding action disabled until both secrets are acknowledged", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("tab", { name: /Fund/ }));
    fireEvent.change(screen.getByLabelText("Grant title"), { target: { value: "Gate verification" } });
    fireEvent.change(screen.getByLabelText("Milestone deliverable"), { target: { value: "Verify the acknowledgement gate" } });
    fireEvent.change(screen.getByLabelText(/Amount/), { target: { value: "0.05" } });
    fireEvent.change(screen.getByLabelText("Claim deadline"), { target: { value: "2099-08-22T12:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Generate funding secrets" }));

    const fundingButton = await screen.findByRole("button", { name: /Create prepared preview|Open Ready and fund/ });
    const acknowledgement = screen.getByLabelText("I saved both secrets outside this browser");
    expect(fundingButton).toBeDisabled();

    fireEvent.click(acknowledgement);
    expect(fundingButton).toBeEnabled();
  });
});
