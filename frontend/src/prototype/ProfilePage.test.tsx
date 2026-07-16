import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import ProfilePage from "./ProfilePage";

describe("ProfilePage", () => {
  it("shows only identity fields supplied by the backend session", () => {
    render(<ProfilePage user={{
      id: "user-1",
      username: "ada",
      display_name: "Ada Operator",
      is_staff: true,
      roles: ["commercial", "direction"],
    }} />);

    expect(screen.getByRole("heading", { name: "Profil utilisateur" })).toBeInTheDocument();
    expect(screen.getByText("Ada Operator")).toBeInTheDocument();
    expect(screen.getByText("ada")).toBeInTheDocument();
    expect(screen.getByText("commercial")).toBeInTheDocument();
    expect(screen.getByText("direction")).toBeInTheDocument();
    expect(screen.getByText("Accès staff activé")).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });
});
